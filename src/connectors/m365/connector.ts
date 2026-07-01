// =============================================================================
// INDEX ATLAS — Microsoft 365 Connector (admin-consent / app-only)
//
// OAuth strategy = app_consent. The customer's Global Admin consents to OUR
// multi-tenant app once; the callback returns only the tenant id (admin_consent
// = True), no token. Runtime tokens are minted on demand by graph-factory using
// our server-side secret. The session wraps the EXISTING GraphClient unchanged,
// so every read method + post/patch/delete + verifyConnection keeps working.
// =============================================================================

import type { Connector, ConnectorSession, OAuthStrategy, StoredGrant } from '../types.js'
import { graphClientFromAppConsent } from './graph-factory.js'
import { GraphClient } from '../../services/graph-client.js'

const AUTHORITY = 'https://login.microsoftonline.com'

// Read tier consents the app's configured Graph *application* permissions via
// `.default`. Write access is requested as a separate consent round; the tier is
// recorded on the grant so the agentic layer only exposes write tools when a
// write grant exists. (True per-permission split is configured on the app
// registration's app-roles in Entra.)
const GRAPH_DEFAULT_SCOPE = 'https://graph.microsoft.com/.default'

const m365OAuth: OAuthStrategy = {
  kind: 'app_consent',

  buildAuthorizeUrl({ redirectUri, state }) {
    const clientId = process.env.AZURE_CLIENT_ID
    if (!clientId)
      throw new Error('AZURE_CLIENT_ID is not configured for the ATLAS multi-tenant app.')

    // Admin-consent endpoint (v2.0). `organizations` lets the admin pick/confirm
    // their tenant; Microsoft returns the resolved tenant id on the callback.
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: GRAPH_DEFAULT_SCOPE,
    })
    return `${AUTHORITY}/organizations/v2.0/adminconsent?${params.toString()}`
  },

  async handleCallback({ params }) {
    // Microsoft returns: tenant, admin_consent=True, state — or error/error_description.
    const error = params.get('error')
    if (error) {
      const desc = params.get('error_description') ?? ''
      throw new Error(`Microsoft admin consent failed: ${error}. ${desc}`.trim())
    }
    const tenant = params.get('tenant')
    const adminConsent = params.get('admin_consent')
    if (!tenant || adminConsent?.toLowerCase() !== 'true') {
      throw new Error('Admin consent was not granted (missing tenant or admin_consent=True).')
    }
    return {
      grantType: 'app_consent',
      externalTenantId: tenant,
      scopes: [GRAPH_DEFAULT_SCOPE],
    }
  },
}

/** Session backed by the existing GraphClient; exposes it for read/write reuse. */
export class M365Session implements ConnectorSession {
  readonly platform = 'm365'
  readonly graphClient: GraphClient

  constructor(tenantId: string) {
    this.graphClient = graphClientFromAppConsent(tenantId)
  }

  async getAccessToken(): Promise<string> {
    // GraphClient manages its own app-only token internally; expose a probe path
    // for callers that just need to confirm a token can be minted.
    await this.graphClient.verifyConnection()
    return 'ok'
  }

  async healthcheck(): Promise<{ ok: boolean; displayName?: string; detail?: string }> {
    try {
      const { displayName } = await this.graphClient.verifyConnection()
      return { ok: true, displayName }
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const m365Connector: Connector = {
  platform: 'm365',
  displayName: 'Microsoft 365',
  oauth: m365OAuth,
  scopes: [
    {
      value: GRAPH_DEFAULT_SCOPE,
      tier: 'read',
      description: 'Read Microsoft Graph compliance evidence (app-only).',
    },
    {
      value: GRAPH_DEFAULT_SCOPE,
      tier: 'write',
      description: 'Apply approved remediations (Conditional Access, auth methods, etc.).',
    },
  ],
  reads: [
    {
      id: 'graph.query',
      description: 'Query Microsoft Graph (v1.0 / beta).',
      scopesRequired: [GRAPH_DEFAULT_SCOPE],
    },
  ],
  writes: [
    {
      id: 'graph.write',
      description: 'POST/PATCH/DELETE Graph resources for approved remediations.',
      scopesRequired: [GRAPH_DEFAULT_SCOPE],
      riskLevel: 'high',
      supportsDryRun: true,
    },
  ],
  createSession(grant: StoredGrant): ConnectorSession {
    if (!grant.externalTenantId) {
      throw new Error('M365 grant is missing externalTenantId; cannot create a session.')
    }
    return new M365Session(grant.externalTenantId)
  },
}
