// =============================================================================
// INDEX DSaaS - Microsoft Graph API Client
// =============================================================================

import { GRAPH_API_BASE, GRAPH_API_BETA } from '../constants.js'
import type { GraphClientConfig, GraphApiResponse } from '../types.js'
import type { WriteOpts } from '../agents/types.js'

/**
 * Thrown when the OAuth token request fails for a CREDENTIAL/TENANT/APP reason
 * — i.e. the connection itself is broken (invalid or expired secret, wrong app
 * or tenant), not a per-control permission gap. Distinguishing this lets callers
 * fail the whole run loudly with one actionable message instead of cascading
 * into a report full of `not_assessed` controls.
 */
export class GraphAuthError extends Error {
  /** Short machine code (e.g. "AADSTS7000215", "invalid_client"). */
  readonly code: string
  /** Plain-English message safe to show an end user. */
  readonly userMessage: string
  /** Raw token-endpoint response body, for logs/diagnostics. */
  readonly rawBody: string

  constructor(code: string, userMessage: string, rawBody: string) {
    super(`${code}: ${userMessage}`)
    this.name = 'GraphAuthError'
    this.code = code
    this.userMessage = userMessage
    this.rawBody = rawBody
  }
}

/**
 * Inspect a failed token-endpoint response body and, if it names a known
 * credential/tenant/app failure, return a GraphAuthError. Returns null for
 * anything else (transient, throttling, unknown) so the caller falls back to
 * the generic error path.
 */
export function classifyTokenError(status: number, body: string): GraphAuthError | null {
  // Azure returns AADSTS error codes in the body; match the credential-class ones.
  const AUTH_CODES: Record<string, string> = {
    AADSTS7000215:
      "Your Microsoft 365 connection's client secret is invalid. Reconnect this tenant under Clients and paste a new secret Value (not the Secret ID).",
    AADSTS7000222:
      "Your Microsoft 365 connection's client secret has expired. Create a new secret in Azure and reconnect this tenant under Clients.",
    AADSTS700016:
      'The Azure app registration for this connection was not found in the tenant. Verify the Client ID and reconnect this tenant under Clients.',
    AADSTS90002:
      'The Microsoft 365 tenant for this connection was not found. Verify the Tenant ID and reconnect this tenant under Clients.',
    AADSTS700024:
      "Your Microsoft 365 connection's credential is expired. Create a new secret in Azure and reconnect this tenant under Clients.",
  }

  for (const [code, message] of Object.entries(AUTH_CODES)) {
    if (body.includes(code)) return new GraphAuthError(code, message, body)
  }

  // Fall back to the OAuth error name for credential-class failures.
  if (status === 401 && body.includes('invalid_client')) {
    return new GraphAuthError(
      'invalid_client',
      'Your Microsoft 365 connection credentials were rejected. Reconnect this tenant under Clients with a fresh client secret.',
      body
    )
  }

  return null
}

export class GraphClient {
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null
  private config: GraphClientConfig

  constructor(config: GraphClientConfig) {
    this.config = config
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  private async authenticate(): Promise<string> {
    // If we have a valid token, reuse it
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })

