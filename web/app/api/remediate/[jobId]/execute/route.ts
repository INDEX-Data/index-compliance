// POST /api/remediate/[jobId]/execute — execute approved actions
import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { resolveGraphClient } from '@/lib/atlas-client'
import { executeSingleAction, dryRunSingleAction } from '@src/agents/action-executor.js'
import type { AgentActionRow } from '@src/agents/action-executor.js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params
  const body = await request.json().catch(() => ({}))
  const { actionIds, dryRun = false } = body as { actionIds?: string[]; dryRun?: boolean }
  if (!actionIds?.length) {
    return NextResponse.json({ error: 'actionIds array is required' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Verify job and load the assessment_id
  const { data: job, error: jobError } = await admin
    .from('remediation_jobs')
    .select('id, client_id, assessment_id, user_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Load the approved action rows
  const { data: actionRows, error: actionsError } = await admin
    .from('agent_actions')
    .select('*')
    .in('id', actionIds)
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .eq('status', dryRun ? 'pending_approval' : 'approved')

  if (actionsError || !actionRows?.length) {
    return NextResponse.json({ error: 'No eligible actions found' }, { status: 400 })
  }

  const { graphClient } = await resolveGraphClient(user.id, job.client_id)
  const approvedBy = user.email ?? user.id

  // Execute in background so the response returns immediately
  after(async () => {
    for (const row of actionRows as AgentActionRow[]) {
      try {
        if (dryRun) {
          await dryRunSingleAction(row, graphClient, admin)
        } else {
          await executeSingleAction(row, graphClient, approvedBy, job.assessment_id, admin)
        }
      } catch {
        // Error already written to agent_actions row by audit logger
      }
    }

    // Check if all actions are complete and update job status
    if (!dryRun) {
      const { data: remaining } = await admin
        .from('agent_actions')
        .select('status')
        .eq('job_id', jobId)
        .not('status', 'in', '("complete","failed","skipped","rolled_back")')

      if (!remaining?.length) {
        const { data: anyFailed } = await admin
          .from('agent_actions')
          .select('id')
          .eq('job_id', jobId)
          .eq('status', 'failed')
          .limit(1)

        await admin
          .from('remediation_jobs')
          .update({
            status: anyFailed?.length ? 'failed' : 'complete',
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId)
      }
    }
  })

  return NextResponse.json({ queued: actionRows.length, dryRun })
}
