// Typed fetch wrappers for the compliance REST API
// All calls go to /api/* which Next.js proxies to the Express API server.

import type {
  ConfigStatus, FrameworkMeta, ReportMeta,
  ComplianceReport, ControlAssessment, Client,
  ObjectivesResponse, ObjectiveStatus, ObjectiveStatusValue,
  DIBCACObjectiveSummary,
  Invitation, ClientIntegration,
  TeamInvite, TeamMember, UserProfile,
} from './types'

const BASE = '/api'

// ── Typed API error ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Clerk token store ──────────────────────────────────────────────────────
// Updated by <ClerkTokenSync /> in the root layout. All fetch helpers read it.
let _clerkToken: string | null = null

// Promise that resolves with the first valid token. authHeaders() awaits this
// when _clerkToken is null — handles the React child-before-parent effects
// order where page useEffects fire before ClerkTokenSync's useEffect.
let _resolveFirstToken: ((t: string) => void) | null = null
const _firstTokenPromise = new Promise<string>(resolve => {
  _resolveFirstToken = resolve
})

/** Called by ClerkTokenSync to keep the token fresh (every ~50 s). */
export function setClerkToken(token: string | null) {
  _clerkToken = token
  if (token && _resolveFirstToken) {
    _resolveFirstToken(token) // resolve once — promise stays resolved forever
    _resolveFirstToken = null
  }
}

/** Returns current Clerk token, or null in dev (no Clerk configured). */
export function getClerkToken(): string | null {
  return _clerkToken
}

