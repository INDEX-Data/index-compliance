// Supabase-based API layer
// Simple CRUD → supabase.from('table') queries (RLS handles auth)
// Server-side operations → supabase.functions.invoke() (Edge Functions)

import { createClientSupabase } from './supabase'
import type {
  ConfigStatus, FrameworkMeta, ReportMeta,
  ComplianceReport, ControlAssessment, Client,
  ObjectivesResponse, ObjectiveStatus, ObjectiveStatusValue,
  DIBCACObjectiveSummary,
  Invitation, ClientIntegration,
  TeamInvite, TeamMember, UserProfile,
} from './types'

// ── Typed API error ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Supabase client (lazy singleton per request) ──────────────────────────
function supa() {
  return createClientSupabase()
}

// ── Edge Function helper ─────────────────────────────────────────────────
// Calls Supabase Edge Functions with automatic auth (cookie-based session).
async function invoke<T>(fnName: string, body?: object): Promise<T> {
  const { data, error } = await supa().functions.invoke(fnName, {
    body: body ?? {},
  })
  if (error) throw new ApiError(error.message ?? `Edge function "${fnName}" failed`, 500)
  return data as T
}

// ── Config ───────────────────────────────────────────────────────────────────
// Config status is derived from whether the user has any clients with credentials.

export const getConfigStatus = async (): Promise<ConfigStatus & { anthropicConfigured?: boolean; clientCount?: number }> => {
  const { data: clients, error } = await supa()
    .from('clients')
    .select('id, tenant_id, name')
  if (error) throw new ApiError(error.message, 500)
  const count = clients?.length ?? 0
  return {
    configured: count > 0,
    tenantId: clients?.[0]?.tenant_id,
    tenantName: clients?.[0]?.name,
    clientCount: count,
  }
}

export const saveConfig = async (data: {
  tenantId: string; clientId: string; clientSecret: string; tenantName?: string
}): Promise<{ ok: boolean }> => {
  return invoke('save-config', data)
}

export const testConfig = async (data?: {
  tenantId: string; clientId: string; clientSecret: string
}): Promise<{ ok: boolean; tenantName?: string; domain?: string; error?: string }> => {
  return invoke('test-connection', data)
}

// ── Clients (multi-tenant MSP) ────────────────────────────────────────────────

export const getClients = async (): Promise<Client[]> => {
  const { data, error } = await supa()
    .from('clients')
    .select('*')
    .order('added_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientSecret: row.client_secret?.replace(/(?<=.{4}).*/g, (m: string) => '\u2022'.repeat(m.length)) ?? '',
    addedAt: row.added_at,
    notes: row.notes,
  }))
}

export const addClient = async (data: {
  name: string; tenantId: string; clientId: string; clientSecret: string
}): Promise<Client> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const { data: row, error } = await sb
    .from('clients')
    .insert({
      user_id: user.id,
      external_id: crypto.randomUUID(),
      name: data.name,
      tenant_id: data.tenantId,
      client_id: data.clientId,
      client_secret: data.clientSecret,
    })
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)
  return {
    id: row.id,
    name: row.name,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientSecret: row.client_secret?.replace(/(?<=.{4}).*/g, (m: string) => '\u2022'.repeat(m.length)) ?? '',
    addedAt: row.added_at,
    notes: row.notes,
  }
}

export const updateClient = async (id: string, data: Partial<{
  name: string; tenantId: string; clientId: string; clientSecret: string
}>): Promise<Client> => {
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name
  if (data.tenantId !== undefined) update.tenant_id = data.tenantId
  if (data.clientId !== undefined) update.client_id = data.clientId
  if (data.clientSecret !== undefined) update.client_secret = data.clientSecret

  const { data: row, error } = await supa()
    .from('clients')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)
  return {
    id: row.id,
    name: row.name,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientSecret: row.client_secret?.replace(/(?<=.{4}).*/g, (m: string) => '\u2022'.repeat(m.length)) ?? '',
    addedAt: row.added_at,
    notes: row.notes,
  }
}

