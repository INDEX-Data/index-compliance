import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { decryptIfNeeded } from '@/lib/crypto'

// ── Inline Graph client (avoids .js import issues from src/) ────────────────
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

async function testGraphConnection(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ ok: true; tenantName: string; domain?: string } | { ok: false; error: string }> {
  // 1. Get OAuth token
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  })
  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    return { ok: false, error: `Authentication failed (${tokenRes.status}): ${err}` }
  }
  const { access_token } = await tokenRes.json() as { access_token: string }

  // 2. Query /organization
  const orgRes = await fetch(`${GRAPH_API_BASE}/organization?$select=displayName,verifiedDomains`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!orgRes.ok) {
    const err = await orgRes.text()
    return { ok: false, error: `Graph API error (${orgRes.status}): ${err}` }
  }
  const data = await orgRes.json() as any
  const org = Array.isArray(data.value) ? data.value[0] : data
  const tenantName = org?.displayName ?? 'Unknown'
  const domain = (org?.verifiedDomains as any[])?.find((d: any) => d.isDefault)?.name

  return { ok: true, tenantName, domain }
}

// ── Route Handler ───────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    let tenantId: string, clientId: string, clientSecret: string

    if (body.clientId && !body.tenantId) {
      // Mode A: Testing an existing client by its DB ID
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: client, error } = await admin
        .from('clients')
        .select('tenant_id, client_id, client_secret')
        .eq('id', body.clientId)
        .eq('user_id', user.id)
        .single()
      if (error || !client) {
        return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 })
      }
      tenantId = decryptIfNeeded(client.tenant_id)
      clientId = decryptIfNeeded(client.client_id)
      clientSecret = decryptIfNeeded(client.client_secret)
    } else {
      // Mode B: Testing raw credentials
      tenantId = body.tenantId
      clientId = body.clientId
      clientSecret = body.clientSecret
      if (!tenantId || !clientId || !clientSecret) {
        return NextResponse.json(
          { ok: false, error: 'tenantId, clientId, and clientSecret are required' },
          { status: 400 }
        )
      }
    }

    const result = await testGraphConnection(tenantId, clientId, clientSecret)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed'
    return NextResponse.json({ ok: false, error: message }, { status: 200 })
  }
}
