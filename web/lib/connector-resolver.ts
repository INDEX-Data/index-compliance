// =============================================================================
// INDEX ATLAS — Connector resolver (M365): grant-first, legacy-fallback
//
// Resolves a GraphClient for a (user, client) by PREFERRING a real OAuth grant
// (connector_grants, admin-consent → app-only tokens minted from OUR secret) and
// FALLING BACK to the legacy per-customer client_secret stored on the clients
// row. This is the load-bearing migration seam: every tenant connected the old
// way keeps working untouched until it re-consents via the OAuth flow.
//
// `source` lets callers/telemetry see which path was taken. The legacy branch is
// byte-for-byte the previous resolveGraphClient behaviour.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { GraphClient } from '@src/services/graph-client.js'
import { graphClientFromAppConsent } from '@src/connectors/m365/graph-factory.js'
import { decryptIfNeeded } from '@/lib/crypto'
import env from '@/lib/env'

export type ConnectorSource = 'grant' | 'legacy'

export interface ResolvedM365 {
  graphClient: GraphClient
  client: any // the clients row
  source: ConnectorSource
}

function getAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Resolve an M365 GraphClient for a user + optional client id.
 * Prefers a connected admin-consent grant; otherwise uses the legacy secret.
 * Throws the same user-facing messages as before if no client is found.
 */
export async function resolveM365Session(userId: string, clientId?: string): Promise<ResolvedM365> {
  const admin = getAdminClient()

  const { data: client, error } = clientId
    ? await admin.from('clients').select('*').eq('id', clientId).eq('user_id', userId).single()
    : await admin.from('clients').select('*').eq('user_id', userId).limit(1).single()

  if (error || !client) {
    throw new Error(
      clientId ? 'Client not found' : 'No M365 tenant connected. Please add a client first.'
    )
  }

  // ── Prefer a real OAuth grant ──────────────────────────────────────────────
  const { data: grant } = await admin
    .from('connector_grants')
    .select('grant_type, external_tenant_id, status')
    .eq('client_id', client.id)
    .eq('platform', 'm365')
    .maybeSingle()

  if (
    grant &&
    grant.status === 'connected' &&
    grant.grant_type === 'app_consent' &&
    grant.external_tenant_id
  ) {
    return {
      graphClient: graphClientFromAppConsent(grant.external_tenant_id),
      client,
      source: 'grant',
    }
  }

  // ── Legacy fallback: per-customer secret on the clients row ─────────────────
  const graphClient = new GraphClient({
    tenantId: decryptIfNeeded(client.tenant_id),
    clientId: decryptIfNeeded(client.client_id),
    clientSecret: decryptIfNeeded(client.client_secret),
    scopes: ['https://graph.microsoft.com/.default'],
  })

  return { graphClient, client, source: 'legacy' }
}
