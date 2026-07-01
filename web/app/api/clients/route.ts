import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { decryptIfNeeded } from '@/lib/crypto'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

function maskSecret(secret: string | null | undefined): string {
  // OAuth/admin-consent clients have no per-customer secret.
  if (!secret) return ''
  const plain = decryptIfNeeded(secret)
  if (plain.length <= 4) return '\u2022'.repeat(plain.length)
  return plain.slice(0, 4) + '\u2022'.repeat(Math.min(plain.length - 4, 20))
}

function formatClient(row: any) {
  return {
    id: row.id,
    name: row.name,
    tenantId: row.tenant_id ? decryptIfNeeded(row.tenant_id) : '',
    clientId: row.client_id ? decryptIfNeeded(row.client_id) : '',
    clientSecret: maskSecret(row.client_secret),
    addedAt: row.added_at,
    notes: row.notes,
  }
}

// ── GET: List clients ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await getAdmin()
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json((data ?? []).map(formatClient))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list clients' },
      { status: 500 }
    )
  }
}

// POST (manual add-client) and PATCH (edit credentials) were removed. Environments
// are created via OAuth admin-consent in the connector callback
// (web/app/api/connectors/m365/callback), never by posting a client secret here.
// Only GET (list) and DELETE (disconnect) remain.

// ── DELETE: Disconnect environment ────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const { error } = await getAdmin().from('clients').delete().eq('id', id).eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete client' },
      { status: 500 }
    )
  }
}
