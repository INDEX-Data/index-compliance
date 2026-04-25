// GET /api/drift?clientId=&limit=&direction=
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

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const direction = searchParams.get('direction')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const admin = getAdminClient()
  const query = admin
    .from('drift_events')
    .select('*')
    .eq('client_id', clientId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (direction) query.eq('direction', direction)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  // Acknowledge a drift event
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = getAdminClient()
  const { error } = await admin
    .from('drift_events')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ acknowledged: id })
}
