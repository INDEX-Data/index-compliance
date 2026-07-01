// =============================================================================
// INDEX ATLAS — Connector Framework: core types
//
// A Connector is a uniform contract for an external environment ATLAS can read
// and (with separate consent) write. The OAuth strategy is pluggable so the same
// framework serves both M365 admin-consent (app-only) and third-party
// Auth-Code + PKCE (delegated) flows. Transport-agnostic — same tier as
// src/operations and src/agents.
// =============================================================================

export type OAuthStrategyKind = 'app_consent' | 'auth_code_pkce'

export type ConnectorTier = 'read' | 'write'

export type GrantStatus = 'pending' | 'connected' | 'expired' | 'error' | 'revoked'

/** A single OAuth scope, tagged by tier so write is consented separately. */
export interface ConnectorScope {
  value: string // 'https://graph.microsoft.com/.default' | 'read:jira-work'
  tier: ConnectorTier
  description: string
}

/** Result of completing an OAuth round-trip, before persistence. */
export interface GrantMaterial {
  grantType: OAuthStrategyKind
  /** M365 customer tenant id from the admin-consent callback (app_consent). */
  externalTenantId?: string
  /** auth_code_pkce only — exchanged from the authorization code. */
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: string // ISO 8601
  scopes: string[]
  metadata?: Record<string, unknown> // e.g. jira cloud_id, sovereign cloud
}

export interface BuildAuthorizeUrlInput {
  redirectUri: string
  state: string
  tier: ConnectorTier
  codeChallenge?: string // PKCE (auth_code_pkce only)
  loginHint?: string
}

export interface HandleCallbackInput {
  params: URLSearchParams
  redirectUri: string
  codeVerifier?: string // PKCE (auth_code_pkce only)
}

/**
 * The pluggable OAuth behaviour for a connector.
 * - app_consent: buildAuthorizeUrl points at the admin-consent endpoint;
 *   handleCallback returns only { externalTenantId } — runtime tokens are minted
 *   later from OUR app creds.
 * - auth_code_pkce: buildAuthorizeUrl points at the provider's authorize endpoint
 *   with a PKCE challenge; handleCallback exchanges the code for access/refresh.
 */
export interface OAuthStrategy {
  kind: OAuthStrategyKind
  buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string
  handleCallback(input: HandleCallbackInput): Promise<GrantMaterial>
}

/** A persisted grant, decrypted, as the resolver/session consume it. */
export interface StoredGrant {
  clientId: string // ATLAS clients.id
  platform: string
  grantType: OAuthStrategyKind
  externalTenantId?: string
  accessToken?: string // decrypted
  refreshToken?: string // decrypted
  accessTokenExpiresAt?: string
  scopes: string[]
  status: GrantStatus
  consentedTier: ConnectorTier
  metadata?: Record<string, unknown>
}

/** A live, authenticated handle to a connected environment. */
export interface ConnectorSession {
  platform: string
  /** Returns a valid bearer token, refreshing/minting as needed. */
  getAccessToken(scope?: string): Promise<string>
  /** Cheap liveness + identity probe. */
  healthcheck(): Promise<{ ok: boolean; displayName?: string; detail?: string }>
}

export interface ReadCapability {
  id: string
  description: string
  scopesRequired: string[]
}

export interface WriteCapability {
  id: string
  description: string
  scopesRequired: string[]
  /** Mirrors agents/types RiskLevel — surfaced for human approval. */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  supportsDryRun: boolean
}

/** The uniform connector contract. Implemented per platform. */
export interface Connector {
  platform: string // 'm365' | 'jira'
  displayName: string
  oauth: OAuthStrategy
  scopes: ConnectorScope[]
  reads: ReadCapability[]
  writes: WriteCapability[]
  createSession(grant: StoredGrant): ConnectorSession
}