async function authHeaders(): Promise<HeadersInit> {
  let token = _clerkToken
  if (!token) {
    // Wait up to 5 s for ClerkTokenSync to set the first token.
    // Page useEffects (children) fire before ClerkTokenSync's useEffect (parent).
    try {
      token = await Promise.race([
        _firstTokenPromise,
        new Promise<string>((_, reject) => setTimeout(reject, 5_000)),
      ])
    } catch { token = null }
  }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Base fetch helpers ────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

async function put<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

// ── Config ───────────────────────────────────────────────────────────────────

export const getConfigStatus = () => get<ConfigStatus & { anthropicConfigured?: boolean; clientCount?: number }>('/config/status')

export const saveConfig = (data: {
  tenantId: string
  clientId: string
  clientSecret: string
  tenantName?: string
}) => post<{ ok: boolean }>('/config', data)

export const testConfig = (data?: {
  tenantId: string
  clientId: string
  clientSecret: string
}) => post<{ ok: boolean; tenantName?: string; domain?: string; error?: string }>('/config/test', data)

// ── Clients (multi-tenant MSP) ────────────────────────────────────────────────

export const getClients    = () => get<Client[]>('/clients')

export const addClient = (data: {
  name: string
  tenantId: string
  clientId: string
  clientSecret: string
}) => post<Client>('/clients', data)

export const updateClient = (id: string, data: Partial<{
  name: string
  tenantId: string
  clientId: string
  clientSecret: string
}>) => put<Client>(`/clients/${id}`, data)

export const deleteClient  = (id: string) => del<{ ok: boolean }>(`/clients/${id}`)

export const testClient = (id: string) =>
  post<{ ok: boolean; error?: string }>(`/clients/${id}/test`)

// ── Frameworks ───────────────────────────────────────────────────────────────

export const getFrameworks = () => get<FrameworkMeta[]>('/frameworks')

// ── Reports ──────────────────────────────────────────────────────────────────

export const getReports    = () => get<ReportMeta[]>('/reports')
export const getReport     = (id: string) => get<ComplianceReport>(`/reports/${id}`)
export const deleteReport  = (id: string) => del<{ ok: boolean }>(`/reports/${id}`)

// ── Word report export ────────────────────────────────────────────────────────
// Fetches the .docx from the API and triggers a browser download.
// Uses the Next.js proxy (/api/*) so it works in both dev and production.
// Returns null on success, or an error message string.
export async function exportWordReport(reportId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/reports/${reportId}/export/word`, {
    cache: 'no-store',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    return (err as { error?: string; code?: string }).error ?? `HTTP ${res.status}`
  }

  // Derive filename from Content-Disposition or fall back
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const nameMatch   = disposition.match(/filename="?([^"]+)"?/)
  const filename    = nameMatch?.[1] ?? `${reportId}.docx`

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return null
}

// ── SSE URL builder ──────────────────────────────────────────────────────────
// EventSource doesn't support custom headers, so the Clerk token is passed
// as a query parameter (?token=...) which the API server also accepts.
//
// When NEXT_PUBLIC_RAILWAY_PUBLIC_URL is set the browser connects directly to
// Railway, bypassing the Vercel proxy entirely. This is critical for long-running
// assessments (CMMC L2 = 3-5 min) which would otherwise hit Vercel's proxy timeout.
// Set NEXT_PUBLIC_RAILWAY_PUBLIC_URL=https://your-app.railway.app in Vercel.

export const getAssessStreamUrl = (frameworkId: string, clientId?: string) => {
  // Token is NOT added here — it goes in the Authorization header via fetch().
  // This avoids the query-param auth issue where Railway's verifyToken rejects
  // tokens passed as URL query params (possibly due to URL encoding or JWKS lookup).
  const directBase = process.env.NEXT_PUBLIC_RAILWAY_PUBLIC_URL?.replace(/\/$/, '')
  const base = directBase ? `${directBase}/api` : BASE

  const params = new URLSearchParams()
  if (clientId) params.set('clientId', clientId)
  const qs = params.toString()
  return qs
    ? `${base}/assess/stream/${frameworkId}?${qs}`
    : `${base}/assess/stream/${frameworkId}`
}

// ── DIBCAC 320 Objectives ─────────────────────────────────────────────────────

/** Get full objective list with status for a report */
export const getReportObjectives = (reportId: string) =>
  get<ObjectivesResponse>(`/reports/${reportId}/objectives`)

/** Manually attest an objective */
export const attestObjective = (
  reportId: string,
  objectiveId: string,
  data: {
    attestationText?: string
    status?: ObjectiveStatusValue
    documentRef?: string
    documentName?: string
  }
) => post<{ ok: boolean; objective: ObjectiveStatus; summary: DIBCACObjectiveSummary }>(
  `/reports/${reportId}/objectives/${encodeURIComponent(objectiveId)}/attest`,
  data
)

/** Reset all objectives back to auto-initialized state */
export const resetObjectives = (reportId: string) =>
  post<{ ok: boolean; summary: DIBCACObjectiveSummary }>(`/reports/${reportId}/objectives/reset`)

// ── Invitations (MSP-side, auth required) ────────────────────────────────────

export const createInvitation = (data: { clientName: string; email?: string }) =>
  post<{ id: string; token: string; link: string; expiresAt: string }>('/invitations', data)

export const getInvitations = () => get<Invitation[]>('/invitations')

export const revokeInvitation = (id: string) => del<{ ok: boolean }>(`/invitations/${id}`)

export const getClientIntegrations = (clientId: string) =>
  get<ClientIntegration[]>(`/clients/${clientId}/integrations`)

// ── Public onboard endpoints (no Clerk auth header) ───────────────────────────

export async function getOnboardInfo(token: string) {
  const res = await fetch(`/api/onboard/${token}`, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ clientName: string; email?: string; status: string; expiresAt: string }>
}

export async function completeOnboard(token: string, data: object) {
  const res = await fetch(`/api/onboard/${token}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ ok: boolean; clientId: string }>
}

export async function saveOnboardIntegration(token: string, platform: string, config: object) {
  const res = await fetch(`/api/onboard/${token}/integrations/${platform}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ ok: boolean }>
}

export async function testOnboardIntegration(token: string, platform: string, config: object) {
  const res = await fetch(`/api/onboard/${token}/integrations/${platform}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ ok: boolean; message?: string; tenantName?: string }>
}

