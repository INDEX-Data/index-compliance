import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { decryptIfNeeded } from '@/lib/crypto'

// ── Real engine imports from src/ (resolved via webpack extensionAlias) ─────
import { GraphClient } from '@src/services/graph-client.js'
import { assessControl, buildSummary } from '@src/services/compliance-engine.js'
import { cmmcL2Controls } from '@src/data/cmmc-l2-controls.js'
import {
  DIBCAC_OBJECTIVES,
} from '@src/data/dibcac-objectives.js'
import type { ComplianceControl, ControlAssessment, ObjectiveStatus, ObjectiveStatusValue, ObjectiveEvidenceSource } from '@src/types.js'

// ── Framework registry ─────────────────────────────────────────────────────

function getFrameworkControls(frameworkId: string): { name: string; controls: ComplianceControl[] } | null {
  const frameworks: Record<string, { name: string; controls: ComplianceControl[] }> = {
    'cmmc-l2': { name: 'CMMC Level 2', controls: cmmcL2Controls },
  }
  return frameworks[frameworkId] ?? null
}

// ── Map control assessment status → DIBCAC objective status ────────────────

function mapControlStatusToObjectiveStatus(
  controlStatus: ControlAssessment['status'],
  objectiveAutomation: string
): { status: ObjectiveStatusValue; evidenceSource: ObjectiveEvidenceSource } {
  if (objectiveAutomation === 'physical') {
    return { status: 'requires_physical', evidenceSource: 'none' }
  }
  if (objectiveAutomation === 'manual') {
    return { status: 'requires_manual', evidenceSource: 'none' }
  }
  switch (controlStatus) {
    case 'pass':
      return { status: 'met', evidenceSource: 'automated_graph' }
    case 'partial':
      return {
        status: objectiveAutomation === 'semi-automated' ? 'partially_met' : 'met',
        evidenceSource: 'automated_graph',
      }
    case 'fail':
      return { status: 'not_met', evidenceSource: 'automated_graph' }
    case 'not_assessed':
    case 'not_applicable':
    default:
      return { status: 'not_assessed', evidenceSource: 'inherited_from_control' }
  }
}

