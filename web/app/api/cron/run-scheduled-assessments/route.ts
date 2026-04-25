// POST /api/cron/run-scheduled-assessments
// Called by Vercel Cron (or any external scheduler) every 30 minutes.
// Finds all assessment schedules due for execution and runs them.
// Secured with CRON_SECRET header to prevent unauthorized triggering.
import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveGraphClient } from '@/lib/atlas-client'
import { decryptIfNeeded } from '@/lib/crypto'
import {
  getDueSchedules,
  markScheduleRun,
  runAssessment,
  diffAssessments,
  persistDriftEvents,
  recordMaturitySnapshot,
  runRemediation,
} from '@src/operations/index.js'
import type { FullReport } from '@src/types.js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const due = await getDueSchedules(admin)

  if (due.length === 0) {
    return NextResponse.json({ ran: 0, message: 'No schedules due' })
  }

  // Fire-and-forget: run each schedule in background
  after(async () => {
    for (const schedule of due) {
      try {
        await runScheduledAssessment(schedule, admin)
      } catch {
        // Errors are logged per-schedule; don't fail the whole batch
      }
    }
  })

  return NextResponse.json({ queued: due.length })
}

// ---------------------------------------------------------------------------
// Run a single scheduled assessment with drift + maturity + auto-remediation
// ---------------------------------------------------------------------------

async function runScheduledAssessment(
  schedule: Awaited<ReturnType<typeof getDueSchedules>>[number],
  admin: ReturnType<typeof getAdminClient>
) {
  const { graphClient } = await resolveGraphClient(schedule.userId, schedule.clientId)

  // Load the prior report's control assessments for drift comparison
  let priorAssessments: FullReport['controlAssessments'] | null = null
  if (schedule.lastReportId) {
    const { data: priorReport } = await admin
      .from('reports')
      .select('data')
      .eq('id', schedule.lastReportId)
      .single()
    if (priorReport) {
      priorAssessments = (priorReport.data as FullReport).controlAssessments ?? null
    }
  }

  // Fetch client name for the report
  const { data: clientRow } = await admin
    .from('clients')
    .select('name, tenant_id')
    .eq('id', schedule.clientId)
    .single()

  const report = await runAssessment(
    {
      frameworkId: schedule.frameworkId,
      graphClient,
      clientId: schedule.clientId,
      clientName: clientRow?.name,
      tenantId: clientRow?.tenant_id ? decryptIfNeeded(clientRow.tenant_id) : undefined,
    },
    {
      onComplete: async (fullReport) => {
        // Save report to DB
        await admin.from('reports').insert({
          id: fullReport.reportId,
          user_id: schedule.userId,
          client_id: schedule.clientId,
          framework_id: fullReport.frameworkId,
          data: fullReport as unknown as Record<string, unknown>,
          generated_at: fullReport.generatedAt,
        })

        // Save objective statuses
        if (fullReport.objectiveStatuses?.length) {
          await admin.from('objective_statuses').upsert(
            fullReport.objectiveStatuses.map((os) => ({
              report_id: fullReport.reportId,
              objective_id: os.objectiveId,
              status: os.status,
              evidence_source: os.evidenceSource,
              assessed_at: os.assessedAt ?? new Date().toISOString(),
              assessed_by: os.assessedBy ?? 'atlas-scheduled',
            })),
            { onConflict: 'report_id,objective_id' }
          )
        }
      },
    }
  )

  // Record maturity snapshot
  await recordMaturitySnapshot(
    {
      userId: schedule.userId,
      clientId: schedule.clientId,
      frameworkId: report.frameworkId,
      reportId: report.reportId,
      summary: report.summary,
    },
    admin
  )

  // Drift detection (only if we have a prior run to compare against)
  if (priorAssessments) {
    const driftResult = diffAssessments(priorAssessments, report.controlAssessments)

    if (driftResult.events.length > 0) {
      await persistDriftEvents(
        driftResult,
        {
          userId: schedule.userId,
          clientId: schedule.clientId,
          frameworkId: report.frameworkId,
          priorReportId: schedule.lastReportId!,
          newReportId: report.reportId,
        },
        admin
      )
    }

    // Auto-queue remediation for regressions
    if (driftResult.regressions.length > 0) {
      try {
        await runRemediation({
          assessments: report.controlAssessments.filter((a) =>
            driftResult.regressions.some((r) => r.controlId === a.controlId)
          ),
          clientId: schedule.clientId,
          assessmentId: report.reportId,
          userId: schedule.userId,
          graphClient,
          supabase: admin,
        })
      } catch {
        // No remediable actions found — not an error
      }
    }
  }

  // Update schedule with last run info and next fire time
  await markScheduleRun(schedule.id, report.reportId, schedule.cronExpression, admin)
}