export const deleteClient = async (id: string): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('clients').delete().eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
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
    // Fallback: return hardcoded frameworks if Edge Function doesn't exist yet
    return [
      { id: 'cmmc-l2', name: 'CMMC Level 2', version: '2.0', description: 'Cybersecurity Maturity Model Certification Level 2', controlCount: 110, implemented: true },
      { id: 'nist-800-171', name: 'NIST SP 800-171', version: 'Rev 2', description: 'Protecting Controlled Unclassified Information', controlCount: 110, implemented: true },
      { id: 'hipaa', name: 'HIPAA Security Rule', version: '2024', description: 'Health Insurance Portability and Accountability Act', controlCount: 54, implemented: false },
      { id: 'finra', name: 'FINRA Cybersecurity', version: '2024', description: 'Financial Industry Regulatory Authority', controlCount: 42, implemented: false },
      { id: 'ferpa', name: 'FERPA', version: '2024', description: 'Family Educational Rights and Privacy Act', controlCount: 38, implemented: false },
    ]
  }
}

// ── Reports ──────────────────────────────────────────────────────────────────

export const getReports = async (): Promise<ReportMeta[]> => {
  const { data, error } = await supa()
    .from('reports')
    .select('id, framework_id, data, generated_at, client_id')
    .order('generated_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map(row => {
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
  const { data: row, error } = await supa()
    .from('reports')
    .select('data')
    .eq('id', id)
    .single()
  if (error) throw new ApiError(error.message, 404)
  return row.data as ComplianceReport
}

export const deleteReport = async (id: string): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('reports').delete().eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

// ── Word / OPA / ZIP export ──────────────────────────────────────────────────
// These require server-side document generation → Edge Functions.

export async function exportWordReport(reportId: string): Promise<string | null> {
  try {
    const { data, error } = await supa().functions.invoke('generate-report', {
      body: { reportId, format: 'word' },
    })
    if (error) return error.message ?? 'Export failed'
    // Edge Function returns the file as a blob
    const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportId}.docx`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Export failed'
  }
}

export async function exportOPAReport(reportId: string): Promise<string | null> {
  try {
    const { data, error } = await supa().functions.invoke('generate-report', {
      body: { reportId, format: 'opa' },
    })
    if (error) return error.message ?? 'Export failed'
    const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data)])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OPA_${reportId}.docx`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Export failed'
  }
}