    // Support both client secret and certificate auth
    if (this.config.clientSecret) {
      body.append('client_secret', this.config.clientSecret)
    }
    // Certificate-based auth would use client_assertion here

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      // Credential/tenant/app failures get a typed, user-actionable error so
      // callers can abort the whole run instead of cascading into not_assessed.
      const authError = classifyTokenError(response.status, error)
      if (authError) throw authError
      throw new Error(
        `Authentication failed (${response.status}): ${error}. ` +
          `Verify TENANT_ID, CLIENT_ID, and CLIENT_SECRET are correct ` +
          `and the app registration has the required Graph API permissions.`
      )
    }

    const tokenData = (await response.json()) as { access_token: string; expires_in: number }
    this.accessToken = tokenData.access_token
    this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000 - 60000) // 1 min buffer

    return this.accessToken
  }

  // -------------------------------------------------------------------------
  // API Request Methods
  // -------------------------------------------------------------------------

  async query<T = unknown>(
    endpoint: string,
    options: {
      apiVersion?: 'v1' | 'beta'
      select?: string[]
      filter?: string
      expand?: string[]
      top?: number
      orderby?: string
    } = {}
  ): Promise<GraphApiResponse<T>> {
    const token = await this.authenticate()
    const baseUrl = options.apiVersion === 'beta' ? GRAPH_API_BETA : GRAPH_API_BASE

    // Build query parameters
    const params = new URLSearchParams()
    if (options.select?.length) params.append('$select', options.select.join(','))
    if (options.filter) params.append('$filter', options.filter)
    if (options.expand?.length) params.append('$expand', options.expand.join(','))
    if (options.top) params.append('$top', options.top.toString())
    if (options.orderby) params.append('$orderby', options.orderby)

    const queryString = params.toString()
    const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual', // Required for some advanced queries
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Graph API error (${response.status}) on ${endpoint}: ${errorBody}. ` +
          `Check that the app registration has the required permissions and admin consent has been granted.`
      )
    }

    const data = (await response.json()) as GraphApiResponse<T>
    return data
  }

  async queryAll<T = unknown>(
    endpoint: string,
    options: {
      apiVersion?: 'v1' | 'beta'
      select?: string[]
      filter?: string
      expand?: string[]
      maxPages?: number
      top?: number
    } = {}
  ): Promise<T[]> {
    const allResults: T[] = []
    let nextLink: string | undefined
    let pageCount = 0
    const maxPages = options.maxPages ?? 10

    // First page
    const firstPage = await this.query<T>(endpoint, { ...options, top: options.top ?? 100 })
    allResults.push(...firstPage.value)
    nextLink = firstPage['@odata.nextLink']
    pageCount++

    // Follow pagination
    while (nextLink && pageCount < maxPages) {
      const token = await this.authenticate()
      const response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) break

      const data = (await response.json()) as GraphApiResponse<T>
      allResults.push(...data.value)
      nextLink = data['@odata.nextLink']
      pageCount++
    }

    return allResults
  }

  // -------------------------------------------------------------------------
  // Convenience methods for common compliance queries
  // -------------------------------------------------------------------------

  async getConditionalAccessPolicies(): Promise<unknown[]> {
    return this.queryAll('/identity/conditionalAccess/policies')
  }

  async getSensitivityLabels(): Promise<unknown[]> {
    return this.queryAll('/informationProtection/policy/labels')
  }

  async getDeviceCompliancePolicies(): Promise<unknown[]> {
    return this.queryAll('/deviceManagement/deviceCompliancePolicies')
  }

  async getRoleAssignments(): Promise<unknown[]> {
    return this.queryAll('/roleManagement/directory/roleAssignments')
  }

  async getSecureScores(): Promise<unknown[]> {
    const result = await this.query('/security/secureScores', { top: 1 })
    return result.value
  }

  async getSecurityAlerts(): Promise<unknown[]> {
    return this.queryAll('/security/alerts_v2', { top: 50 })
  }

  async getAuthMethodRegistration(): Promise<unknown[]> {
    return this.queryAll('/reports/authenticationMethods/userRegistrationDetails')
  }

  async getRiskyUsers(): Promise<unknown[]> {
    return this.queryAll('/identityProtection/riskyUsers')
  }

  async getDirectoryAudits(filter?: string): Promise<unknown[]> {
    return this.queryAll('/auditLogs/directoryAudits', { filter })
  }

  // Raw fetch: path may contain embedded OData query params.
  // Used by the connection-test endpoint which builds its own query strings.
  async rawQuery(relativePath: string): Promise<any> {
    const token = await this.authenticate()
    // If the path already starts with http it's a full URL, otherwise prepend base
    const url = relativePath.startsWith('http') ? relativePath : `${GRAPH_API_BASE}${relativePath}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual',
      },
    })
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Graph API error (${response.status}) on ${relativePath}: ${errorBody}. ` +
          `Check that the app registration has the required permissions and admin consent has been granted.`
      )
    }
    return response.json()
  }

  getTenantId(): string {
    return this.config.tenantId
  }

  /**
   * Lightweight preflight: acquire a token and read the organization profile.
   * Throws `GraphAuthError` if the credential/tenant/app is the problem (so the
   * caller can fail the whole run with one actionable message); throws a generic
   * Error for permission/transient failures. Resolves with the tenant display
   * name on success. Cheap enough to run before a full assessment.
   */
  async verifyConnection(): Promise<{ tenantId: string; displayName?: string }> {
    // authenticate() throws GraphAuthError on credential-class failures.
    await this.authenticate()
    const org = await this.rawQuery('/organization?$select=id,displayName')
    const displayName = Array.isArray(org?.value) ? org.value[0]?.displayName : undefined
    return { tenantId: this.config.tenantId, displayName }
  }

  // -------------------------------------------------------------------------
  // Write Methods (Sprint 1 — IND-50)
  // Requires appropriate Graph API write permissions granted by client admin.
  // -------------------------------------------------------------------------

  async post(endpoint: string, body: unknown, opts: WriteOpts): Promise<unknown> {
    if (opts.dryRun) return { dryRun: true, endpoint, body, method: 'POST' }
    const token = await this.authenticate()
    const url = `${GRAPH_API_BASE}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    if (opts.idempotencyKey) headers['client-request-id'] = opts.idempotencyKey
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Graph POST ${endpoint} failed (${response.status}): ${err}`)
    }
    return response.status === 204 ? null : response.json()
  }

  async patch(endpoint: string, body: unknown, opts: WriteOpts): Promise<unknown> {
    if (opts.dryRun) return { dryRun: true, endpoint, body, method: 'PATCH' }
    const token = await this.authenticate()
    const url = `${GRAPH_API_BASE}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    if (opts.idempotencyKey) headers['client-request-id'] = opts.idempotencyKey
    const response = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Graph PATCH ${endpoint} failed (${response.status}): ${err}`)
    }
    return response.status === 204 ? null : response.json()
  }

  async delete(endpoint: string, opts: WriteOpts): Promise<void> {
    if (opts.dryRun) return
    const token = await this.authenticate()
    const url = `${GRAPH_API_BASE}${endpoint}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Graph DELETE ${endpoint} failed (${response.status}): ${err}`)
    }
  }
}

// -------------------------------------------------------------------------
// Factory function
// -------------------------------------------------------------------------

export function createGraphClient(): GraphClient {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET. ' +
        'Create an Entra ID app registration with the required Graph API permissions and provide these values.'
    )
  }

  return new GraphClient({
    tenantId,
    clientId,
    clientSecret,
    scopes: ['https://graph.microsoft.com/.default'],
  })
}
