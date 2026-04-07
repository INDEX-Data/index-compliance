import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { encrypt, decryptIfNeeded } from '@/lib/crypto'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUser() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function maskSecret(secret: string): string {
  const plain = decryptIfNeeded(secret)
  if (plain.length <= 4) return '\u2022'.repeat(plain.length)
  return plain.slice(0, 4) + '\u2022'.repeat(Math.min(plain.length - 4, 20))
}

function formatClient(row: any) {
  return {
    id: row.id,
    name: row.name,
    tenantId: decryptIfNeeded(row.tenant_id),
    clientId: decryptIfNeeded(row.client_id),
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

// ── POST: Add client ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, tenantId, clientId, clientSecret } = body

    if (!tenantId || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'tenantId, clientId, and clientSecret are required' },
        { status: 400 }
      )
    }

    const { data: row, error } = await getAdmin()
      .from('clients')
      .insert({
        user_id: user.id,
        external_id: crypto.randomUUID(),
        name: name ?? 'Default Tenant',
        tenant_id: encrypt(tenantId),
        client_id: encrypt(clientId),
        client_secret: encrypt(clientSecret),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(formatClient(row))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add client' },
      { status: 500 }
    )
  }
}

// ── PATCH: Update client ──────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, name, tenantId, clientId, clientSecret } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name
    if (tenantId !== undefined) update.tenant_id = encrypt(tenantId)
    if (clientId !== undefined) update.client_id = encrypt(clientId)
    if (clientSecret !== undefined) update.client_secret = encrypt(clientSecret)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: row, error } = await getAdmin()
      .from('clients')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(formatClient(row))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update client' },
      { status: 500 }
    )
  }
}

// ── DELETE: Remove client ─────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const { error } = await getAdmin()
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete client' },
      { status: 500 }
    )
  }
}
