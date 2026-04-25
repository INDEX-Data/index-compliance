// GET /api/schedules?clientId=  — list schedules for a client
// POST /api/schedules           — create or update a schedule
// DELETE /api/schedules?id=     — delete a schedule
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { upsertSchedule } from '@src/operations/index.js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  const admin = getAdminClient()
  const query = admin
    .from('assessment_schedules')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (clientId) query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { clientId, frameworkId, cronExpression, enabled } = body as {
    clientId?: string
    frameworkId?: string
    cronExpression?: string
    enabled?: boolean
  }
  if (!clientId || !frameworkId) {
    return NextResponse.json({ error: 'clientId and frameworkId are required' }, { status: 400 })
  }

  const admin = getAdminClient()
  try {
    const schedule = await upsertSchedule(
      { userId: user.id, clientId, frameworkId, cronExpression, enabled },
      admin
    )
    return NextResponse.json(schedule)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save schedule'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = getAdminClient()
  const { error } = await admin
    .from('assessment_schedules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
