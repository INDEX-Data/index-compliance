// Atlas — Integration Query Functions for Copilot
// Each platform has query functions that reuse auth patterns from test-integration

import { decryptIfNeeded } from '@/lib/crypto'

interface QueryResult {
  data: any
  summary: string
}

// ── Jira ──────────────────────────────────────────────────────────────────────

async function jiraRequest(config: Record<string, string>, path: string): Promise<any> {
  const domain = config.domain?.startsWith('http') ? config.domain : `https://${config.domain}`
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
  const res = await fetch(`${domain}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function queryJira(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  switch (queryType) {
    case 'search_issues': {
      const jql = params.jql || 'order by updated DESC'
      const maxResults = Math.min(params.limit || 20, 50)
      const data = await jiraRequest(config, `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,assignee,priority,updated,issuetype`)
      return {
        data: data.issues?.map((i: any) => ({
          key: i.key,
          summary: i.fields?.summary,
          status: i.fields?.status?.name,
          assignee: i.fields?.assignee?.displayName,
          priority: i.fields?.priority?.name,
          type: i.fields?.issuetype?.name,
          updated: i.fields?.updated,
        })),
        summary: `Found ${data.total} issues (showing ${data.issues?.length})`,
      }
    }
    case 'get_issue': {
      const data = await jiraRequest(config, `/rest/api/3/issue/${params.issueKey}?fields=summary,status,assignee,priority,description,comment,updated,issuetype`)
      return {
        data: {
          key: data.key,
          summary: data.fields?.summary,
          status: data.fields?.status?.name,
          assignee: data.fields?.assignee?.displayName,
          priority: data.fields?.priority?.name,
          type: data.fields?.issuetype?.name,
          updated: data.fields?.updated,
          commentCount: data.fields?.comment?.total,
        },
        summary: `Issue ${data.key}: ${data.fields?.summary}`,
      }
    }
    case 'get_projects': {
      const data = await jiraRequest(config, `/rest/api/3/project?maxResults=50`)
      return {
        data: data.map((p: any) => ({ key: p.key, name: p.name, type: p.projectTypeKey })),
        summary: `Found ${data.length} Jira projects`,
      }
    }
    default:
      throw new Error(`Unknown Jira query type: ${queryType}`)
  }
}

// ── ServiceNow ────────────────────────────────────────────────────────────────

async function snowRequest(config: Record<string, string>, path: string): Promise<any> {
  const base = config.instanceUrl?.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`ServiceNow ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function queryServiceNow(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  switch (queryType) {
    case 'get_incidents': {
      const limit = Math.min(params.limit || 20, 50)
      const query = params.query || 'active=true^ORDERBYDESCsys_updated_on'
      const data = await snowRequest(config, `/api/now/table/incident?sysparm_limit=${limit}&sysparm_query=${encodeURIComponent(query)}&sysparm_fields=number,short_description,state,priority,assigned_to,sys_updated_on,category`)
      return {
        data: data.result,
        summary: `Found ${data.result?.length || 0} incidents`,
      }
    }
    case 'get_changes': {
      const limit = Math.min(params.limit || 20, 50)
      const data = await snowRequest(config, `/api/now/table/change_request?sysparm_limit=${limit}&sysparm_query=ORDERBYDESCsys_updated_on&sysparm_fields=number,short_description,state,priority,assigned_to,sys_updated_on,type`)
      return {
        data: data.result,
        summary: `Found ${data.result?.length || 0} change requests`,
      }
    }
    case 'query_table': {
      const table = params.table || 'incident'
      const limit = Math.min(params.limit || 20, 50)
      const query = params.query || ''
      const fields = params.fields || ''
      let url = `/api/now/table/${table}?sysparm_limit=${limit}`
      if (query) url += `&sysparm_query=${encodeURIComponent(query)}`
      if (fields) url += `&sysparm_fields=${encodeURIComponent(fields)}`
      const data = await snowRequest(config, url)
      return {
        data: data.result,
        summary: `Queried ${table}: ${data.result?.length || 0} records`,
      }
    }
    default:
      throw new Error(`Unknown ServiceNow query type: ${queryType}`)
  }
}

// ── Splunk ────────────────────────────────────────────────────────────────────

async function splunkRequest(config: Record<string, string>, path: string, method = 'GET', body?: string): Promise<any> {
  const base = config.baseUrl?.replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    ...(body ? { body } : {}),
  })
  if (!res.ok) throw new Error(`Splunk ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function querySplunk(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  switch (queryType) {
    case 'search': {
      // Splunk oneshot search
      const searchQuery = params.query || 'search index=_internal | head 10'
      const data = await splunkRequest(
        config,
        '/services/search/jobs/export?output_mode=json',
        'POST',
        `search=${encodeURIComponent(searchQuery)}&earliest_time=${params.earliest || '-24h'}&latest_time=${params.latest || 'now'}`
      )
      return {
        data,
        summary: `Splunk search completed`,
      }
    }
    case 'get_alerts': {
      const data = await splunkRequest(config, '/services/alerts/fired_alerts?output_mode=json&count=20')
      return {
        data: data.entry?.map((e: any) => ({ name: e.name, triggered: e.updated, severity: e.content?.severity })),
        summary: `Found ${data.entry?.length || 0} fired alerts`,
      }
    }
    default:
      throw new Error(`Unknown Splunk query type: ${queryType}`)
  }
}

// ── Sentinel ──────────────────────────────────────────────────────────────────

async function getSentinelToken(config: Record<string, string>): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://management.azure.com/.default',
    }),
  })
  if (!res.ok) throw new Error('Sentinel auth failed')
  const data = await res.json()
  return data.access_token
}

async function querySentinel(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  const token = await getSentinelToken(config)
  const wsId = config.workspaceId

  switch (queryType) {
    case 'query_incidents': {
      const res = await fetch(
        `https://management.azure.com${wsId}/providers/Microsoft.SecurityInsights/incidents?api-version=2023-11-01&$top=${params.limit || 20}&$orderby=properties/createdTimeUtc desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`Sentinel ${res.status}`)
      const data = await res.json()
      return {
        data: data.value?.map((i: any) => ({
          id: i.name,
          title: i.properties?.title,
          severity: i.properties?.severity,
          status: i.properties?.status,
          created: i.properties?.createdTimeUtc,
        })),
        summary: `Found ${data.value?.length || 0} Sentinel incidents`,
      }
    }
    case 'get_alerts': {
      const res = await fetch(
        `https://management.azure.com${wsId}/providers/Microsoft.SecurityInsights/alertRules?api-version=2023-11-01`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`Sentinel ${res.status}`)
      const data = await res.json()
      return {
        data: data.value?.map((r: any) => ({
          name: r.properties?.displayName,
          type: r.kind,
          enabled: r.properties?.enabled,
          severity: r.properties?.severity,
        })),
        summary: `Found ${data.value?.length || 0} Sentinel alert rules`,
      }
    }
    default:
      throw new Error(`Unknown Sentinel query type: ${queryType}`)
  }
}

