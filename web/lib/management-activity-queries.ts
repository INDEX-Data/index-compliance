// Atlas — Office 365 Management Activity API (Unified Audit Log)
// Provides DLP events, Exchange/SharePoint/Teams audit data beyond Graph's directory audits
// Uses same Azure app registration with scope: https://manage.office.com/.default
// Requires: ActivityFeed.Read permission in Office 365 Management APIs

const MGMT_ACTIVITY_BASE = 'https://manage.office.com/api/v1.0'
const MGMT_ACTIVITY_SCOPE = 'https://manage.office.com/.default'

// ── Auth ──────────────────────────────────────────────────────────────────────

const tokenCache = new Map<string, { token: string; expiry: number }>()

export async function getManagementActivityToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cacheKey = `${tenantId}:${clientId}:mgmt_activity`
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.token

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: MGMT_ACTIVITY_SCOPE,
        grant_type: 'client_credentials',
        client_secret: clientSecret,
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Management Activity auth failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  })
  return data.access_token
}

// ── Content Types ─────────────────────────────────────────────────────────────

export const CONTENT_TYPES = {
  dlp: 'DLP.All',
  exchange: 'Audit.Exchange',
  sharepoint: 'Audit.SharePoint',
  aad: 'Audit.AzureActiveDirectory',
  general: 'Audit.General',
} as const

export type ContentTypeKey = keyof typeof CONTENT_TYPES

export const AUDIT_QUERY_TYPES = [
  'get_dlp_events',
  'get_exchange_audit',
  'get_sharepoint_audit',
  'get_aad_audit',
  'get_general_audit',
] as const

// ── Subscription Management ───────────────────────────────────────────────────

