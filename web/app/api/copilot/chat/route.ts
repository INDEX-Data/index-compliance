import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import env from '@/lib/env'
import { decryptIfNeeded } from '@/lib/crypto'
import {
  executeIntegrationQuery,
  isQueryable,
  getQueryTypes,
  describeIntegrationQuery,
} from '@/lib/integration-queries'
import {
  getDefenderToken,
  executeDefenderQuery,
  describeDefenderQuery,
  DEFENDER_QUERY_TYPES,
} from '@/lib/defender-queries'
import {
  getManagementActivityToken,
  executeAuditQuery,
  describeAuditQuery,
  AUDIT_QUERY_TYPES,
} from '@/lib/management-activity-queries'
import {
  checkAllPermissions,
  permissionsToPromptSection,
  type PermissionsReport,
} from '@/lib/permissions-check'
import Anthropic from '@anthropic-ai/sdk'

// ── Rate limiter ──────────────────────────────────────────────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW = 60_000

// ── Permissions cache (10 min TTL per client) ────────────────────────────────
const permissionsCache = new Map<string, { report: PermissionsReport; expiry: number }>()
const PERMISSIONS_CACHE_TTL = 10 * 60_000 // 10 minutes

async function getCachedPermissions(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<PermissionsReport> {
  const key = `${tenantId}:${clientId}`
  const cached = permissionsCache.get(key)
  if (cached && Date.now() < cached.expiry) return cached.report

  const report = await checkAllPermissions(tenantId, clientId, clientSecret)
  permissionsCache.set(key, { report, expiry: Date.now() + PERMISSIONS_CACHE_TTL })
  return report
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── Multi-scope token helper ──────────────────────────────────────────────────

const scopeTokenCache = new Map<string, { token: string; expiry: number }>()

async function getTokenForScope(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const cacheKey = `${tenantId}:${clientId}:${scope}`
  const cached = scopeTokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.token

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope,
      grant_type: 'client_credentials',
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Auth failed for scope ${scope}: ${res.status}`)
  const data = await res.json()
  scopeTokenCache.set(cacheKey, {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  })
  return data.access_token
}

async function getGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  return getTokenForScope(tenantId, clientId, clientSecret, 'https://graph.microsoft.com/.default')
}

async function graphQuery(
  token: string,
  endpoint: string,
  apiVersion: string = 'v1.0'
): Promise<any> {
  const base =
    apiVersion === 'beta' ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0'
  const url = `${base}${endpoint}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ConsistencyLevel: 'eventual',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Graph API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function graphPost(
  token: string,
  endpoint: string,
  body: any,
  apiVersion: string = 'beta'
): Promise<any> {
  const base =
    apiVersion === 'beta' ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0'
  const url = `${base}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph POST ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// ── Claude tools for Graph API ────────────────────────────────────────────────

const COPILOT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_graph_api',
    description: `Query the Microsoft Graph API for the active tenant. Use this to look up real-time data about the organization's M365 environment. Common endpoints:
- /users (list users, check MFA, licenses)
- /groups (security groups, M365 groups)
- /identity/conditionalAccess/policies (CA policies)
- /deviceManagement/deviceCompliancePolicies (Intune compliance)
- /deviceManagement/managedDevices (managed devices)
- /security/secureScores (Microsoft Secure Score)
- /security/alerts_v2 (security alerts)
- /security/incidents (XDR security incidents, beta)
- /security/incidents/{id}/alerts (alerts within an incident, beta)
- /identityProtection/riskyUsers (risky sign-ins)
- /reports/authenticationMethods/userRegistrationDetails (MFA registration)
- /roleManagement/directory/roleAssignments (privileged roles)
- /auditLogs/directoryAudits (audit logs)
- /auditLogs/signIns (sign-in logs)
- /domains (verified domains)
- /organization (org details)
- /subscribedSkus (license subscriptions)
- /informationProtection/policy/labels (sensitivity labels)
- /solutions/backupRestore/backupPolicies (backup policies, beta)

POST endpoints (set method to "POST" and provide post_body):
- POST /security/runHuntingQuery (advanced hunting with KQL via Graph, beta) — post_body: {"Query": "DeviceProcessEvents | where Timestamp > ago(1d) | take 10"}

You can use OData query params like $select, $filter, $top, $orderby, $count, $expand directly in the endpoint string. Use beta API version for endpoints that require it (e.g., security, some deviceManagement).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        endpoint: {
          type: 'string',
          description:
            'Graph API endpoint path, e.g. "/users?$select=displayName,mail,accountEnabled&$top=10"',
        },
        api_version: {
          type: 'string',
          enum: ['v1.0', 'beta'],
          description:
            'API version. Default v1.0. Use beta for security, some deviceManagement endpoints.',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST'],
          description: 'HTTP method. Default GET. Use POST for /security/runHuntingQuery.',
        },
        post_body: {
          type: 'object',
          description:
            'Body for POST requests. E.g., {"Query": "DeviceProcessEvents | take 10"} for hunting.',
        },
      },
      required: ['endpoint'],
    },
  },
  {
    name: 'get_assessment_reports',
    description:
      'Get all compliance assessment reports for the active client. Returns framework IDs, scores, dates, and control-level results. Use this to answer questions about past assessments, compliance scores, failing controls, trends over time, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        framework_id: {
          type: 'string',
          description:
            'Optional: filter to a specific framework (e.g., "cmmc-l2"). Omit to get all frameworks.',
        },
        limit: {
          type: 'number',
          description: 'Max number of reports to return. Default 10.',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_defender',
    description: `Query Microsoft Defender for Endpoint API for deep security data beyond Graph. Use this for vulnerability management, device health, security recommendations, and advanced threat hunting.

Query types:
- get_machines: Device inventory with risk scores, health status, AV status, onboarding status
- get_vulnerabilities: CVEs affecting the organization with severity, CVSS, exposed machine count
- get_recommendations: Security improvement actions with impact scores
- get_software: Installed software catalog with vulnerability counts
- get_alerts: Defender alerts (no 50-item limit, more detail than Graph alerts_v2)
- get_exposure_score: Organization-wide exposure metric (0-100)
- get_secure_score: Defender-specific configuration score
- advanced_hunting: Run KQL queries across device events, network events, email events, and more

For advanced_hunting, pass a KQL query in params.kql. Example: "DeviceProcessEvents | where FileName == 'powershell.exe' | take 20"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query_type: {
          type: 'string',
          enum: [...DEFENDER_QUERY_TYPES],
          description: 'Type of Defender query to run',
        },
        params: {
          type: 'object',
          description:
            'Query parameters. For advanced_hunting: {kql: "..."}. For others: {limit?: number, filter?: string}.',
          properties: {
            kql: { type: 'string', description: 'KQL query for advanced_hunting' },
            limit: { type: 'number', description: 'Max results to return' },
            filter: { type: 'string', description: 'OData filter expression' },
          },
        },
      },
      required: ['query_type'],
    },
  },
  {
    name: 'query_audit_log',
    description: `Query the Office 365 unified audit log for comprehensive audit data across all M365 workloads. Much richer than Graph's /auditLogs endpoint — covers Exchange, SharePoint, Teams, DLP events, and more.

Query types:
- get_dlp_events: Data Loss Prevention policy match events — shows which DLP policies triggered, what sensitive info was detected, what actions were taken (block, notify, override)
- get_exchange_audit: Exchange mailbox access, delegation changes, transport rule activity
- get_sharepoint_audit: SharePoint/OneDrive file access, sharing, permissions changes
- get_aad_audit: Azure AD operations (richer than Graph directory audits — includes PIM, B2B, app consent)
- get_general_audit: Teams, Power BI, Dynamics, and other workload events

Default time range is last 24 hours. Note: newly activated subscriptions may take up to 12 hours to start receiving events.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query_type: {
          type: 'string',
          enum: [...AUDIT_QUERY_TYPES],
          description: 'Type of audit data to query',
        },
        params: {
          type: 'object',
          description: 'Query parameters',
          properties: {
            start_time: {
              type: 'string',
              description: 'ISO 8601 start time. Default: 24 hours ago.',
            },
            end_time: { type: 'string', description: 'ISO 8601 end time. Default: now.' },
            filter: { type: 'string', description: 'Filter by operation name, user, or workload.' },
            limit: { type: 'number', description: 'Max events to return. Default 50, max 200.' },
          },
        },
      },
      required: ['query_type'],
    },
  },
]

