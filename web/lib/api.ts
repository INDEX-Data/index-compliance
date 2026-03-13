// Typed fetch wrappers for the compliance REST API
// All calls go to /api/* which Next.js proxies to the Express API server.

import type {
  ConfigStatus, FrameworkMeta, ReportMeta,
  ComplianceReport, ControlAssessment, Client,
  ObjectivesResponse, ObjectiveStatus, ObjectiveStatusValue,
  DIBCACObjectiveSummary,
  Invitation, ClientIntegration,
  TeamInvite, TeamMember,
} from './types'

const BASE = '/api'

// ── Clerk token store ──────────────────────────────────────────────────────
// Updated by <ClerkTokenSync /> in the root layout. All fetch helpers read it.
let _clerkToken: string | null = null

/** Called by ClerkTokenSync to keep the token fresh (every ~50 s). */
export function setClerkToken(token: string | null) {
  _clerkToken = token
}

/** Returns current Clerk token, or null in dev (no Clerk configured). */
export function getClerkToken(): string | null {
  return _clerkToken
}

function authHeaders(): HeadersInit {
  return _clerkToken ? { Authorization: `Bearer ${_clerkToken}` } : {}
}

// ── Base fetch helpers ────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function put<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
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
    headers: authHeaders(),
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

export const getAssessStreamUrl = (frameworkId: string, clientId?: string) => {
  const params = new URLSearchParams()
  if (clientId) params.set('clientId', clientId)
  if (_clerkToken) params.set('token', _clerkToken)
  const qs = params.toString()
  return qs
    ? `${BASE}/assess/stream/${frameworkId}?${qs}`
    : `${BASE}/assess/stream/${frameworkId}`
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

export async function acceptTeamInvite(token: string) {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (_clerkToken) headers['Authorization'] = `Bearer ${_clerkToken}`
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
