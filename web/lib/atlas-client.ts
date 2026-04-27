// =============================================================================
// INDEX ATLAS — Shared Graph Client resolver for web routes
// Replaces the repeated "fetch client → decrypt → create GraphClient" pattern
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { GraphClient } from '@src/services/graph-client.js'
import { decryptIfNeeded } from '@/lib/crypto'
import env from '@/lib/env'

function getAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Resolves a GraphClient for a given user + optional client ID.
 * If clientId is omitted, returns the first client row for the user.
 * Throws with a user-friendly message if not found.
 */
export async function resolveGraphClient(userId: string, clientId?: string) {
  const admin = getAdminClient()

  const { data, error } = clientId
    ? await admin.from('clients').select('*').eq('id', clientId).eq('user_id', userId).single()
    : await admin.from('clients').select('*').eq('user_id', userId).limit(1).single()

  if (error || !data) {
    throw new Error(
      clientId ? 'Client not found' : 'No M365 tenant connected. Please add a client first.'
    )
  }

  const graphClient = new GraphClient({
    tenantId: decryptIfNeeded(data.tenant_id),
    clientId: decryptIfNeeded(data.client_id),
    clientSecret: decryptIfNeeded(data.client_secret),
    scopes: ['https://graph.microsoft.com/.default'],
  })

  return { graphClient, client: data }
}