export async function getOnboardIntegrations(token: string) {
  const res = await fetch(`/api/onboard/${token}/integrations`, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<ClientIntegration[]>
}

// ── Client Integrations: MSP-authenticated write endpoints ───────────────────

export const saveClientIntegration = (clientId: string, platform: string, config: Record<string, string>) =>
  put<{ ok: boolean }>(`/clients/${clientId}/integrations/${platform}`, { config })

export const testClientIntegration = (clientId: string, platform: string, config: Record<string, string>) =>
  post<{ ok: boolean; error?: string }>(`/clients/${clientId}/integrations/${platform}/test`, { config })

// ── Team Management (auth required) ──────────────────────────────────────────

export const getTeamInvites   = () => get<TeamInvite[]>('/team/invites')
export const createTeamInvite = (data: { email: string }) =>
  post<{ id: string; token: string; link: string; expiresAt: string; email: string }>('/team/invites', data)
export const revokeTeamInvite = (id: string) => del<{ ok: boolean }>(`/team/invites/${id}`)
export const getTeamMembers   = () => get<TeamMember[]>('/team/members')
export const removeTeamMember = (id: string) => del<{ ok: boolean }>(`/team/members/${id}`)

// ── Public team join endpoints (no Clerk auth header) ─────────────────────────

export async function getTeamJoinInfo(token: string) {
  const res = await fetch(`/api/team/join/${token}`, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{
    email: string
    status: string
    expiresAt?: string
    alreadyAccepted?: boolean
  }>
}

export async function acceptTeamInvite(token: string, authToken?: string | null) {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const tok = authToken ?? _clerkToken
  if (tok) headers['Authorization'] = `Bearer ${tok}`
  const res = await fetch(`/api/team/join/${token}/accept`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ ok: boolean; alreadyAccepted?: boolean }>
}

// ── OPA export ────────────────────────────────────────────────────────────────
export async function exportOPAReport(reportId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/reports/${reportId}/export/opa`, {
    cache: 'no-store',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    return (err as { error?: string }).error ?? `HTTP ${res.status}`
  }
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const nameMatch   = disposition.match(/filename="?([^"]+)"?/)
  const filename    = nameMatch?.[1] ?? `OPA_${reportId}.docx`
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
  return null
}

// ── ZIP evidence export ───────────────────────────────────────────────────────
export async function exportEvidenceZip(reportId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/reports/${reportId}/export/zip`, {
    cache: 'no-store',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    return (err as { error?: string }).error ?? `HTTP ${res.status}`
  }
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const nameMatch   = disposition.match(/filename="?([^"]+)"?/)
  const filename    = nameMatch?.[1] ?? `Evidence_${reportId}.zip`
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
  return null
}

// ── Evidence file upload ──────────────────────────────────────────────────────
export interface EvidenceFileMeta {
  id: string; fileName: string; originalName: string
  fileSize: number; mimeType: string; uploadedAt: string
}

export const getEvidenceFiles = (reportId: string, objectiveId: string) =>
  get<EvidenceFileMeta[]>(`/reports/${reportId}/objectives/${encodeURIComponent(objectiveId)}/files`)

export async function uploadEvidenceFile(reportId: string, objectiveId: string, file: File): Promise<EvidenceFileMeta> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/reports/${reportId}/objectives/${encodeURIComponent(objectiveId)}/files`, {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  const json = await res.json() as { ok: boolean; file: EvidenceFileMeta }
  return json.file
}

export const deleteEvidenceFile = (reportId: string, objectiveId: string, fileId: string) =>
  del<{ ok: boolean }>(`/reports/${reportId}/objectives/${encodeURIComponent(objectiveId)}/files/${fileId}`)

export function downloadEvidenceFile(reportId: string, objectiveId: string, fileId: string, fileName: string): void {
  const tokenQs = _clerkToken ? `?token=${encodeURIComponent(_clerkToken)}` : ''
  const a = document.createElement('a')
  a.href = `${BASE}/reports/${reportId}/objectives/${encodeURIComponent(objectiveId)}/files/${fileId}/download${tokenQs}`
  a.download = fileName
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ── Drift detection ───────────────────────────────────────────────────────────
export interface DriftResult {
  hasDrift: boolean
  message?: string
  reports?: number
  scoreDelta?: number
  improved?: number
  degraded?: number
  latestReport?:   { id: string; score: number; generatedAt: string }
  previousReport?: { id: string; score: number; generatedAt: string }
  changed?: { controlId: string; controlName: string; from: string; to: string; direction: 'improved' | 'degraded' | 'changed' }[]
}

export const getReportDrift = (frameworkId?: string, clientId?: string) => {
  const qs = new URLSearchParams()
  if (frameworkId) qs.set('frameworkId', frameworkId)
  if (clientId)    qs.set('clientId', clientId)
  return get<DriftResult>(`/reports/drift${qs.toString() ? `?${qs}` : ''}`)
}

// ── Asset Scoping ─────────────────────────────────────────────────────────
export const getClientScoping  = (clientId: string) => get<Record<string, boolean>>(`/clients/${clientId}/scoping`)
export const saveClientScoping = (clientId: string, scoping: Record<string, boolean>) =>
  put<{ ok: boolean; scoping: Record<string, boolean> }>(`/clients/${clientId}/scoping`, scoping)

// ── CA Exclusion Nudge ────────────────────────────────────────────────────
export interface CAPolicy {
  policyId: string; policyName: string; state: string
  excludedUsers: string[]; excludedGroups: string[]
  justification: string | null; changed: boolean; scannedAt: string | null
}
export interface CAExclusionsResult { policies: CAPolicy[]; total: number; withChanges: number }
export const getCAExclusions = (clientId: string) =>
  get<CAExclusionsResult>(`/clients/${clientId}/ca-exclusions`)
export const justifyCAExclusion = (clientId: string, policyId: string, justification: string) =>
  put<{ ok: boolean }>(`/clients/${clientId}/ca-exclusions/${policyId}/justify`, { justification })

// ── Access Reviews ────────────────────────────────────────────────────────
export interface AccessReviewDef {
  id: string; displayName: string; status: string
  recurrenceType: string; intervalDays: number | null
  lastInstance: { status: string; start: string; end: string } | null
  daysSinceLast: number | null; overdue: boolean; onSchedule: boolean | null
}
export interface AccessReviewsResult {
  supported: boolean; message?: string
  configured: number; onSchedule: number; overdue: number
  definitions: AccessReviewDef[]
}
export const getAccessReviews = (clientId: string) =>
  get<AccessReviewsResult>(`/clients/${clientId}/access-reviews`)

// ── Ticket Nominations ────────────────────────────────────────────────────
export interface TicketNomination {
  id: string; platform: string; ticketId: string; ticketTitle: string
  ticketUrl: string | null; controlId: string; controlTitle: string
  frameworkId: string; confidence: number; status: string; createdAt: string
}
export const scanTicketNominations = (clientId: string, platform: string, frameworkId?: string, projectKey?: string) =>
  post<{ scanned: number; nominated: number; nominations: TicketNomination[] }>(
    `/clients/${clientId}/tickets/scan`, { platform, frameworkId, projectKey }
  )
export const getTicketNominations = (clientId: string) =>
  get<TicketNomination[]>(`/clients/${clientId}/tickets/nominations`)
export const updateNominationStatus = (clientId: string, nomId: string, status: 'accepted' | 'rejected') =>
  put<{ ok: boolean }>(`/clients/${clientId}/tickets/nominations/${nomId}`, { status })

/** Download DIBCAC worksheet CSV */
export function exportDIBCACWorksheet(reportId: string): void {
  // Append token as query param since we're triggering a navigation (not a fetch)
  const tokenQs = _clerkToken ? `?token=${encodeURIComponent(_clerkToken)}` : ''
  const a = document.createElement('a')
  a.href = `${BASE}/reports/${reportId}/objectives/export/csv${tokenQs}`
  a.download = `DIBCAC_Worksheet_${reportId}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── User Profile ──────────────────────────────────────────────────────────
export const getProfile = () => get<UserProfile>('/profile')
export const saveProfile = (data: { companyName: string; accountType: string; role?: string; orgSize?: string; industry?: string }) =>
  put<UserProfile>('/profile', data)

// ── Client Notes ─────────────────────────────────────────────────────────
export const saveClientNotes = (clientId: string, notes: string) =>
  put<{ ok: boolean }>(`/clients/${clientId}/notes`, { notes })