// ── Monday.com ────────────────────────────────────────────────────────────────

async function queryMonday(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  async function gql(query: string) {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { Authorization: config.apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) throw new Error(`Monday.com ${res.status}`)
    return res.json()
  }

  switch (queryType) {
    case 'get_boards': {
      const data = await gql('{ boards(limit: 25) { id name state board_kind items_count } }')
      return {
        data: data.data?.boards,
        summary: `Found ${data.data?.boards?.length || 0} boards`,
      }
    }
    case 'get_items': {
      const boardId = params.boardId
      if (!boardId) throw new Error('boardId is required')
      const data = await gql(`{ boards(ids: [${boardId}]) { items_page(limit: 25) { items { id name state column_values { id text } } } } }`)
      const items = data.data?.boards?.[0]?.items_page?.items
      return {
        data: items,
        summary: `Found ${items?.length || 0} items on board ${boardId}`,
      }
    }
    default:
      throw new Error(`Unknown Monday.com query type: ${queryType}`)
  }
}

// ── Box ───────────────────────────────────────────────────────────────────────

async function getBoxToken(config: Record<string, string>): Promise<string> {
  const res = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      box_subject_type: 'enterprise',
      box_subject_id: config.enterpriseId,
    }),
  })
  if (!res.ok) throw new Error('Box auth failed')
  const data = await res.json()
  return data.access_token
}

async function queryBox(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  const token = await getBoxToken(config)

  switch (queryType) {
    case 'search_files': {
      const q = params.query || '*'
      const res = await fetch(`https://api.box.com/2.0/search?query=${encodeURIComponent(q)}&limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Box ${res.status}`)
      const data = await res.json()
      return {
        data: data.entries?.map((e: any) => ({ id: e.id, name: e.name, type: e.type, size: e.size, modified: e.modified_at })),
        summary: `Found ${data.total_count || 0} files matching "${q}"`,
      }
    }
    case 'list_folders': {
      const folderId = params.folderId || '0'
      const res = await fetch(`https://api.box.com/2.0/folders/${folderId}/items?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Box ${res.status}`)
      const data = await res.json()
      return {
        data: data.entries?.map((e: any) => ({ id: e.id, name: e.name, type: e.type })),
        summary: `Found ${data.total_count || 0} items in folder`,
      }
    }
    default:
      throw new Error(`Unknown Box query type: ${queryType}`)
  }
}