// Build integration tool dynamically based on connected platforms
function buildIntegrationTool(
  connectedPlatforms: { platform: string; name?: string }[]
): Anthropic.Tool | null {
  const queryable = connectedPlatforms.filter((p) => isQueryable(p.platform))
  if (queryable.length === 0) return null

  const platformDocs = queryable
    .map((p) => {
      const types = getQueryTypes(p.platform)
      return `- **${p.platform}**${p.name ? ` (${p.name})` : ''}: query_types: ${types.join(', ')}`
    })
    .join('\n')

  return {
    name: 'query_integration',
    description: `Query a connected third-party integration for the active client. Use this to pull data from external tools connected to this organization.

Available platforms and query types:
${platformDocs}

Each query_type accepts different params — use reasonable defaults. For Jira search_issues, pass {jql: "..."} for JQL queries. For ServiceNow, pass {query: "..."} for encoded queries. For Splunk search, pass {query: "search ..."}.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          description: 'The integration platform to query',
          enum: queryable.map((p) => p.platform),
        },
        query_type: {
          type: 'string',
          description: 'The type of query to run (depends on platform)',
        },
        params: {
          type: 'object',
          description:
            'Query-specific parameters (e.g., jql, query, limit, issueKey, boardId, table, etc.)',
        },
      },
      required: ['platform', 'query_type'],
    },
  }
}

// ── Truncate large tool results ───────────────────────────────────────────────

function truncateResult(data: any, maxLen: number = 12000): string {
  const str = JSON.stringify(data, null, 2)
  if (str.length <= maxLen) return str
  // For arrays, trim items
  if (Array.isArray(data)) {
    const truncated = data.slice(0, 20)
    const note = `\n\n[...truncated: showing 20 of ${data.length} items. Ask me to narrow the query with $filter or $top if you need more.]`
    return JSON.stringify(truncated, null, 2) + note
  }
  if (data?.value && Array.isArray(data.value)) {
    const truncated = { ...data, value: data.value.slice(0, 20) }
    const note = `\n\n[...truncated: showing 20 of ${data.value.length} items. Use $filter, $top, or $select to narrow results.]`
    return JSON.stringify(truncated, null, 2) + note
  }
  return str.slice(0, maxLen) + '\n\n[...truncated]'
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Auth
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return Response.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 })
    }

    const anthropicKey = env.INDEX_ANTHROPIC_KEY
    if (!anthropicKey) {
      return Response.json(
        { error: 'Copilot not configured. Add INDEX_ANTHROPIC_KEY to .env.local' },
        { status: 500 }
      )
    }

    // Parse request
    const body = await request.json().catch(() => ({}))
    const {
      messages = [],
      context = {},
      conversationId: reqConversationId,
    } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      context: { clientId?: string; reportId?: string }
      conversationId?: string
    }

    const sanitized = messages.slice(-50).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content).slice(0, 4000),
    }))

    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
      return Response.json({ error: 'Messages must end with a user message' }, { status: 400 })
    }

    // Supabase admin client
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── Resolve active client ─────────────────────────────────────────────────
    let clientRow: any = null

    if (context.clientId) {
      const { data } = await admin
        .from('clients')
        .select('id, name, tenant_id, client_id, client_secret, added_at, notes')
        .eq('id', context.clientId)
        .eq('user_id', user.id)
        .single()
      clientRow = data
    }

    if (!clientRow) {
      const { data } = await admin
        .from('clients')
        .select('id, name, tenant_id, client_id, client_secret, added_at, notes')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
        .limit(1)
        .single()
      clientRow = data
    }

    // ── Load all context IN PARALLEL ──────────────────────────────────────────
    const [
      allClientsResult,
      reportsResult,
      integrationsResult,
      currentReportResult,
      permissionsResult,
    ] = await Promise.all([
      // 1. All clients
      admin
        .from('clients')
        .select('id, name, tenant_id, added_at')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false }),
      // 2. Recent reports
      clientRow
        ? admin
            .from('reports')
            .select('id, framework_id, generated_at, data')
            .eq('client_id', clientRow.id)
            .eq('user_id', user.id)
            .order('generated_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: null }),
      // 3. Connected integrations
      clientRow
        ? admin
            .from('client_integrations')
            .select('id, platform, config, status')
            .eq('client_id', clientRow.id)
            .eq('status', 'connected')
        : Promise.resolve({ data: null }),
      // 4. Current report (if viewing assessment)
      context.reportId
        ? admin
            .from('reports')
            .select('id, framework_id, generated_at, data')
            .eq('id', context.reportId)
            .eq('user_id', user.id)
            .single()
        : Promise.resolve({ data: null }),
      // 5. API permissions (cached 10 min)
      clientRow
        ? getCachedPermissions(
            decryptIfNeeded(clientRow.tenant_id),
            decryptIfNeeded(clientRow.client_id),
            decryptIfNeeded(clientRow.client_secret)
          ).catch(() => null)
        : Promise.resolve(null),
    ])

    const allClients = allClientsResult.data
    const clientsList =
      allClients && allClients.length > 0
        ? allClients
            .map(
              (c) =>
                `- **${c.name}** (Tenant: ${decryptIfNeeded(c.tenant_id)})${c.id === clientRow?.id ? ' ← ACTIVE' : ''}`
            )
            .join('\n')
        : 'No clients connected yet.'

    let reportsSection = 'No assessment history.'
    const reports = reportsResult.data
    if (reports && reports.length > 0) {
      reportsSection = reports
        .map((r: any) => {
          const d = r.data as any
          const controls = d?.controlAssessments || d?.controls || []
          const passed = controls.filter((c: any) => c.status === 'pass').length
          const failed = controls.filter((c: any) => c.status === 'fail').length
          const total = controls.length
          const score = total > 0 ? Math.round((passed / total) * 100) : 0
          return `- **${r.framework_id}** (${new Date(r.generated_at).toLocaleDateString()}) — ${score}% (${passed}/${total} pass, ${failed} fail)`
        })
        .join('\n')
    }

    let integrations: Array<{
      id: string
      platform: string
      config: Record<string, string>
      status: string
    }> = []
    let integrationsSection = 'No third-party integrations connected.'
    const intRows = integrationsResult.data
    if (intRows && intRows.length > 0) {
      integrations = intRows
      integrationsSection = intRows
        .map((i: any) => {
          const types = isQueryable(i.platform)
            ? getQueryTypes(i.platform).join(', ')
            : 'notifications only'
          return `- **${i.platform}** (${types})`
        })
        .join('\n')
    }

    let currentReportSection = ''
    const currentReport = currentReportResult.data as any
    if (currentReport) {
      const d = currentReport.data as any
      const controls = d?.controlAssessments || d?.controls || []
      const passed = controls.filter((c: any) => c.status === 'pass').length
      const failed = controls.filter((c: any) => c.status === 'fail').length
      const partial = controls.filter((c: any) => c.status === 'partial').length
      const failingControls = controls
        .filter((c: any) => c.status === 'fail')
        .slice(0, 10)
        .map(
          (c: any) =>
            `  - \`${c.controlId}\` ${c.controlTitle || c.title}: ${(c.findings || []).slice(0, 2).join('; ')}`
        )
        .join('\n')
      currentReportSection = `
## Currently Viewing Assessment
- **Framework**: ${currentReport.framework_id}
- **Generated**: ${new Date(currentReport.generated_at).toLocaleDateString()}
- **Score**: ${controls.length > 0 ? Math.round((passed / controls.length) * 100) : 0}% (${passed} pass, ${failed} fail, ${partial} partial out of ${controls.length})
${failingControls ? `- **Top Failing Controls**:\n${failingControls}` : ''}
${d?.summary?.topFindings ? `- **Key Findings**: ${d.summary.topFindings.slice(0, 3).join('; ')}` : ''}`
    }

    const permissionsReport: PermissionsReport | null =
      permissionsResult as PermissionsReport | null
    const permissionsSection = permissionsReport
      ? permissionsToPromptSection(permissionsReport)
      : 'Unable to check API permissions.'

    // ── Build dynamic tools list ─────────────────────────────────────────────
    const tools: Anthropic.Tool[] = clientRow ? [...COPILOT_TOOLS] : []

    // Only include query_defender if Defender API is actually accessible
    if (permissionsReport?.defender !== 'ok') {
      const defIdx = tools.findIndex((t) => t.name === 'query_defender')
      if (defIdx !== -1) tools.splice(defIdx, 1)
    }

    // Only include query_audit_log if Management Activity API is accessible
    if (permissionsReport?.managementActivity !== 'ok') {
      const auditIdx = tools.findIndex((t) => t.name === 'query_audit_log')
      if (auditIdx !== -1) tools.splice(auditIdx, 1)
    }

    const integrationTool = buildIntegrationTool(
      integrations.map((i) => ({ platform: i.platform }))
    )
    if (integrationTool) tools.push(integrationTool)

    // ── Build system prompt ───────────────────────────────────────────────────
    const activeClientInfo = clientRow
      ? `**${clientRow.name}** (Tenant: ${decryptIfNeeded(clientRow.tenant_id)})`
      : 'No client selected'

    const systemPrompt = `You are Atlas, the AI compliance copilot for the Atlas platform. You help MSPs, MSSPs, and IT administrators understand and improve their clients' compliance posture.

## Your Capabilities
You have LIVE ACCESS to the active tenant's Microsoft 365 environment via the Graph API. You can:
- Look up users, groups, devices, policies, and configurations in real time
- Check MFA enrollment, conditional access policies, device compliance
- Review security alerts, XDR incidents, risky users, audit logs
- Examine role assignments, license usage, sensitivity labels
- Answer compliance questions with actual data from the tenant
- Cross-reference assessment results with live environment state
${permissionsReport?.defender === 'ok' ? `- Query Microsoft Defender for Endpoint for device risk scores, CVEs, vulnerability management, security recommendations, and advanced threat hunting (KQL)` : ''}
${permissionsReport?.graphBetaSecurity === 'ok' ? `- Access XDR security incidents and run advanced hunting queries via Graph Security beta` : ''}
${permissionsReport?.managementActivity === 'ok' ? `- Query the Office 365 unified audit log for DLP events, Exchange, SharePoint, Teams, and Azure AD activity` : ''}

## Tools
- **query_graph_api**: Query the Microsoft Graph API for real-time tenant data. Supports GET and POST. Use POST with /security/runHuntingQuery for KQL advanced hunting. Use this proactively when the user asks about their environment. Don't just guess — pull the data.
- **get_assessment_reports**: Get past compliance assessment reports with control-level details.
${permissionsReport?.defender === 'ok' ? '- **query_defender**: Query Microsoft Defender for Endpoint — device inventory, vulnerabilities (CVEs), security recommendations, alerts, exposure score, and KQL advanced hunting. Use this for questions about endpoint security, vulnerability management, device health, or threat detection.' : ''}
${permissionsReport?.managementActivity === 'ok' ? '- **query_audit_log**: Query the Office 365 unified audit log — DLP policy events, Exchange mailbox audit, SharePoint/OneDrive file activity, Teams events, Azure AD operations. Use this for DLP enforcement data, comprehensive audit coverage, and workload-specific activity.' : ''}
${integrations.length > 0 ? '- **query_integration**: Query connected third-party integrations (Jira, ServiceNow, Splunk, etc.) for tickets, incidents, alerts, and more.' : ''}

## Active Organization
${activeClientInfo}

## All Connected Clients
${clientsList}

## Microsoft API Access
${permissionsSection || 'No client connected — cannot check.'}

## Connected Integrations
${integrationsSection}

## Recent Assessment History (Active Client)
${reportsSection}
${currentReportSection}

## Response Style
- Be proactive: if the user asks "is MFA enabled?" — query the Graph API to check, don't just explain what MFA is.
- Concise and direct. Bullet points for lists of 3+ items.
- Reference control IDs in backticks, e.g., \`AC.L2-3.1.1\`
- For remediation, give specific actionable steps for Microsoft 365 / Azure AD
- Use markdown formatting: headers, bold, code blocks, tables
- When showing data from Graph queries, summarize the key findings rather than dumping raw JSON
- If you find issues, explain the compliance impact and how to fix them

## Important Rules
- Never fabricate data. Use tools to get real information.
- Never expose tenant credentials, client secrets, or app registration details.
- All data you access is scoped to the active client shown above.
- If asked about a different client, tell the user to switch organizations first.
- If asked about something outside compliance/IT security, politely redirect.
- If the user asks about data that requires an API marked as 🔒 or ⛔ above, explain what permissions or licenses they need to enable it.
- For vulnerability or endpoint questions, prefer query_defender over query_graph_api when Defender is available.
- For KQL advanced hunting, prefer query_defender with advanced_hunting query type — it supports richer device/network/email tables.`

    // ── Agentic tool-use loop with live status streaming ────────────────────
    // Stream status events as tool calls happen, then stream the final text.
    // Protocol: lines starting with \x01 are JSON status events, everything else is text.

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    // Graph token cache for this request
    let graphToken: string | null = null
    async function getToken(): Promise<string> {
      if (graphToken) return graphToken
      if (!clientRow) throw new Error('No client connected')
      graphToken = await getGraphToken(
        decryptIfNeeded(clientRow.tenant_id),
        decryptIfNeeded(clientRow.client_id),
        decryptIfNeeded(clientRow.client_secret)
      )
      return graphToken
    }

    // Friendly descriptions for tool calls
    function describeToolCall(toolName: string, input: any): string {
      if (toolName === 'query_graph_api') {
        const ep = String(input.endpoint || '')
        if (ep.includes('/users')) return 'Querying users and authentication status'
        if (ep.includes('/conditionalAccess')) return 'Checking conditional access policies'
        if (ep.includes('/deviceManagement')) return 'Reviewing device management policies'
        if (ep.includes('/secureScores')) return 'Fetching Microsoft Secure Score'
        if (ep.includes('/security/alerts')) return 'Checking security alerts'
        if (ep.includes('/riskyUsers')) return 'Checking risky users'
        if (ep.includes('/roleManagement')) return 'Reviewing privileged role assignments'
        if (ep.includes('/auditLogs')) return 'Scanning audit logs'
        if (ep.includes('/groups')) return 'Querying security groups'
        if (ep.includes('/domains')) return 'Checking verified domains'
        if (ep.includes('/organization')) return 'Fetching organization details'
        if (ep.includes('/subscribedSkus')) return 'Checking license subscriptions'
        if (ep.includes('/authenticationMethods')) return 'Checking MFA registration details'
        if (ep.includes('/informationProtection')) return 'Reviewing sensitivity labels'
        if (ep.includes('/security/incidents')) return 'Checking XDR security incidents'
        if (ep.includes('/security/runHuntingQuery'))
          return 'Running advanced hunting query via Graph'
        return `Querying Graph API: ${ep.split('?')[0]}`
      }
      if (toolName === 'query_defender') {
        return describeDefenderQuery(String(input.query_type || ''), input.params || {})
      }
      if (toolName === 'query_audit_log') {
        return describeAuditQuery(String(input.query_type || ''))
      }
      if (toolName === 'get_assessment_reports') {
        if (input.framework_id)
          return `Pulling ${input.framework_id.toUpperCase()} assessment reports`
        return 'Pulling assessment reports'
      }
      if (toolName === 'query_integration') {
        const platform = String(input.platform || '').replace(/_/g, ' ')
        const queryType = String(input.query_type || '').replace(/_/g, ' ')
        return `Querying ${platform}: ${queryType}`
      }
      return `Running ${toolName}`
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        // Helper to send a status event
        function sendStatus(type: string, detail: string) {
          const event = JSON.stringify({ type, detail })
          controller.enqueue(encoder.encode(`\x01${event}\n`))
        }

        // ── Tool executor (reused across rounds) ──────────────────────
        async function executeTool(toolCall: {
          id: string
          name: string
          input: any
        }): Promise<{ id: string; result: string; desc: string; error?: boolean }> {
          const input = toolCall.input as any
          const desc = describeToolCall(toolCall.name, input)
          sendStatus('tool_start', desc)

          try {
            let result: string
            if (toolCall.name === 'query_graph_api') {
              const token = await getToken()
              let data: any
              if (input.method === 'POST' && input.post_body) {
                data = await graphPost(
                  token,
                  input.endpoint,
                  input.post_body,
                  input.api_version || 'beta'
                )
              } else {
                data = await graphQuery(token, input.endpoint, input.api_version || 'v1.0')
              }
              result = truncateResult(data)
              const count = data?.value?.length ?? data?.Results?.length ?? data?.length
              sendStatus(
                'tool_done',
                typeof count === 'number'
                  ? `${desc} — ${count} result${count !== 1 ? 's' : ''}`
                  : `${desc} — done`
              )
            } else if (toolCall.name === 'query_defender') {
              if (!clientRow) throw new Error('No client connected')
              const defToken = await getDefenderToken(
                decryptIfNeeded(clientRow.tenant_id),
                decryptIfNeeded(clientRow.client_id),
                decryptIfNeeded(clientRow.client_secret)
              )
              const defResult = await executeDefenderQuery(
                defToken,
                input.query_type,
                input.params || {}
              )
              result = truncateResult(defResult.data)
              sendStatus('tool_done', `${desc} — ${defResult.summary}`)
            } else if (toolCall.name === 'query_audit_log') {
              if (!clientRow) throw new Error('No client connected')
              const auditToken = await getManagementActivityToken(
                decryptIfNeeded(clientRow.tenant_id),
                decryptIfNeeded(clientRow.client_id),
                decryptIfNeeded(clientRow.client_secret)
              )
              const auditResult = await executeAuditQuery(
                auditToken,
                decryptIfNeeded(clientRow.tenant_id),
                input.query_type,
                input.params || {}
              )
              result = truncateResult(auditResult.data)
              sendStatus('tool_done', `${desc} — ${auditResult.summary}`)
            } else if (toolCall.name === 'get_assessment_reports') {
              let query = admin
                .from('reports')
                .select('id, framework_id, generated_at, data')
                .eq('user_id', user!.id)
                .eq('client_id', clientRow.id)
                .order('generated_at', { ascending: false })
                .limit(input.limit || 10)
              if (input.framework_id) query = query.eq('framework_id', input.framework_id)
              const { data: rpts, error } = await query
              if (error) throw new Error(error.message)
              const formatted = (rpts || []).map((r: any) => {
                const d = r.data as any
                const controls = d?.controlAssessments || d?.controls || []
                return {
                  reportId: r.id,
                  frameworkId: r.framework_id,
                  generatedAt: r.generated_at,
                  clientName: d?.clientName || d?.tenantDisplayName,
                  summary: d?.summary,
                  dibcacSummary: d?.dibcacSummary,
                  controls: controls.map((c: any) => ({
                    controlId: c.controlId,
                    title: c.controlTitle || c.title,
                    status: c.status,
                    findings: c.findings?.slice(0, 3),
                    recommendations: c.recommendations?.slice(0, 2),
                  })),
                }
              })
              result = truncateResult(formatted)
              sendStatus(
                'tool_done',
                `${desc} — ${(rpts || []).length} report${(rpts || []).length !== 1 ? 's' : ''}`
              )
            } else if (toolCall.name === 'query_integration') {
              const intConfig = integrations.find((i) => i.platform === input.platform)
              if (!intConfig) throw new Error(`Integration "${input.platform}" is not connected`)
              const decryptedConfig: Record<string, string> = {}
              for (const [k, v] of Object.entries(intConfig.config)) {
                decryptedConfig[k] = decryptIfNeeded(v as string)
              }
              const data: any = await executeIntegrationQuery(
                input.platform,
                decryptedConfig,
                input.query_type,
                input.params || {}
              )
              result = truncateResult(data)
              const count = Array.isArray(data) ? data.length : (data?.value?.length ?? data?.total)
              sendStatus(
                'tool_done',
                typeof count === 'number'
                  ? `${desc} — ${count} result${count !== 1 ? 's' : ''}`
                  : `${desc} — done`
              )
            } else {
              result = JSON.stringify({ error: `Unknown tool: ${toolCall.name}` })
              sendStatus('tool_done', `Unknown tool: ${toolCall.name}`)
            }
            return { id: toolCall.id, result, desc }
          } catch (err: any) {
            const errResult = JSON.stringify({ error: err.message || 'Tool execution failed' })
            sendStatus(
              'tool_error',
              `${desc} — failed: ${err.message?.slice(0, 100) || 'unknown error'}`
            )
            return { id: toolCall.id, result: errResult, desc, error: true }
          }
        }

        try {
          let currentMessages: Anthropic.MessageParam[] = [...sanitized]
          let maxToolRounds = 6
          let toolRound = 0
          let streamedText = ''

          while (maxToolRounds-- > 0) {
            toolRound++
            if (toolRound === 1) {
              sendStatus('thinking', 'Analyzing your question...')
            }

            // ── Single streaming call — stream text AND collect tool_use blocks ──
            const stream = anthropic.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools: tools.length > 0 ? tools : undefined,
              messages: currentMessages,
            })

            // Collect content blocks from the stream
            const contentBlocks: Anthropic.ContentBlock[] = []
            const toolUses: Array<{ id: string; name: string; input: any }> = []
            streamedText = ''

            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                // Stream text to client immediately
                controller.enqueue(encoder.encode(event.delta.text))
                streamedText += event.delta.text
              }
              // Collect completed blocks
              if (event.type === 'content_block_stop') {
                // Access the accumulated message to get the block
              }
            }

            // Get the final message to extract tool_use blocks
            const finalMessage = await stream.finalMessage()
            for (const block of finalMessage.content) {
              contentBlocks.push(block)
              if (block.type === 'tool_use') {
                toolUses.push({ id: block.id, name: block.name, input: block.input })
              }
              if (block.type === 'text') {
                // If we didn't stream it (e.g., it came with tool_use), capture it
                if (!streamedText && block.text) {
                  streamedText = block.text
                }
              }
            }

            // No tools → we're done, text already streamed
            if (toolUses.length === 0) {
              break
            }

            // ── Execute ALL tool calls in parallel ────────────────────────────
            const results = await Promise.all(toolUses.map((t) => executeTool(t)))

            const toolResults: Anthropic.ToolResultBlockParam[] = results.map((r) => ({
              type: 'tool_result' as const,
              tool_use_id: r.id,
              content: r.result,
            }))

            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: contentBlocks },
              { role: 'user', content: toolResults },
            ]
          }

          // ── Save conversation to DB ──────────────────────────────────────
          const assistantText = streamedText

          try {
            if (reqConversationId) {
              // Update existing conversation
              const { data: existing } = await admin
                .from('copilot_conversations')
                .select('messages')
                .eq('id', reqConversationId)
                .eq('user_id', user.id)
                .single()

              const prevMessages = Array.isArray(existing?.messages) ? existing.messages : []
              const newMsg = [
                { role: 'user', content: sanitized[sanitized.length - 1].content },
                ...(assistantText ? [{ role: 'assistant', content: assistantText }] : []),
              ]

              await admin
                .from('copilot_conversations')
                .update({
                  messages: [...prevMessages, ...newMsg],
                  updated_at: new Date().toISOString(),
                })
                .eq('id', reqConversationId)
                .eq('user_id', user.id)
            } else {
              // Create new conversation
              const firstUserMsg = sanitized[sanitized.length - 1].content
              const title = firstUserMsg.slice(0, 60) + (firstUserMsg.length > 60 ? '…' : '')
              const allMsgs = [
                ...sanitized.map((m) => ({ role: m.role, content: m.content })),
                ...(assistantText ? [{ role: 'assistant', content: assistantText }] : []),
              ]

              const { data: newConv } = await admin
                .from('copilot_conversations')
                .insert({
                  user_id: user.id,
                  client_id: clientRow?.id || null,
                  title,
                  messages: allMsgs,
                })
                .select('id')
                .single()

              // Send conversationId back as a status event so frontend can track it
              if (newConv?.id) {
                const convEvent = JSON.stringify({ type: 'conversation_id', detail: newConv.id })
                controller.enqueue(encoder.encode(`\x01${convEvent}\n`))
              }
            }
          } catch (saveErr) {
            console.error('[copilot/chat] conversation save error:', saveErr)
          }

          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[copilot/chat] error:', err)
    return Response.json(
      { error: 'An error occurred while processing your request.' },
      { status: 502 }
    )
  }
}
