// POST /api/remediate/[jobId]/approve — approve specific actions for execution
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'

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
  const { actionIds } = body as { actionIds?: string[] }
  if (!actionIds?.length) {
    return NextResponse.json({ error: 'actionIds array is required' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Verify job belongs to this user
  const { data: job, error: jobError } = await admin
    .from('remediation_jobs')
    .select('id, status')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await admin
    .from('agent_actions')
    .update({
      status: 'approved',
      approved_by: user.email ?? user.id,
      approved_at: now,
      updated_at: now,
    })
    .in('id', actionIds)
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .in('status', ['pending_approval', 'planned'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approved: actionIds.length })
}
