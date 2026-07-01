// Supabase-based API layer
// Simple CRUD → supabase.from('table') queries (RLS handles auth)
// Server-side operations → supabase.functions.invoke() (Edge Functions)

import { createClientSupabase } from './supabase'
import type {
  ConfigStatus,
  FrameworkMeta,
  ReportMeta,
  ComplianceReport,
  ControlAssessment,
  Client,
  ObjectivesResponse,
  ObjectiveStatus,
  ObjectiveStatusValue,
  DIBCACObjectiveSummary,
  Invitation,
  ClientIntegration,
  TeamInvite,
  TeamMember,
  UserProfile,
} from './types'

// ── Typed API error ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Supabase client (lazy singleton per request) ──────────────────────────
function supa() {
  return createClientSupabase()
}

// ── Get current user ID from session (no network call) ──────────────────────
// Uses getSession() which reads from cookie/storage, unlike getUser() which
// makes a network request to Supabase Auth and can hang on slow connections.
async function requireUserId(): Promise<string> {
  const {
    data: { session },
  } = await supa().auth.getSession()
  if (!session?.user?.id) throw new ApiError('Not authenticated', 401)
  return session.user.id
}

// ── API Route helper ─────────────────────────────────────────────────────
// Calls local Next.js API routes (which handle server-side logic like Graph API).
// These replace Supabase Edge Functions during development.

/** Guard against HTML error pages (auth redirect, 404, 500). */
async function parseJsonOrThrow(res: Response, label: string): Promise<any> {
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    if (res.status === 401 || res.redirected || res.url.includes('/sign-in')) {
      throw new ApiError('Session expired — please refresh and log in again.', 401)
    }
    const text = await res.text().catch(() => '')
    throw new ApiError(
      `"${label}" returned non-JSON (${res.status})${text ? ': ' + text.slice(0, 120) : ''}`,
      res.status || 500
    )
  }
  return res.json()
}