// ── Dropbox ───────────────────────────────────────────────────────────────────

async function queryDropbox(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  switch (queryType) {
    case 'search_files': {
      const q = params.query || ''
      if (!q) throw new Error('Search query is required')
      const res = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q, options: { max_results: 25 } }),
      })
      if (!res.ok) throw new Error(`Dropbox ${res.status}`)
      const data = await res.json()
      return {
        data: data.matches?.map((m: any) => ({
          name: m.metadata?.metadata?.name,
          path: m.metadata?.metadata?.path_display,
          size: m.metadata?.metadata?.size,
          modified: m.metadata?.metadata?.server_modified,
        })),
        summary: `Found ${data.matches?.length || 0} files matching "${q}"`,
      }
    }
    default:
      throw new Error(`Unknown Dropbox query type: ${queryType}`)
  }
}

// ── Workday ───────────────────────────────────────────────────────────────────

async function queryWorkday(config: Record<string, string>, queryType: string, params: any): Promise<QueryResult> {
  const base = config.baseUrl?.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  switch (queryType) {
    case 'get_workers': {
      const limit = Math.min(params.limit || 20, 50)
      const res = await fetch(`${base}/ccx/api/v1/${config.tenantName}/workers?limit=${limit}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`Workday ${res.status}`)
      const data = await res.json()
      return {
        data: data.data,
        summary: `Found ${data.total || data.data?.length || 0} workers`,
      }
    }
    default:
      throw new Error(`Unknown Workday query type: ${queryType}`)
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

// Platforms that support querying (not webhook-only)
const QUERYABLE_PLATFORMS: Record<string, string[]> = {
  jira: ['search_issues', 'get_issue', 'get_projects'],
  servicenow: ['get_incidents', 'get_changes', 'query_table'],
  splunk: ['search', 'get_alerts'],
  sentinel: ['query_incidents', 'get_alerts'],
  monday: ['get_boards', 'get_items'],
  box: ['search_files', 'list_folders'],
  dropbox: ['search_files'],
  workday: ['get_workers'],
}

export function isQueryable(platform: string): boolean {
  return platform in QUERYABLE_PLATFORMS
}

export function getQueryTypes(platform: string): string[] {
  return QUERYABLE_PLATFORMS[platform] || []
}

export function describeIntegrationQuery(platform: string, queryType: string, params: any): string {
  const labels: Record<string, string> = {
    search_issues: 'Searching Jira issues',
    get_issue: `Looking up Jira issue ${params?.issueKey || ''}`,
    get_projects: 'Listing Jira projects',
    get_incidents: 'Querying ServiceNow incidents',
    get_changes: 'Querying ServiceNow change requests',
    query_table: `Querying ServiceNow ${params?.table || 'table'}`,
    search: 'Running Splunk search',
    get_alerts: `Checking ${platform === 'sentinel' ? 'Sentinel' : 'Splunk'} alerts`,
    query_incidents: 'Querying Sentinel security incidents',
    get_boards: 'Listing Monday.com boards',
    get_items: 'Fetching Monday.com items',
    search_files: `Searching ${platform === 'box' ? 'Box' : 'Dropbox'} files`,
    list_folders: 'Listing Box folders',
    get_workers: 'Querying Workday workers',
  }
  return labels[queryType] || `Querying ${platform}: ${queryType}`
}

export async function executeIntegrationQuery(
  platform: string,
  rawConfig: Record<string, string>,
  queryType: string,
  params: any = {}
): Promise<QueryResult> {
  // Decrypt all config values
  const config: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawConfig)) {
    config[k] = decryptIfNeeded(v)
  }

  switch (platform) {
    case 'jira':        return queryJira(config, queryType, params)
    case 'servicenow':  return queryServiceNow(config, queryType, params)
    case 'splunk':      return querySplunk(config, queryType, params)
    case 'sentinel':    return querySentinel(config, queryType, params)
    case 'monday':      return queryMonday(config, queryType, params)
    case 'box':         return queryBox(config, queryType, params)
    case 'dropbox':     return queryDropbox(config, queryType, params)
    case 'workday':     return queryWorkday(config, queryType, params)
    default:
      throw new Error(`Platform "${platform}" does not support queries`)
  }
}
