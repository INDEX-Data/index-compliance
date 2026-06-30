// =============================================================================
// INDEX ATLAS — M365 connector: OAuth callback (admin-consent return)
//
// GET /api/connectors/m365/callback?tenant=<id>&admin_consent=True&state=<csrf>
//
// Validates and consumes the CSRF state, resolves the consented tenant, confirms
// a token can actually be minted against it (healthcheck), then upserts the
// connector_grants row. For M365 we store ONLY the tenant id — no token, no
// secret. On any failure we redirect back to the integrations page with an error
// message instead of leaking internals.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnector } from '@src/connectors/index.js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function redirectToIntegrations(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/integrations', request.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

/**
 * Resolve the client row a grant attaches to. For a "Connect a new tenant" flow
 * (no pre-existing clientId) we reuse an existing client for this tenant if one
 * is found, otherwise create a fresh OAuth client row (tenant id only — no
 * per-customer secret; relies on migration 007 making client_secret nullable).
 */
async function resolveOrCreateClient(
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  tenantId: string,
  displayName?: string
): Promise<string> {
  // Reuse if a grant already references this tenant for this user.
  const { data: existingGrant } = await admin
    .from('connector_grants')
    .select('client_id')
    .eq('user_id', userId)
    .eq('platform', 'm365')
    .eq('external_tenant_id', tenantId)
    .limit(1)
  if (existingGrant?.[0]?.client_id) return existingGrant[0].client_id

  // Reuse a client row already carrying this tenant id (plaintext OAuth rows).
  const { data: existingClient } = await admin
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .limit(1)
  if (existingClient?.[0]?.id) return existingClient[0].id

  // Create a new OAuth client for the consented tenant.
  const { data: created, error } = await admin
    .from('clients')
    .insert({
      user_id: userId,
      name: displayName || 'Microsoft 365',
      external_id: tenantId,
      tenant_id: tenantId,
    })
    .select('id')
    .single()
  if (error || !created) {
    throw new Error('Failed to create client for the connected tenant')
  }
  return created.id
}

export async function GET(request: NextRequest) {
  const admin = getAdminClient()
  const sp = request.nextUrl.searchParams
  const state = sp.get('state')

  try {
    if (!state) {
      return redirectToIntegrations(request, { m365: 'error', reason: 'missing_state' })
    }

    // ── Validate + consume the CSRF state ────────────────────────────────────
    const { data: stateRow } = await admin
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .maybeSingle()

    // Always consume the state (single-use), regardless of outcome.
    await admin.from('oauth_states').delete().eq('state', state)

    if (!stateRow || stateRow.platform !== 'm365') {
      return redirectToIntegrations(request, { m365: 'error', reason: 'invalid_state' })
    }
    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      return redirectToIntegrations(request, { m365: 'error', reason: 'expired_state' })
    }

    const connector = getConnector('m365')
    if (!connector) {
      return redirectToIntegrations(request, { m365: 'error', reason: 'connector_missing' })
    }

    // ── Resolve the consented tenant from the provider params ────────────────
    const grant = await connector.oauth.handleCallback({
      params: sp,
      redirectUri: stateRow.redirect_uri,
    })

    // ── Confirm we can actually mint a token for this tenant ─────────────────
    const session = connector.createSession({
      clientId: stateRow.client_id ?? '',
      platform: 'm365',
      grantType: 'app_consent',
      externalTenantId: grant.externalTenantId,
      scopes: grant.scopes,
      status: 'connected',
      consentedTier: stateRow.tier,
    })
    const health = await session.healthcheck()

    // Don't create a client or grant for a tenant we can't actually reach.
    if (!health.ok) {
      return redirectToIntegrations(request, { m365: 'error', reason: 'healthcheck_failed' })
    }

    // ── Resolve (or create) the client this grant attaches to ────────────────
    let effectiveClientId: string
    try {
      effectiveClientId = stateRow.client_id
        ? stateRow.client_id
        : await resolveOrCreateClient(
            admin,
            stateRow.user_id,
            grant.externalTenantId!,
            health.displayName
          )
    } catch {
      return redirectToIntegrations(request, { m365: 'error', reason: 'client_create_failed' })
    }

    // ── Upsert the grant (no token stored for app_consent) ───────────────────
    const { error: upsertErr } = await admin.from('connector_grants').upsert(
      {
        user_id: stateRow.user_id,
        client_id: effectiveClientId,
        platform: 'm365',
        grant_type: 'app_consent',
        external_tenant_id: grant.externalTenantId,
        scopes: grant.scopes,
        consented_tier: stateRow.tier,
        status: 'connected',
        error_message: null,
        last_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,platform' }
    )
    if (upsertErr) {
      return redirectToIntegrations(request, { m365: 'error', reason: 'persist_failed' })
    }

    return redirectToIntegrations(request, {
      m365: 'connected',
      tier: stateRow.tier,
      client: effectiveClientId,
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 120) : 'unexpected'
    return redirectToIntegrations(request, { m365: 'error', reason })
  }
}
