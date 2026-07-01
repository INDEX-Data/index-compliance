// =============================================================================
// INDEX ATLAS — M365 GraphClient factory (admin-consent / app-only)
//
// Builds a GraphClient for a customer tenant using OUR multi-tenant app's creds
// (AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, server-side env) against the customer's
// tenant id. This is the post-OAuth path: the customer consented to our app, so
// the app-only client-credentials grant against their tenant succeeds with NO
// per-customer secret. Keeps env access out of graph-client.ts.
// =============================================================================

import { GraphClient } from '../../services/graph-client.js'

/**
 * Create an app-only GraphClient for `tenantId` using ATLAS's own multi-tenant
 * app credentials. Throws if the platform app creds aren't configured.
 */
export function graphClientFromAppConsent(tenantId: string): GraphClient {
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing AZURE_CLIENT_ID / AZURE_CLIENT_SECRET. The ATLAS multi-tenant app ' +
        'credentials must be configured server-side to mint app-only tokens for a consented tenant.'
    )
  }

  return new GraphClient({
    tenantId,
    clientId,
    clientSecret,
    scopes: ['https://graph.microsoft.com/.default'],
  })
}
