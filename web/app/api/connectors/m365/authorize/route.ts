// =============================================================================
// INDEX ATLAS — M365 connector: OAuth authorize (admin-consent kickoff)
//
// GET /api/connectors/m365/authorize?clientId=<uuid>&tier=read|write
//
// Logged-in path (post-onboarding "Reconnect with Microsoft"). Generates a CSRF
// `state`, persists it in oauth_states, and 302s the admin to Microsoft's
// admin-consent endpoint for OUR multi-tenant app. Write access is requested as
// a separate round (tier=write) so it is consented independently of read.
//
// Requires the ATLAS multi-tenant Entra app to be registered and AZURE_CLIENT_ID
// configured (see docs/connectors-m365-setup.md). Until then this 302 will land
// on Microsoft's "app not found / unverified" page rather than a consent screen.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { getConnector } from '@src/connectors/index.js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = request.nextUrl.searchParams.get('clientId')
    const tier = request.nextUrl.searchParams.get('tier') === 'write' ? 'write' : 'read'

    const admin = getAdminClient()

    // Two modes:
    //  • clientId present  → "Reconnect"/"Enable remediation" for an existing
    //    client; verify ownership before starting consent.
    //  • clientId absent   → "Connect a new tenant"; the callback creates the
    //    client row from the consented tenant. Nothing to verify yet.
    if (clientId) {
      const { data: client, error: clientErr } = await admin
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .single()
      if (clientErr || !client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
    }

    const connector = getConnector('m365')
    if (!connector) {
      return NextResponse.json({ error: 'M365 connector not registered' }, { status: 500 })
    }

    const origin = request.nextUrl.origin
    const redirectUri = `${origin}/api/connectors/m365/callback`
    const state = randomBytes(32).toString('hex')

    const { error: stateErr } = await admin.from('oauth_states').insert({
      state,
      user_id: user.id,
      client_id: clientId,
      platform: 'm365',
      tier,
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    })
    if (stateErr) {
      return NextResponse.json({ error: 'Failed to start consent flow' }, { status: 500 })
    }

    const authorizeUrl = connector.oauth.buildAuthorizeUrl({ redirectUri, state, tier })
    return NextResponse.redirect(authorizeUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
