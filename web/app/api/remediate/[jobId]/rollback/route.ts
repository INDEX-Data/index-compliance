// POST /api/remediate/[jobId]/rollback — rollback a single completed action (24h window)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { resolveGraphClient } from '@/lib/atlas-client'
import { rollbackSingleAction } from '@src/agents/action-executor.js'
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
  const { actionId } = body as { actionId?: string }
  if (!actionId) return NextResponse.json({ error: 'actionId is required' }, { status: 400 })

  const admin = getAdminClient()

  const { data: job, error: jobError } = await admin
    .from('remediation_jobs')
    .select('client_id, assessment_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { data: actionRow, error: actionError } = await admin
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .eq('status', 'complete')
    .single()

  if (actionError || !actionRow) {
    return NextResponse.json({ error: 'Action not found or not eligible for rollback' }, { status: 404 })
  }

  const { graphClient } = await resolveGraphClient(user.id, job.client_id)

  try {
    await rollbackSingleAction(
      actionRow as AgentActionRow,
      graphClient,
      user.email ?? user.id,
      job.assessment_id,
      admin
    )
    return NextResponse.json({ rolledBack: actionId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rollback failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