async function ensureSubscription(
  token: string,
  tenantId: string,
  contentType: string
): Promise<void> {
  const base = `${MGMT_ACTIVITY_BASE}/${tenantId}/activity/feed`

  // List existing subscriptions
  const listRes = await fetch(`${base}/subscriptions/list`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (listRes.ok) {
    const subs = await listRes.json()
    const exists = (subs as any[]).some(
      (s: any) => s.contentType === contentType && s.status === 'enabled'
    )
    if (exists) return
  }

  // Start subscription if not found
  const startRes = await fetch(
    `${base}/subscriptions/start?contentType=${contentType}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!startRes.ok) {
    const body = await startRes.text()
    // 409 = already exists, that's fine
    if (startRes.status !== 409) {
      throw new Error(`Failed to start subscription for ${contentType}: ${startRes.status} ${body.slice(0, 200)}`)
    }
  }
}

// ── Content Fetching ──────────────────────────────────────────────────────────

interface AuditEvent {
  Id: string
  CreationTime: string
  Operation: string
  OrganizationId: string
  UserType: number
  UserId: string
  Workload: string
  [key: string]: any
}

interface AuditQueryResult {
  data: AuditEvent[]
  summary: string
}

async function fetchAuditContent(
  token: string,
  tenantId: string,
  contentType: string,
  startTime?: string,
  endTime?: string,
  maxEvents: number = 50
): Promise<AuditEvent[]> {
  const base = `${MGMT_ACTIVITY_BASE}/${tenantId}/activity/feed`

  // Default to last 24 hours
  const now = new Date()
  const start = startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const end = endTime || now.toISOString()

  // Ensure subscription is active
  await ensureSubscription(token, tenantId, contentType)

  // List available content blobs
  const contentUrl = `${base}/subscriptions/content?contentType=${contentType}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`
  const contentRes = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!contentRes.ok) {
    const body = await contentRes.text()
    // If no content available yet (subscription just started), return empty
    if (contentRes.status === 404 || body.includes('AF20024')) {
      return []
    }
    throw new Error(`Failed to list content for ${contentType}: ${contentRes.status} ${body.slice(0, 200)}`)
  }

  const contentList = await contentRes.json() as Array<{ contentUri: string; contentId: string }>

  if (!contentList || contentList.length === 0) return []

  // Fetch content blobs (limit to first few to avoid excessive API calls)
  const blobLimit = Math.min(contentList.length, 5)
  const allEvents: AuditEvent[] = []

  for (let i = 0; i < blobLimit && allEvents.length < maxEvents; i++) {
    try {
      const blobRes = await fetch(contentList[i].contentUri, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (blobRes.ok) {
        const events = await blobRes.json() as AuditEvent[]
        allEvents.push(...events)
      }
    } catch {
      // Skip failed blobs
    }
  }

  return allEvents.slice(0, maxEvents)
}

// ── Query Execution ───────────────────────────────────────────────────────────

function mapQueryTypeToContentType(queryType: string): string {
  const mapping: Record<string, string> = {
    get_dlp_events: CONTENT_TYPES.dlp,
    get_exchange_audit: CONTENT_TYPES.exchange,
    get_sharepoint_audit: CONTENT_TYPES.sharepoint,
    get_aad_audit: CONTENT_TYPES.aad,
    get_general_audit: CONTENT_TYPES.general,
  }
  return mapping[queryType] || CONTENT_TYPES.general
}

function formatDLPEvent(event: AuditEvent): any {
  return {
    id: event.Id,
    time: event.CreationTime,
    operation: event.Operation,
    user: event.UserId,
    policyName: event.PolicyDetails?.[0]?.PolicyName || event.PolicyName,
    ruleName: event.PolicyDetails?.[0]?.Rules?.[0]?.RuleName || event.RuleName,
    action: event.PolicyDetails?.[0]?.Rules?.[0]?.Actions?.join(', ') || event.Actions,
    severity: event.PolicyDetails?.[0]?.Rules?.[0]?.Severity || event.Severity,
    sensitiveInfoType: event.SensitiveInfoDetectionIsIncluded,
    fileName: event.SharePointMetaData?.FileName || event.ExchangeMetaData?.Subject,
    matchCount: event.PolicyDetails?.[0]?.Rules?.[0]?.ConditionsMatched?.SensitiveInformation?.length,
  }
}

function formatAuditEvent(event: AuditEvent): any {
  return {
    id: event.Id,
    time: event.CreationTime,
    operation: event.Operation,
    user: event.UserId,
    workload: event.Workload,
    objectId: event.ObjectId,
    clientIP: event.ClientIP,
    resultStatus: event.ResultStatus,
    // Include workload-specific fields
    ...(event.Workload === 'Exchange' ? {
      subject: event.AffectedItems?.[0]?.Subject,
      mailboxOwner: event.MailboxOwnerUPN,
    } : {}),
    ...(event.Workload === 'SharePoint' || event.Workload === 'OneDrive' ? {
      fileName: event.SourceFileName,
      fileExtension: event.SourceFileExtension,
      siteUrl: event.SiteUrl,
    } : {}),
    ...(event.Workload === 'AzureActiveDirectory' ? {
      target: event.Target?.[0]?.ID,
      modifiedProperties: event.ModifiedProperties?.slice(0, 3),
    } : {}),
  }
}

export async function executeAuditQuery(
  token: string,
  tenantId: string,
  queryType: string,
  params: Record<string, any> = {}
): Promise<AuditQueryResult> {
  const contentType = mapQueryTypeToContentType(queryType)
  const maxEvents = Math.min(params.limit || 50, 200)

  const events = await fetchAuditContent(
    token,
    tenantId,
    contentType,
    params.start_time,
    params.end_time,
    maxEvents
  )

  // Apply operation filter if provided
  let filtered = events
  if (params.filter) {
    const filterLower = params.filter.toLowerCase()
    filtered = events.filter(e =>
      e.Operation?.toLowerCase().includes(filterLower) ||
      e.UserId?.toLowerCase().includes(filterLower) ||
      e.Workload?.toLowerCase().includes(filterLower)
    )
  }

  // Format based on content type
  const formatted = queryType === 'get_dlp_events'
    ? filtered.map(formatDLPEvent)
    : filtered.map(formatAuditEvent)

  // Build summary
  const opCounts: Record<string, number> = {}
  for (const e of filtered) {
    const op = e.Operation || 'Unknown'
    opCounts[op] = (opCounts[op] || 0) + 1
  }
  const topOps = Object.entries(opCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([op, count]) => `${op}: ${count}`)
    .join(', ')

  const timeRange = params.start_time
    ? `${params.start_time} to ${params.end_time || 'now'}`
    : 'last 24 hours'

  return {
    data: formatted,
    summary: `${filtered.length} ${contentType} events (${timeRange})${topOps ? ` — top operations: ${topOps}` : ''}`,
  }
}

// ── Describe for copilot step UI ──────────────────────────────────────────────

export function describeAuditQuery(queryType: string): string {
  const labels: Record<string, string> = {
    get_dlp_events: 'Querying DLP policy events from unified audit log',
    get_exchange_audit: 'Querying Exchange audit events',
    get_sharepoint_audit: 'Querying SharePoint/OneDrive audit events',
    get_aad_audit: 'Querying Azure AD audit events',
    get_general_audit: 'Querying general audit events (Teams, Power BI, etc.)',
  }
  return labels[queryType] || `Querying unified audit log: ${queryType}`
}
