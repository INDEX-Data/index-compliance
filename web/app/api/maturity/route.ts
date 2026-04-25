// GET /api/maturity?clientId=&frameworkId=&limit=
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { getMaturityTimeSeries, getClientMaturitySummary } from '@src/operations/index.js'

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
  const frameworkId = searchParams.get('frameworkId')
  const limit = parseInt(searchParams.get('limit') ?? '24', 10)

  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const admin = getAdminClient()

  if (frameworkId) {
    const series = await getMaturityTimeSeries(clientId, frameworkId, user.id, admin, limit)
    return NextResponse.json(series)
  }

  const summary = await getClientMaturitySummary(clientId, user.id, admin)
  return NextResponse.json(summary)
}
