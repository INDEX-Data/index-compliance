import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { encrypt } from '@/lib/crypto'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId, clientId, clientSecret, tenantName } = body

    if (!tenantId || !clientId || !clientSecret) {
      return NextResponse.json(
        { ok: false, error: 'tenantId, clientId, and clientSecret are required' },
        { status: 400 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await admin
      .from('clients')
      .insert({
        user_id: user.id,
        external_id: crypto.randomUUID(),
        name: tenantName ?? 'Default Tenant',
        tenant_id: encrypt(tenantId),
        client_id: encrypt(clientId),
        client_secret: encrypt(clientSecret),
      })

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 }
    )
  }
}
