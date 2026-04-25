// POST /api/remediate — kick off remediation planning for a completed assessment
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { resolveGraphClient } from '@/lib/atlas-client'
import { runRemediation } from '@src/operations/index.js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { assessmentId, clientId } = body as { assessmentId?: string; clientId?: string }
  if (!assessmentId || !clientId) {
    return NextResponse.json({ error: 'assessmentId and clientId are required' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Load the assessment report to get control assessments
  const { data: report, error: reportError } = await admin
    .from('reports')
    .select('data, client_id')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
  }

  const { graphClient } = await resolveGraphClient(user.id, clientId)

  try {
    const result = await runRemediation({
      assessments: (report.data as any).controlAssessments ?? [],
      clientId,
      assessmentId,
      userId: user.id,
      graphClient,
      supabase: admin,
    })

    return NextResponse.json({ jobId: result.jobId, actionCount: result.actions.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Planning failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  const admin = getAdminClient()
  const query = admin
    .from('remediation_jobs')
    .select('*, agent_actions(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (clientId) query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
