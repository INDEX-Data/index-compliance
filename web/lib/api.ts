// Typed fetch wrappers for the compliance REST API
// All calls go to /api/* which Next.js proxies to http://localhost:3001/api/*

import type {
  ConfigStatus, FrameworkMeta, ReportMeta,
  ComplianceReport, ControlAssessment, Client,
  ObjectivesResponse, ObjectiveStatus, ObjectiveStatusValue,
  DIBCACObjectiveSummary,
} from './types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
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
// Calls port 3001 directly (bypasses the Next.js proxy) to avoid the proxy's
// short read-timeout which kills long-running Claude AI generation requests.
// Returns null on success, or an error message string.
export async function exportWordReport(reportId: string): Promise<string | null> {
  const res = await fetch(`http://localhost:3001/api/reports/${reportId}/export/word`, { cache: 'no-store' })
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

export const getAssessStreamUrl = (frameworkId: string, clientId?: string) => {
  const base = `${BASE}/assess/stream/${frameworkId}`
  return clientId ? `${base}?clientId=${encodeURIComponent(clientId)}` : base
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

/** Download DIBCAC worksheet CSV */
export function exportDIBCACWorksheet(reportId: string): void {
  const a = document.createElement('a')
  a.href = `http://localhost:3001/api/reports/${reportId}/objectives/export/csv`
  a.download = `DIBCAC_Worksheet_${reportId}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