// ── Supabase admin client (reused in after() callback) ─────────────────────

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const frameworkId = body.frameworkId
    const clientId = body.clientId

    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId is required' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Look up client credentials
    let clientRow: any
    if (clientId) {
      const { data, error } = await admin
        .from('clients').select('*').eq('id', clientId).eq('user_id', user.id).single()
      if (error || !data) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
      clientRow = data
    } else {
      const { data, error } = await admin
        .from('clients').select('*').eq('user_id', user.id).limit(1).single()
      if (error || !data) {
        return NextResponse.json({ error: 'No M365 tenant connected. Please add a client first.' }, { status: 400 })
      }
      clientRow = data
    }

    // Load framework controls
    const fw = getFrameworkControls(frameworkId)
    if (!fw || fw.controls.length === 0) {
      return NextResponse.json({ error: `Framework "${frameworkId}" not found or not yet implemented` }, { status: 400 })
    }

    // Create assessment job row
    const { data: job, error: jobErr } = await admin
      .from('assessment_jobs')
      .insert({
        user_id: user.id,
        client_id: clientId ?? clientRow.id,
        framework_id: frameworkId,
        status: 'running',
        total_controls: fw.controls.length,
        current_index: 0,
        progress: [],
      })
      .select()
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Failed to create assessment job' }, { status: 500 })
    }

    const jobId = job.id

    // ── Schedule the actual assessment to run AFTER the response is sent ────
    // This lets the client receive jobId instantly and subscribe to Realtime
    // before any controls are assessed. Each control update triggers a
    // Realtime push so the frontend shows live progress.
    after(async () => {
      const bg = getAdminClient()

      const graphClient = new GraphClient({
        tenantId: decryptIfNeeded(clientRow.tenant_id),
        clientId: decryptIfNeeded(clientRow.client_id),
        clientSecret: decryptIfNeeded(clientRow.client_secret),
        scopes: ['https://graph.microsoft.com/.default'],
      })

      const assessments: ControlAssessment[] = []
      const progress: any[] = []

      try {
        for (let i = 0; i < fw.controls.length; i++) {
          const control = fw.controls[i]
          try {
            const assessment = await assessControl(control, graphClient)
            assessments.push(assessment)
            progress.push({
              controlId: control.controlId,
              title: control.title,
              status: assessment.status,
              done: true,
            })
          } catch (err) {
            assessments.push({
              controlId: control.controlId,
              controlTitle: control.title,
              frameworkId: control.frameworkId,
              family: control.family,
              status: 'not_assessed',
              evidenceCollected: [],
              findings: [`Error: ${err instanceof Error ? err.message : String(err)}`],
              recommendations: [],
              assessedAt: new Date().toISOString(),
            })
            progress.push({
              controlId: control.controlId,
              title: control.title,
              status: 'not_assessed',
              done: true,
            })
          }

          // Update job progress → triggers Supabase Realtime for the frontend
          await bg.from('assessment_jobs').update({
            current_index: i + 1,
            current_title: control.title,
            progress,
            updated_at: new Date().toISOString(),
          }).eq('id', jobId)
        }

        // ── Build report ─────────────────────────────────────────────────
        const summary = buildSummary(assessments)
        const reportId = `RPT-${Date.now()}`
        const report = {
          reportId,
          tenantId: decryptIfNeeded(clientRow.tenant_id),
          tenantDisplayName: clientRow.name,
          frameworkId,
          frameworkName: fw.name,
          generatedAt: new Date().toISOString(),
          generatedBy: 'Atlas Compliance Assessment Engine v1.0',
          summary,
          controlAssessments: assessments,
          clientId: clientRow.id,
          clientName: clientRow.name,
        }

        // ── Map 320 DIBCAC objectives to control results ─────────────────
        const assessmentMap = new Map<string, ControlAssessment>()
        for (const a of assessments) {
          assessmentMap.set(a.controlId, a)
        }

        const objectiveStatuses: ObjectiveStatus[] = DIBCAC_OBJECTIVES.map((obj) => {
          const controlAssessment = assessmentMap.get(obj.controlId)
          if (!controlAssessment) {
            return {
              objectiveId: obj.objectiveId,
              status: obj.automation === 'physical' ? 'requires_physical' as const
                : obj.automation === 'manual' ? 'requires_manual' as const
                : 'not_assessed' as const,
              evidenceSource: 'none' as const,
              assessedAt: new Date().toISOString(),
              assessedBy: 'automated',
            }
          }
          const mapped = mapControlStatusToObjectiveStatus(controlAssessment.status, obj.automation)
          return {
            objectiveId: obj.objectiveId,
            status: mapped.status,
            evidenceSource: mapped.evidenceSource,
            assessedAt: new Date().toISOString(),
            assessedBy: 'automated',
          }
        })

        // DIBCAC summary
        const dibcacSummary: any = {
          total: objectiveStatuses.length,
          met: objectiveStatuses.filter(o => o.status === 'met').length,
          partiallyMet: objectiveStatuses.filter(o => o.status === 'partially_met').length,
          notMet: objectiveStatuses.filter(o => o.status === 'not_met').length,
          requiresManual: objectiveStatuses.filter(o => o.status === 'requires_manual').length,
          requiresPhysical: objectiveStatuses.filter(o => o.status === 'requires_physical').length,
          notAssessed: objectiveStatuses.filter(o => o.status === 'not_assessed').length,
        }
        const assessableObjectives = dibcacSummary.total - dibcacSummary.requiresPhysical
        dibcacSummary.coveragePercentage = assessableObjectives > 0
          ? Math.round(((dibcacSummary.met + dibcacSummary.partiallyMet * 0.5) / assessableObjectives) * 100)
          : 0

        const fullReport = { ...report, objectiveStatuses, dibcacSummary }

        // Save report
        await bg.from('reports').insert({
          id: reportId,
          user_id: user.id,
          client_id: clientRow.id,
          framework_id: frameworkId,
          data: fullReport,
          generated_at: fullReport.generatedAt,
        })

        // Save objective statuses (if table exists)
        try {
          const objectiveRows = objectiveStatuses.map(os => ({
            report_id: reportId,
            objective_id: os.objectiveId,
            status: os.status,
            evidence_source: os.evidenceSource,
            attestation_text: os.attestationText ?? null,
            document_ref: os.documentRef ?? null,
            assessed_at: os.assessedAt,
            assessed_by: os.assessedBy ?? 'automated',
          }))
          await bg.from('objective_statuses').insert(objectiveRows)
        } catch {
          // Table may not exist yet
        }

        // Mark job complete
        await bg.from('assessment_jobs').update({
          status: 'complete',
          report_id: reportId,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)

      } catch (err) {
        // Mark job as errored so frontend shows the failure
        await bg.from('assessment_jobs').update({
          status: 'error',
          error_message: err instanceof Error ? err.message : 'Assessment failed unexpectedly',
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
      }
    })

    // ── Return immediately so client can subscribe to Realtime ─────────────
    return NextResponse.json({ ok: true, jobId })

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Assessment failed' },
      { status: 500 }
    )
  }
}