async function invoke<T>(fnName: string, body?: object): Promise<T> {
  const res = await fetch(`/api/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await parseJsonOrThrow(res, fnName)
  if (!res.ok) throw new ApiError(data.error ?? `API "${fnName}" failed`, res.status)
  return data as T
}

// ── API Route helper (non-POST methods) ─────────────────────────────────
async function invokeMethod<T>(path: string, method: string, body?: object): Promise<T> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body && method !== 'GET') opts.body = JSON.stringify(body)
  const res = await fetch(`/api/${path}`, opts)
  const data = await parseJsonOrThrow(res, path)
  if (!res.ok) throw new ApiError(data.error ?? `API "${path}" failed`, res.status)
  return data as T
}

// ── Config ───────────────────────────────────────────────────────────────────
// Config status is derived from whether the user has any clients with credentials.

export const getConfigStatus = async (): Promise<
  ConfigStatus & { anthropicConfigured?: boolean; clientCount?: number }
> => {
  // Fetch clients from server-side route (credentials are decrypted there)
  const clients = await invokeMethod<Client[]>('clients', 'GET')
  const count = clients.length

  // Check if Anthropic API key is configured (server-side env var)
  let anthropicConfigured = false
  try {
    const res = await fetch('/api/config-status', { method: 'GET' })
    if (res.ok) {
      const data = await res.json()
      anthropicConfigured = !!data.anthropicConfigured
    }
  } catch {
    /* ignore */
  }

  return {
    configured: count > 0,
    tenantId: clients[0]?.tenantId,
    tenantName: clients[0]?.name,
    clientCount: count,
    anthropicConfigured,
  }
}

export const saveConfig = async (data: {
  tenantId: string
  clientId: string
  clientSecret: string
  tenantName?: string
}): Promise<{ ok: boolean }> => {
  return invoke('save-config', data)
}

export const testConfig = async (data?: {
  tenantId: string
  clientId: string
  clientSecret: string
}): Promise<{ ok: boolean; tenantName?: string; domain?: string; error?: string }> => {
  return invoke('test-connection', data)
}

// ── Clients (multi-tenant MSP) ────────────────────────────────────────────────
// All client CRUD goes through server-side /api/clients which handles encryption.

export const getClients = async (): Promise<Client[]> => {
  return invokeMethod<Client[]>('clients', 'GET')
}

// addClient / updateClient (manual paste-credential creation) were removed:
// environments are created via OAuth admin-consent (the connector callback),
// never by typing a client secret. deleteClient below = "disconnect".

export const deleteClient = async (id: string): Promise<{ ok: boolean }> => {
  return invokeMethod<{ ok: boolean }>(`clients?id=${id}`, 'DELETE')
}

export const testClient = async (id: string): Promise<{ ok: boolean; error?: string }> => {
  return invoke('test-connection', { clientId: id })
}

// ── Frameworks ───────────────────────────────────────────────────────────────
// Frameworks are static metadata. Call Edge Function which wraps the MCP server.

export const getFrameworks = async (): Promise<FrameworkMeta[]> => {
  try {
    return await invoke<FrameworkMeta[]>('list-frameworks')
  } catch {
    // Fallback: return catalog directly if API call fails
    const { FRAMEWORK_CATALOG } = await import('./framework-catalog')
    return FRAMEWORK_CATALOG
  }
}

// ── Reports ──────────────────────────────────────────────────────────────────

export const getReports = async (): Promise<ReportMeta[]> => {
  const { data, error } = await supa()
    .from('reports')
    .select('id, framework_id, data, generated_at, client_id')
    .order('generated_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map((row) => {
    const rpt = row.data as ComplianceReport
    return {
      reportId: row.id,
      frameworkId: rpt.frameworkId ?? row.framework_id,
      frameworkName: rpt.frameworkName ?? row.framework_id,
      tenantDisplayName: rpt.tenantDisplayName ?? '',
      generatedAt: rpt.generatedAt ?? row.generated_at,
      summary: rpt.summary,
      clientId: rpt.clientId ?? row.client_id,
      clientName: rpt.clientName,
    }
  })
}

export const getReport = async (id: string): Promise<ComplianceReport> => {
  const { data: row, error } = await supa().from('reports').select('data').eq('id', id).single()
  if (error) throw new ApiError(error.message, 404)
  return row.data as ComplianceReport
}

export const deleteReport = async (id: string): Promise<{ ok: boolean }> => {
  const { error, count } = await supa().from('reports').delete({ count: 'exact' }).eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  if (count === 0) throw new ApiError('Report not found or permission denied', 403)
  return { ok: true }
}

// ── Word / OPA / ZIP export ──────────────────────────────────────────────────
// These require server-side document generation → Edge Functions.

export async function exportWordReport(reportId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, format: 'word' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }))
      return err.error ?? 'Export failed'
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportId}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Export failed'
  }
}

export async function exportOPAReport(reportId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, format: 'opa' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }))
      return err.error ?? 'Export failed'
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OPA_${reportId}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Export failed'
  }
}

export async function exportEvidenceZip(reportId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, format: 'zip' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }))
      return err.error ?? 'Export failed'
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Evidence_${reportId}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Export failed'
  }
}

// ── SSE URL builder (legacy — used by running page until Phase 3 Realtime) ──
// In Phase 3 this will be removed; the running page will use Supabase Realtime.
export const getAssessStreamUrl = (frameworkId: string, clientId?: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const base = `${supabaseUrl}/functions/v1/assess`
  const params = new URLSearchParams()
  params.set('frameworkId', frameworkId)
  if (clientId) params.set('clientId', clientId)
  return `${base}?${params.toString()}`
}

// ── DIBCAC 320 Objectives ─────────────────────────────────────────────────────

export const getReportObjectives = async (reportId: string): Promise<ObjectivesResponse> => {
  // Call the get-objectives API route which enriches stored statuses
  // with full DIBCAC objective definitions from src/data/dibcac-objectives.ts
  return invoke<ObjectivesResponse>('get-objectives', { reportId })
}

export const attestObjective = async (
  reportId: string,
  objectiveId: string,
  data: {
    attestationText?: string
    status?: ObjectiveStatusValue
    documentRef?: string
    documentName?: string
  }
): Promise<{ ok: boolean; objective: ObjectiveStatus; summary: DIBCACObjectiveSummary }> => {
  const userId = await requireUserId()

  const { data: row, error } = await supa()
    .from('objective_statuses')
    .upsert(
      {
        report_id: reportId,
        objective_id: objectiveId,
        status: data.status ?? 'met',
        evidence_source: 'manual_attestation',
        attestation_text: data.attestationText,
        document_ref: data.documentRef,
        document_name: data.documentName,
        assessed_at: new Date().toISOString(),
        assessed_by: userId,
      },
      { onConflict: 'report_id,objective_id' }
    )
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)

  const objective: ObjectiveStatus = {
    objectiveId: row.objective_id,
    status: row.status as ObjectiveStatusValue,
    evidenceSource: row.evidence_source as any,
    attestationText: row.attestation_text,
    documentRef: row.document_ref,
    documentName: row.document_name,
    assessedAt: row.assessed_at,
    assessedBy: row.assessed_by,
  }

  // Recompute summary
  const { data: all } = await supa()
    .from('objective_statuses')
    .select('status')
    .eq('report_id', reportId)
  const allStatuses = (all ?? []).map((r) => r.status)
  const summary: DIBCACObjectiveSummary = {
    total: allStatuses.length,
    met: allStatuses.filter((s) => s === 'met').length,
    partiallyMet: allStatuses.filter((s) => s === 'partially_met').length,
    notMet: allStatuses.filter((s) => s === 'not_met').length,
    requiresManual: allStatuses.filter((s) => s === 'requires_manual').length,
    requiresPhysical: allStatuses.filter((s) => s === 'requires_physical').length,
    notAssessed: allStatuses.filter((s) => s === 'not_assessed').length,
    coveragePercentage:
      allStatuses.length > 0
        ? Math.round((allStatuses.filter((s) => s === 'met').length / allStatuses.length) * 100)
        : 0,
  }

  return { ok: true, objective, summary }
}

export const resetObjectives = async (
  reportId: string
): Promise<{ ok: boolean; summary: DIBCACObjectiveSummary }> => {
  const { error } = await supa().from('objective_statuses').delete().eq('report_id', reportId)
  if (error) throw new ApiError(error.message, 500)
  const summary: DIBCACObjectiveSummary = {
    total: 0,
    met: 0,
    partiallyMet: 0,
    notMet: 0,
    requiresManual: 0,
    requiresPhysical: 0,
    notAssessed: 0,
    coveragePercentage: 0,
  }
  return { ok: true, summary }
}

// ── Invitations (MSP-side, auth required) ────────────────────────────────────

export const createInvitation = async (data: {
  clientName: string
  email?: string
}): Promise<{
  id: string
  token: string
  link: string
  expiresAt: string
}> => {
  const userId = await requireUserId()

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: row, error } = await supa()
    .from('client_invitations')
    .insert({
      user_id: userId,
      token,
      client_name: data.clientName,
      email: data.email,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)

  const link = `${window.location.origin}/onboard/${token}`
  return { id: row.id, token, link, expiresAt }
}

export const getInvitations = async (): Promise<Invitation[]> => {
  const { data, error } = await supa()
    .from('client_invitations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    email: row.email,
    token: row.token,
    status: row.status as Invitation['status'],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    clientId: row.client_id,
  }))
}

export const revokeInvitation = async (id: string): Promise<{ ok: boolean }> => {
  const { error } = await supa()
    .from('client_invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export const getClientIntegrations = async (clientId: string): Promise<ClientIntegration[]> => {
  const { data, error } = await supa()
    .from('client_integrations')
    .select('*')
    .eq('client_id', clientId)
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    status: row.status as ClientIntegration['status'],
    connectedAt: row.connected_at,
    lastTestedAt: row.last_tested_at,
    errorMessage: row.error_message,
    config: row.config as Record<string, string>,
  }))
}

// ── Connector grants (OAuth) ────────────────────────────────────────────────
// Reads the M365 admin-consent grant status for a client. RLS scopes this to the
// current user. Returns connected=false when only a legacy secret exists.
export async function getM365GrantStatus(
  clientId: string
): Promise<{ connected: boolean; tier: 'read' | 'write' | null }> {
  const { data } = await supa()
    .from('connector_grants')
    .select('status, consented_tier')
    .eq('client_id', clientId)
    .eq('platform', 'm365')
    .maybeSingle()
  return {
    connected: data?.status === 'connected',
    tier: (data?.consented_tier as 'read' | 'write' | null) ?? null,
  }
}

// saveOnboardIntegration / testOnboardIntegration / getOnboardIntegrations were
// removed with the retired invite-onboarding flow (they called API routes that
// never existed). Connecting an environment is OAuth admin-consent only.

// ── Client Integrations: MSP-authenticated write endpoints ───────────────────

export const saveClientIntegration = async (
  clientId: string,
  platform: string,
  config: Record<string, string>
): Promise<{ ok: boolean }> => {
  const userId = await requireUserId()

  const { error } = await supa().from('client_integrations').upsert(
    {
      client_id: clientId,
      user_id: userId,
      platform,
      config,
      status: 'connected',
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,platform' }
  )
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export const testClientIntegration = async (
  clientId: string,
  platform: string,
  config: Record<string, string>
): Promise<{ ok: boolean; error?: string }> => {
  return invoke('test-integration', { clientId, platform, config })
}

// ── Team Management (auth required) ──────────────────────────────────────────

export const getTeamInvites = async (): Promise<TeamInvite[]> => {
  const { data, error } = await supa()
    .from('team_invitations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    token: row.token,
    status: row.status as TeamInvite['status'],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))
}

export const createTeamInvite = async (data: {
  email: string
}): Promise<{
  id: string
  token: string
  link: string
  expiresAt: string
  email: string
}> => {
  const userId = await requireUserId()

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: row, error } = await supa()
    .from('team_invitations')
    .insert({
      owner_id: userId,
      email: data.email,
      token,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)

  const link = `${window.location.origin}/join/${token}`
  return { id: row.id, token, link, expiresAt, email: data.email }
}

export const revokeTeamInvite = async (id: string): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('team_invitations').update({ status: 'revoked' }).eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  const { data, error } = await supa()
    .from('team_memberships')
    .select('*')
    .order('joined_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map((row) => ({
    id: row.id,
    memberId: row.member_id,
    joinedAt: row.joined_at,
  }))
}

export const removeTeamMember = async (id: string): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('team_memberships').delete().eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

// ── Public team join endpoints ───────────────────────────────────────────────

export async function getTeamJoinInfo(token: string) {
  const { data: row, error } = await supa()
    .from('team_invitations')
    .select('email, status, expires_at')
    .eq('token', token)
    .single()
  if (error || !row) throw new Error('This invite link is invalid or has expired.')
  return {
    email: row.email,
    status: row.status,
    expiresAt: row.expires_at,
    alreadyAccepted: row.status === 'accepted',
  }
}

export async function acceptTeamInvite(token: string, _authToken?: string | null) {
  const userId = await requireUserId()

  // Look up the invitation
  const { data: inv, error: invErr } = await supa()
    .from('team_invitations')
    .select('id, owner_id, status')
    .eq('token', token)
    .single()
  if (invErr || !inv) throw new Error('Invite not found or has expired.')
  if (inv.status === 'accepted') return { ok: true, alreadyAccepted: true }

  // Check if already a member
  const { data: existing } = await supa()
    .from('team_memberships')
    .select('id')
    .eq('owner_id', inv.owner_id)
    .eq('member_id', userId)
    .maybeSingle()
  if (existing) return { ok: true, alreadyAccepted: true }

  // Create membership
  const { error: memErr } = await supa().from('team_memberships').insert({
    owner_id: inv.owner_id,
    member_id: userId,
    invitation_id: inv.id,
  })
  if (memErr) throw new Error(memErr.message)

  // Mark invitation as accepted
  await supa().from('team_invitations').update({ status: 'accepted' }).eq('id', inv.id)

  return { ok: true, alreadyAccepted: false }
}

// ── Drift detection ───────────────────────────────────────────────────────────
export interface DriftResult {
  hasDrift: boolean
  message?: string
  reports?: number
  scoreDelta?: number
  improved?: number
  degraded?: number
  latestReport?: { id: string; score: number; generatedAt: string }
  previousReport?: { id: string; score: number; generatedAt: string }
  changed?: {
    controlId: string
    controlName: string
    from: string
    to: string
    direction: 'improved' | 'degraded' | 'changed'
  }[]
}

export const getReportDrift = async (
  frameworkId?: string,
  clientId?: string
): Promise<DriftResult> => {
  // Compute drift client-side from the two most recent reports
  let query = supa()
    .from('reports')
    .select('id, framework_id, data, generated_at')
    .order('generated_at', { ascending: false })
    .limit(2)

  if (frameworkId) query = query.eq('framework_id', frameworkId)
  // clientId filter on JSONB
  // We'll filter in JS for simplicity since client_id column may be null

  const { data: rows, error } = await query
  if (error) throw new ApiError(error.message, 500)

  const reports = (rows ?? [])
    .map((r) => ({ id: r.id, data: r.data as ComplianceReport, generatedAt: r.generated_at }))
    .filter((r) => !clientId || r.data.clientId === clientId)

  if (reports.length < 2) {
    return {
      hasDrift: false,
      reports: reports.length,
      message: 'Not enough reports for drift detection.',
    }
  }

  const latest = reports[0]
  const previous = reports[1]
  const latestScore = latest.data.summary.compliancePercentage
  const prevScore = previous.data.summary.compliancePercentage

  const changed: DriftResult['changed'] = []
  let improved = 0,
    degraded = 0

  for (const ctrl of latest.data.controlAssessments) {
    const prev = previous.data.controlAssessments.find((c) => c.controlId === ctrl.controlId)
    if (prev && prev.status !== ctrl.status) {
      const dir =
        ctrl.status === 'pass' && prev.status !== 'pass'
          ? 'improved'
          : ctrl.status !== 'pass' && prev.status === 'pass'
            ? 'degraded'
            : 'changed'
      if (dir === 'improved') improved++
      if (dir === 'degraded') degraded++
      changed.push({
        controlId: ctrl.controlId,
        controlName: ctrl.controlTitle,
        from: prev.status,
        to: ctrl.status,
        direction: dir,
      })
    }
  }

  return {
    hasDrift: changed.length > 0,
    reports: reports.length,
    scoreDelta: latestScore - prevScore,
    improved,
    degraded,
    latestReport: { id: latest.id, score: latestScore, generatedAt: latest.generatedAt },
    previousReport: { id: previous.id, score: prevScore, generatedAt: previous.generatedAt },
    changed,
  }
}

// ── Asset Scoping ─────────────────────────────────────────────────────────

export const getClientScoping = async (clientId: string): Promise<Record<string, boolean>> => {
  const { data: row } = await supa()
    .from('client_scoping')
    .select('scoping')
    .eq('client_id', clientId)
    .maybeSingle()
  return (
    (row?.scoping as Record<string, boolean>) ?? {
      cui: true,
      spa: true,
      iot: false,
      ot_scada: false,
    }
  )
}

export const saveClientScoping = async (
  clientId: string,
  scoping: Record<string, boolean>
): Promise<{ ok: boolean; scoping: Record<string, boolean> }> => {
  const userId = await requireUserId()

  const { error } = await supa().from('client_scoping').upsert(
    {
      client_id: clientId,
      user_id: userId,
      scoping,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id' }
  )
  if (error) throw new ApiError(error.message, 500)
  return { ok: true, scoping }
}

// ── CA Exclusion Nudge ────────────────────────────────────────────────────
export interface CAPolicy {
  policyId: string
  policyName: string
  state: string
  excludedUsers: string[]
  excludedGroups: string[]
  justification: string | null
  changed: boolean
  scannedAt: string | null
}
export interface CAExclusionsResult {
  policies: CAPolicy[]
  total: number
  withChanges: number
}

export const getCAExclusions = async (clientId: string): Promise<CAExclusionsResult> => {
  // This requires server-side Graph API call → Edge Function
  return invoke('get-ca-exclusions', { clientId })
}

export const justifyCAExclusion = async (
  clientId: string,
  policyId: string,
  justification: string
): Promise<{ ok: boolean }> => {
  const { error } = await supa()
    .from('ca_exclusion_snapshots')
    .update({ justification })
    .eq('client_id', clientId)
    .eq('policy_id', policyId)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

// ── Access Reviews ────────────────────────────────────────────────────────
export interface AccessReviewDef {
  id: string
  displayName: string
  status: string
  recurrenceType: string
  intervalDays: number | null
  lastInstance: { status: string; start: string; end: string } | null
  daysSinceLast: number | null
  overdue: boolean
  onSchedule: boolean | null
}
export interface AccessReviewsResult {
  supported: boolean
  message?: string
  configured: number
  onSchedule: number
  overdue: number
  definitions: AccessReviewDef[]
}

export const getAccessReviews = async (clientId: string): Promise<AccessReviewsResult> => {
  // Requires server-side Graph API call → Edge Function
  return invoke('get-access-reviews', { clientId })
}

// ── Ticket Nominations ────────────────────────────────────────────────────
export interface TicketNomination {
  id: string
  platform: string
  ticketId: string
  ticketTitle: string
  ticketUrl: string | null
  controlId: string
  controlTitle: string
  frameworkId: string
  confidence: number
  status: string
  createdAt: string
}

export const scanTicketNominations = async (
  clientId: string,
  platform: string,
  frameworkId?: string,
  projectKey?: string
): Promise<{
  scanned: number
  nominated: number
  nominations: TicketNomination[]
}> => {
  return invoke('scan-tickets', { clientId, platform, frameworkId, projectKey })
}

export const getTicketNominations = async (clientId: string): Promise<TicketNomination[]> => {
  const { data, error } = await supa()
    .from('ticket_nominations')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    ticketId: row.ticket_id,
    ticketTitle: row.ticket_title,
    ticketUrl: row.ticket_url,
    controlId: row.control_id,
    controlTitle: row.control_title,
    frameworkId: row.framework_id,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
  }))
}

export const updateNominationStatus = async (
  clientId: string,
  nomId: string,
  status: 'accepted' | 'rejected'
): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('ticket_nominations').update({ status }).eq('id', nomId)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

// ── DIBCAC Worksheet export ──────────────────────────────────────────────────
export function exportDIBCACWorksheet(reportId: string): void {
  // Download via Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const a = document.createElement('a')
  a.href = `${supabaseUrl}/functions/v1/export-worksheet?reportId=${encodeURIComponent(reportId)}`
  a.download = `DIBCAC_Worksheet_${reportId}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Evidence file management ─────────────────────────────────────────────────
export interface EvidenceFileMeta {
  id: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

export const getEvidenceFiles = async (
  reportId: string,
  objectiveId: string
): Promise<EvidenceFileMeta[]> => {
  try {
    const { data, error } = await supa()
      .from('evidence_files')
      .select('*')
      .eq('report_id', reportId)
      .eq('objective_id', objectiveId)
      .order('uploaded_at', { ascending: false })
    if (error) {
      console.warn('[evidence_files] query failed:', error.message)
      return []
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      originalName: row.original_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadedAt: row.uploaded_at,
    }))
  } catch (e) {
    console.warn('[evidence_files] unexpected error:', e)
    return []
  }
}

export async function uploadEvidenceFile(
  reportId: string,
  objectiveId: string,
  file: File
): Promise<EvidenceFileMeta> {
  const userId = await requireUserId()

  // Read file content as base64 for storage
  const buffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

  const fileName = `${crypto.randomUUID()}_${file.name}`

  const { data: row, error } = await supa()
    .from('evidence_files')
    .insert({
      report_id: reportId,
      objective_id: objectiveId,
      user_id: userId,
      file_name: fileName,
      original_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      content: base64,
    })
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)

  return {
    id: row.id,
    fileName: row.file_name,
    originalName: row.original_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
  }
}

