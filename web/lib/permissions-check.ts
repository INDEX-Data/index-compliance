// Atlas — Microsoft API Permissions Check
// Probes each Microsoft API to determine what the app registration can access
// Used in copilot system prompt and settings page

export type ApiStatus = 'ok' | 'denied' | 'not_licensed' | 'error' | 'unchecked'

export interface PermissionsReport {
  graph: ApiStatus
  graphBetaSecurity: ApiStatus
  defender: ApiStatus
  managementActivity: ApiStatus
  checkedAt: string
  details: Record<string, string>  // human-readable detail per API
}

// ── Token helper ──────────────────────────────────────────────────────────────

async function getToken(tenantId: string, clientId: string, clientSecret: string, scope: string): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope,
        grant_type: 'client_credentials',
        client_secret: clientSecret,
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    if (body.includes('AADSTS700016') || body.includes('AADSTS50011')) {
      throw new Error('not_licensed')  // application not found or scope not available
    }
    throw new Error(`auth_failed:${res.status}`)
  }
  const data = await res.json()
  return data.access_token
}

// ── Probe functions ───────────────────────────────────────────────────────────

async function probeGraph(tenantId: string, clientId: string, clientSecret: string): Promise<{ status: ApiStatus; detail: string }> {
  try {
    const token = await getToken(tenantId, clientId, clientSecret, 'https://graph.microsoft.com/.default')
    const res = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return { status: 'ok', detail: 'Graph API accessible' }
    if (res.status === 403) return { status: 'denied', detail: 'Graph token acquired but Organization.Read.All permission missing' }
    return { status: 'error', detail: `Graph API returned ${res.status}` }
  } catch (err: any) {
    if (err.message?.startsWith('auth_failed')) return { status: 'error', detail: 'Cannot authenticate with Graph API' }
    return { status: 'error', detail: err.message?.slice(0, 100) || 'Unknown error' }
  }
}

async function probeGraphBetaSecurity(tenantId: string, clientId: string, clientSecret: string): Promise<{ status: ApiStatus; detail: string }> {
  try {
    const token = await getToken(tenantId, clientId, clientSecret, 'https://graph.microsoft.com/.default')
    const res = await fetch('https://graph.microsoft.com/beta/security/incidents?$top=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return { status: 'ok', detail: 'XDR incidents and advanced hunting available' }
    if (res.status === 403) return { status: 'denied', detail: 'Add SecurityIncident.Read.All and ThreatHunting.Read.All permissions' }
    if (res.status === 404) return { status: 'not_licensed', detail: 'Microsoft 365 Defender not available for this tenant' }
    return { status: 'error', detail: `Graph Security beta returned ${res.status}` }
  } catch (err: any) {
    return { status: 'error', detail: err.message?.slice(0, 100) || 'Unknown error' }
  }
}

async function probeDefender(tenantId: string, clientId: string, clientSecret: string): Promise<{ status: ApiStatus; detail: string }> {
  try {
    const token = await getToken(tenantId, clientId, clientSecret, 'https://api.securitycenter.microsoft.com/.default')
    const res = await fetch('https://api.securitycenter.microsoft.com/api/machines?$top=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return { status: 'ok', detail: 'Defender for Endpoint API accessible — vulnerability, device, and hunting data available' }
    if (res.status === 403) return { status: 'denied', detail: 'Add Machine.Read.All, Vulnerability.Read.All, AdvancedQuery.Read.All permissions to the app registration' }
    if (res.status === 404 || res.status === 400) return { status: 'not_licensed', detail: 'Defender for Endpoint not licensed for this tenant (requires P2 or M365 E5)' }
    return { status: 'error', detail: `Defender API returned ${res.status}` }
  } catch (err: any) {
    if (err.message === 'not_licensed') return { status: 'not_licensed', detail: 'Defender for Endpoint scope not recognized — not licensed for this tenant' }
    if (err.message?.startsWith('auth_failed')) return { status: 'denied', detail: 'Cannot authenticate with Defender API — add api.securitycenter.microsoft.com permissions' }
    return { status: 'error', detail: err.message?.slice(0, 100) || 'Unknown error' }
  }
}

async function probeManagementActivity(tenantId: string, clientId: string, clientSecret: string): Promise<{ status: ApiStatus; detail: string }> {
  try {
    const token = await getToken(tenantId, clientId, clientSecret, 'https://manage.office.com/.default')
    const res = await fetch(
      `https://manage.office.com/api/v1.0/${tenantId}/activity/feed/subscriptions/list`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.ok) return { status: 'ok', detail: 'Office 365 unified audit log accessible — DLP events, Exchange, SharePoint, Teams audit data available' }
    if (res.status === 403) return { status: 'denied', detail: 'Add ActivityFeed.Read permission in Office 365 Management APIs' }
    return { status: 'error', detail: `Management Activity API returned ${res.status}` }
  } catch (err: any) {
    if (err.message === 'not_licensed') return { status: 'not_licensed', detail: 'Office 365 Management Activity API scope not available' }
    if (err.message?.startsWith('auth_failed')) return { status: 'denied', detail: 'Cannot authenticate — register app in Office 365 Management APIs' }
    return { status: 'error', detail: err.message?.slice(0, 100) || 'Unknown error' }
  }
}

// ── Main check ────────────────────────────────────────────────────────────────

export async function checkAllPermissions(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<PermissionsReport> {
  const [graph, graphBeta, defender, mgmtActivity] = await Promise.allSettled([
    probeGraph(tenantId, clientId, clientSecret),
    probeGraphBetaSecurity(tenantId, clientId, clientSecret),
    probeDefender(tenantId, clientId, clientSecret),
    probeManagementActivity(tenantId, clientId, clientSecret),
  ])

  const resolve = (r: PromiseSettledResult<{ status: ApiStatus; detail: string }>) =>
    r.status === 'fulfilled' ? r.value : { status: 'error' as ApiStatus, detail: 'Check failed' }

  const g = resolve(graph)
  const gb = resolve(graphBeta)
  const d = resolve(defender)
  const m = resolve(mgmtActivity)

  return {
    graph: g.status,
    graphBetaSecurity: gb.status,
    defender: d.status,
    managementActivity: m.status,
    checkedAt: new Date().toISOString(),
    details: {
      graph: g.detail,
      graphBetaSecurity: gb.detail,
      defender: d.detail,
      managementActivity: m.detail,
    },
  }
}

// ── Summary for copilot system prompt ─────────────────────────────────────────

export function permissionsToPromptSection(report: PermissionsReport): string {
  const icon = (s: ApiStatus) => s === 'ok' ? '✅' : s === 'denied' ? '🔒' : s === 'not_licensed' ? '⛔' : '⚠️'
  const lines = [
    `- Graph API: ${icon(report.graph)} ${report.details.graph}`,
    `- Graph Security (XDR): ${icon(report.graphBetaSecurity)} ${report.details.graphBetaSecurity}`,
    `- Defender for Endpoint: ${icon(report.defender)} ${report.details.defender}`,
    `- Unified Audit Log: ${icon(report.managementActivity)} ${report.details.managementActivity}`,
  ]
  return lines.join('\n')
}