export async function exportEvidenceZip(reportId: string): Promise<string | null> {
  try {
    const { data, error } = await supa().functions.invoke('generate-report', {
      body: { reportId, format: 'zip' },
    })
    if (error) return error.message ?? 'Export failed'
    const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data)])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Evidence_${reportId}.zip`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
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
  const { data: rows, error } = await supa()
    .from('objective_statuses')
    .select('*')
    .eq('report_id', reportId)
  if (error) throw new ApiError(error.message, 500)

  // The full objective definitions come from the report data
  // For now, return the statuses. Phase 3 will add full enrichment.
  const statuses: ObjectiveStatus[] = (rows ?? []).map(r => ({
    objectiveId: r.objective_id,
    status: r.status as ObjectiveStatusValue,
    evidenceSource: r.evidence_source as any,
    attestationText: r.attestation_text,
    documentRef: r.document_ref,
    documentName: r.document_name,
    assessedAt: r.assessed_at,
    assessedBy: r.assessed_by,
  }))

  // Try to get full objectives from Edge Function (enriches with definitions)
  try {
    return await invoke<ObjectivesResponse>('get-objectives', { reportId })
  } catch {
    // Fallback: return raw statuses without definitions
    const summary = {
      total: statuses.length,
      met: statuses.filter(s => s.status === 'met').length,
      partiallyMet: statuses.filter(s => s.status === 'partially_met').length,
      notMet: statuses.filter(s => s.status === 'not_met').length,
      requiresManual: statuses.filter(s => s.status === 'requires_manual').length,
      requiresPhysical: statuses.filter(s => s.status === 'requires_physical').length,
      notAssessed: statuses.filter(s => s.status === 'not_assessed').length,
      coveragePercentage: statuses.length > 0 ? Math.round((statuses.filter(s => s.status === 'met').length / statuses.length) * 100) : 0,
    }
    return { reportId, summary, objectives: [] }
  }
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
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const { data: row, error } = await sb
    .from('objective_statuses')
    .upsert({
      report_id: reportId,
      objective_id: objectiveId,
      status: data.status ?? 'met',
      evidence_source: 'manual_attestation',
      attestation_text: data.attestationText,
      document_ref: data.documentRef,
      document_name: data.documentName,
      assessed_at: new Date().toISOString(),
      assessed_by: user.id,
    }, { onConflict: 'report_id,objective_id' })
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
  const { data: all } = await sb
    .from('objective_statuses')
    .select('status')
    .eq('report_id', reportId)
  const allStatuses = (all ?? []).map(r => r.status)
  const summary: DIBCACObjectiveSummary = {
    total: allStatuses.length,
    met: allStatuses.filter(s => s === 'met').length,
    partiallyMet: allStatuses.filter(s => s === 'partially_met').length,
    notMet: allStatuses.filter(s => s === 'not_met').length,
    requiresManual: allStatuses.filter(s => s === 'requires_manual').length,
    requiresPhysical: allStatuses.filter(s => s === 'requires_physical').length,
    notAssessed: allStatuses.filter(s => s === 'not_assessed').length,
    coveragePercentage: allStatuses.length > 0
      ? Math.round((allStatuses.filter(s => s === 'met').length / allStatuses.length) * 100)
      : 0,
  }

  return { ok: true, objective, summary }
}

export const resetObjectives = async (reportId: string): Promise<{ ok: boolean; summary: DIBCACObjectiveSummary }> => {
  const { error } = await supa()
    .from('objective_statuses')
    .delete()
    .eq('report_id', reportId)
  if (error) throw new ApiError(error.message, 500)
  const summary: DIBCACObjectiveSummary = {
    total: 0, met: 0, partiallyMet: 0, notMet: 0,
    requiresManual: 0, requiresPhysical: 0, notAssessed: 0, coveragePercentage: 0,
  }
  return { ok: true, summary }
}

// ── Invitations (MSP-side, auth required) ────────────────────────────────────

export const createInvitation = async (data: { clientName: string; email?: string }): Promise<{
  id: string; token: string; link: string; expiresAt: string
}> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: row, error } = await sb
    .from('client_invitations')
    .insert({
      user_id: user.id,
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
  return (data ?? []).map(row => ({
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
  return (data ?? []).map(row => ({
    id: row.id,
    platform: row.platform,
    status: row.status as ClientIntegration['status'],
    connectedAt: row.connected_at,
    lastTestedAt: row.last_tested_at,
    errorMessage: row.error_message,
    config: row.config as Record<string, string>,
  }))
}

// ── Public onboard endpoints ─────────────────────────────────────────────────

export async function getOnboardInfo(token: string) {
  const { data: row, error } = await supa()
    .from('client_invitations')
    .select('client_name, email, status, expires_at')
    .eq('token', token)
    .single()
  if (error || !row) throw new Error('Invite not found or has expired.')
  return {
    clientName: row.client_name,
    email: row.email,
    status: row.status,
    expiresAt: row.expires_at,
  }
}

export async function completeOnboard(token: string, data: object) {
  return invoke<{ ok: boolean; clientId: string }>('complete-onboard', { token, ...data })
}

export async function saveOnboardIntegration(token: string, platform: string, config: object) {
  return invoke<{ ok: boolean }>('save-onboard-integration', { token, platform, config })
}

export async function testOnboardIntegration(token: string, platform: string, config: object) {
  return invoke<{ ok: boolean; message?: string; tenantName?: string }>('test-onboard-integration', { token, platform, config })
}

export async function getOnboardIntegrations(token: string): Promise<ClientIntegration[]> {
  // Look up invitation → find client → get integrations
  const { data: inv } = await supa()
    .from('client_invitations')
    .select('client_id')
    .eq('token', token)
    .single()
  if (!inv?.client_id) return []
  return getClientIntegrations(inv.client_id)
}

// ── Client Integrations: MSP-authenticated write endpoints ───────────────────

export const saveClientIntegration = async (clientId: string, platform: string, config: Record<string, string>): Promise<{ ok: boolean }> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const { error } = await sb
    .from('client_integrations')
    .upsert({
      client_id: clientId,
      user_id: user.id,
      platform,
      config,
      status: 'connected',
      connected_at: new Date().toISOString(),
    }, { onConflict: 'client_id,platform' })
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export const testClientIntegration = async (clientId: string, platform: string, config: Record<string, string>): Promise<{ ok: boolean; error?: string }> => {
  return invoke('test-integration', { clientId, platform, config })
}

// ── Team Management (auth required) ──────────────────────────────────────────

export const getTeamInvites = async (): Promise<TeamInvite[]> => {
  const { data, error } = await supa()
    .from('team_invitations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map(row => ({
    id: row.id,
    email: row.email,
    token: row.token,
    status: row.status as TeamInvite['status'],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))
}

export const createTeamInvite = async (data: { email: string }): Promise<{
  id: string; token: string; link: string; expiresAt: string; email: string
}> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: row, error } = await sb
    .from('team_invitations')
    .insert({
      owner_id: user.id,
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
  const { error } = await supa()
    .from('team_invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  const { data, error } = await supa()
    .from('team_memberships')
    .select('*')
    .order('joined_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map(row => ({
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
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Sign in to accept this invite.')

  // Look up the invitation
  const { data: inv, error: invErr } = await sb
    .from('team_invitations')
    .select('id, owner_id, status')
    .eq('token', token)
    .single()
  if (invErr || !inv) throw new Error('Invite not found or has expired.')
  if (inv.status === 'accepted') return { ok: true, alreadyAccepted: true }

  // Check if already a member
  const { data: existing } = await sb
    .from('team_memberships')
    .select('id')
    .eq('owner_id', inv.owner_id)
    .eq('member_id', user.id)
    .maybeSingle()
  if (existing) return { ok: true, alreadyAccepted: true }

  // Create membership
  const { error: memErr } = await sb
    .from('team_memberships')
    .insert({
      owner_id: inv.owner_id,
      member_id: user.id,
      invitation_id: inv.id,
    })
  if (memErr) throw new Error(memErr.message)

  // Mark invitation as accepted
  await sb.from('team_invitations').update({ status: 'accepted' }).eq('id', inv.id)

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
  latestReport?:   { id: string; score: number; generatedAt: string }
  previousReport?: { id: string; score: number; generatedAt: string }
  changed?: { controlId: string; controlName: string; from: string; to: string; direction: 'improved' | 'degraded' | 'changed' }[]
}

export const getReportDrift = async (frameworkId?: string, clientId?: string): Promise<DriftResult> => {
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
    .map(r => ({ id: r.id, data: r.data as ComplianceReport, generatedAt: r.generated_at }))
    .filter(r => !clientId || r.data.clientId === clientId)

  if (reports.length < 2) {
    return { hasDrift: false, reports: reports.length, message: 'Not enough reports for drift detection.' }
  }

  const latest = reports[0]
  const previous = reports[1]
  const latestScore = latest.data.summary.compliancePercentage
  const prevScore = previous.data.summary.compliancePercentage

  const changed: DriftResult['changed'] = []
  let improved = 0, degraded = 0

  for (const ctrl of latest.data.controlAssessments) {
    const prev = previous.data.controlAssessments.find(c => c.controlId === ctrl.controlId)
    if (prev && prev.status !== ctrl.status) {
      const dir = ctrl.status === 'pass' && prev.status !== 'pass' ? 'improved'
        : ctrl.status !== 'pass' && prev.status === 'pass' ? 'degraded'
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
  return (row?.scoping as Record<string, boolean>) ?? { cui: true, spa: true, iot: false, ot_scada: false }
}

export const saveClientScoping = async (clientId: string, scoping: Record<string, boolean>): Promise<{ ok: boolean; scoping: Record<string, boolean> }> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const { error } = await sb
    .from('client_scoping')
    .upsert({
      client_id: clientId,
      user_id: user.id,
      scoping,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id' })
  if (error) throw new ApiError(error.message, 500)
  return { ok: true, scoping }
}

// ── CA Exclusion Nudge ────────────────────────────────────────────────────
export interface CAPolicy {
  policyId: string; policyName: string; state: string
  excludedUsers: string[]; excludedGroups: string[]
  justification: string | null; changed: boolean; scannedAt: string | null
}
export interface CAExclusionsResult { policies: CAPolicy[]; total: number; withChanges: number }

export const getCAExclusions = async (clientId: string): Promise<CAExclusionsResult> => {
  // This requires server-side Graph API call → Edge Function
  return invoke('get-ca-exclusions', { clientId })
}

export const justifyCAExclusion = async (clientId: string, policyId: string, justification: string): Promise<{ ok: boolean }> => {
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

export const getAccessReviews = async (clientId: string): Promise<AccessReviewsResult> => {
  // Requires server-side Graph API call → Edge Function
  return invoke('get-access-reviews', { clientId })
}

// ── Ticket Nominations ────────────────────────────────────────────────────
export interface TicketNomination {
  id: string; platform: string; ticketId: string; ticketTitle: string
  ticketUrl: string | null; controlId: string; controlTitle: string
  frameworkId: string; confidence: number; status: string; createdAt: string
}

export const scanTicketNominations = async (clientId: string, platform: string, frameworkId?: string, projectKey?: string): Promise<{
  scanned: number; nominated: number; nominations: TicketNomination[]
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
  return (data ?? []).map(row => ({
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

export const updateNominationStatus = async (clientId: string, nomId: string, status: 'accepted' | 'rejected'): Promise<{ ok: boolean }> => {
  const { error } = await supa()
    .from('ticket_nominations')
    .update({ status })
    .eq('id', nomId)
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
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

// ── Evidence file management ─────────────────────────────────────────────────
export interface EvidenceFileMeta {
  id: string; fileName: string; originalName: string
  fileSize: number; mimeType: string; uploadedAt: string
}

export const getEvidenceFiles = async (reportId: string, objectiveId: string): Promise<EvidenceFileMeta[]> => {
  const { data, error } = await supa()
    .from('evidence_files')
    .select('*')
    .eq('report_id', reportId)
    .eq('objective_id', objectiveId)
    .order('uploaded_at', { ascending: false })
  if (error) throw new ApiError(error.message, 500)
  return (data ?? []).map(row => ({
    id: row.id,
    fileName: row.file_name,
    originalName: row.original_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
  }))
}

export async function uploadEvidenceFile(reportId: string, objectiveId: string, file: File): Promise<EvidenceFileMeta> {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  // Read file content as base64 for storage
  const buffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

  const fileName = `${crypto.randomUUID()}_${file.name}`

  const { data: row, error } = await sb
    .from('evidence_files')
    .insert({
      report_id: reportId,
      objective_id: objectiveId,
      user_id: user.id,
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

export const deleteEvidenceFile = async (reportId: string, objectiveId: string, fileId: string): Promise<{ ok: boolean }> => {
  const { error } = await supa().from('evidence_files').delete().eq('id', fileId)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}

export function downloadEvidenceFile(reportId: string, objectiveId: string, fileId: string, fileName: string): void {
  // Fetch the file content from DB and download
  const sb = supa()
  sb.from('evidence_files')
    .select('content, mime_type')
    .eq('id', fileId)
    .single()
    .then(({ data }) => {
      if (!data) return
      const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: data.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    })
}

// ── User Profile ──────────────────────────────────────────────────────────
export const getProfile = async (): Promise<UserProfile> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const { data: row, error } = await sb
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new ApiError(error.message, 500)
  if (!row) {
    // Return a default profile if none exists yet
    return {
      id: '',
      userId: user.id,
      accountType: 'msp',
      companyName: '',
      onboardedAt: new Date().toISOString(),
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    accountType: row.account_type as UserProfile['accountType'],
    companyName: row.company_name,
    role: row.role,
    orgSize: row.org_size,
    industry: row.industry,
    onboardedAt: row.onboarded_at,
  }
}

export const saveProfile = async (data: {
  companyName: string; accountType: string; role?: string; orgSize?: string; industry?: string
}): Promise<UserProfile> => {
  const sb = supa()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new ApiError('Not authenticated', 401)

  const { data: row, error } = await sb
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      account_type: data.accountType,
      company_name: data.companyName,
      role: data.role,
      org_size: data.orgSize,
      industry: data.industry,
      onboarded_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw new ApiError(error.message, 500)
  return {
    id: row.id,
    userId: row.user_id,
    accountType: row.account_type as UserProfile['accountType'],
    companyName: row.company_name,
    role: row.role,
    orgSize: row.org_size,
    industry: row.industry,
    onboardedAt: row.onboarded_at,
  }
}

// ── Client Notes ─────────────────────────────────────────────────────────
export const saveClientNotes = async (clientId: string, notes: string): Promise<{ ok: boolean }> => {
  const { error } = await supa()
    .from('clients')
    .update({ notes })
    .eq('id', clientId)
  if (error) throw new ApiError(error.message, 500)
  return { ok: true }
}