export const deleteEvidenceFile = async (
  reportId: string,
  objectiveId: string,
  fileId: string
): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('evidence_files').delete().eq('id', fileId)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export function downloadEvidenceFile(
  reportId: string,
  objectiveId: string,
  fileId: string,
  fileName: string
): void {
  // Fetch the file content from DB and download
  const sb = supa()
  sb.from('evidence_files')
    .select('content, mime_type')
    .eq('id', fileId)
    .single()
    .then(({ data }) => {
      if (!data) return
      const bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: data.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
}

// ── User Profile ──────────────────────────────────────────────────────────
export const getProfile = async (): Promise<UserProfile> => {
  const userId = await requireUserId()

  const { data: row, error } = await supa()
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new ApiError(error.message, 500)
  if (!row) {
    // Return a default profile if none exists yet
    return {
      id: '',
      userId,
      accountType: 'msp',
      companyName: '',
      fullName: undefined,
      onboardedAt: new Date().toISOString(),
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    accountType: row.account_type as UserProfile['accountType'],
    companyName: row.company_name,
    fullName: row.full_name ?? undefined,
    role: row.role,
    orgSize: row.org_size,
    industry: row.industry,
    onboardedAt: row.onboarded_at,
  }
}

export const saveProfile = async (data: {
  companyName: string
  accountType: string
  fullName?: string
  role?: string
  orgSize?: string
  industry?: string
}): Promise<UserProfile> => {
  const userId = await requireUserId()

  const { data: row, error } = await supa()
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        account_type: data.accountType,
        company_name: data.companyName,
        full_name: data.fullName ?? null,
        role: data.role,
        org_size: data.orgSize,
        industry: data.industry,
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)
  return {
    id: row.id,
    userId: row.user_id,
    accountType: row.account_type as UserProfile['accountType'],
    companyName: row.company_name,
    fullName: row.full_name ?? undefined,
    role: row.role,
    orgSize: row.org_size,
    industry: row.industry,
    onboardedAt: row.onboarded_at,
  }
}

// ── Client Notes ─────────────────────────────────────────────────────────
export const saveClientNotes = async (
  clientId: string,
  notes: string
): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('clients').update({ notes }).eq('id', clientId)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}
