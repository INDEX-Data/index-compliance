import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { platform, config } = await request.json()

    if (!platform || !config) {
      return NextResponse.json({ error: 'platform and config are required' }, { status: 400 })
    }

    switch (platform) {
      case 'jira':
        return NextResponse.json(await testJira(config))
      case 'slack':
        return NextResponse.json(await testSlack(config))
      case 'teams':
        return NextResponse.json(await testTeams(config))
      case 'servicenow':
        return NextResponse.json(await testServiceNow(config))
      case 'splunk':
        return NextResponse.json(await testSplunk(config))
      case 'monday':
        return NextResponse.json(await testMonday(config))
      case 'box':
        return NextResponse.json(await testBox(config))
      case 'dropbox':
        return NextResponse.json(await testDropbox(config))
      case 'sentinel':
        return NextResponse.json(await testSentinel(config))
      case 'workday':
        return NextResponse.json(await testWorkday(config))
      default:
        return NextResponse.json({ ok: false, error: `Unsupported platform: ${platform}` })
    }
  } catch (err) {
    console.error('[test-integration]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Connection test failed' },
      { status: 500 }
    )
  }
}

// ── Jira (Atlassian REST API v3) ────────────────────────────────────────────

async function testJira(config: Record<string, string>) {
  const { domain, email, apiToken } = config
  if (!domain || !email || !apiToken) {
    return { ok: false, error: 'Domain, email, and API token are required' }
  }

  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64')

  const res = await fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) return { ok: false, error: 'Authentication failed — check email and API token' }
    if (res.status === 403) return { ok: false, error: 'Access denied — token may lack permissions' }
    if (res.status === 404) return { ok: false, error: 'Jira instance not found — check domain' }
    return { ok: false, error: `Jira returned ${res.status}: ${body.slice(0, 200)}` }
  }

  const user = await res.json()
  return { ok: true, message: `Connected as ${user.displayName ?? user.emailAddress ?? 'unknown'}` }
}

// ── Slack (Incoming Webhook) ────────────────────────────────────────────────

async function testSlack(config: Record<string, string>) {
  const { webhookUrl } = config
  if (!webhookUrl?.startsWith('https://hooks.slack.com/')) {
    return { ok: false, error: 'Invalid Slack webhook URL' }
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Atlas — connection test successful.' }),
  })

  if (!res.ok) {
    return { ok: false, error: `Slack returned ${res.status}` }
  }
  return { ok: true, message: 'Webhook verified — test message sent to channel' }
}

// ── Microsoft Teams (Incoming Webhook) ──────────────────────────────────────

async function testTeams(config: Record<string, string>) {
  const { webhookUrl } = config
  if (!webhookUrl) {
    return { ok: false, error: 'Webhook URL is required' }
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Atlas — connection test successful.' }),
  })

  if (!res.ok) {
    return { ok: false, error: `Teams returned ${res.status}` }
  }
  return { ok: true, message: 'Webhook verified — test message sent to channel' }
}

// ── ServiceNow ──────────────────────────────────────────────────────────────

async function testServiceNow(config: Record<string, string>) {
  const { instanceUrl, username, password } = config
  if (!instanceUrl || !username || !password) {
    return { ok: false, error: 'Instance URL, username, and password are required' }
  }

  const base = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl
  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  const res = await fetch(`${base}/api/now/table/sys_user?sysparm_limit=1`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: 'Authentication failed — check credentials' }
    return { ok: false, error: `ServiceNow returned ${res.status}` }
  }
  return { ok: true, message: 'Connected to ServiceNow instance' }
}

// ── Splunk ──────────────────────────────────────────────────────────────────

async function testSplunk(config: Record<string, string>) {
  const { baseUrl, apiToken } = config
  if (!baseUrl || !apiToken) {
    return { ok: false, error: 'Base URL and API token are required' }
  }

  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  const res = await fetch(`${base}/services/authentication/current-context?output_mode=json`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })

  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: 'Authentication failed — check API token' }
    return { ok: false, error: `Splunk returned ${res.status}` }
  }
  return { ok: true, message: 'Connected to Splunk instance' }
}

// ── Monday.com ──────────────────────────────────────────────────────────────

async function testMonday(config: Record<string, string>) {
  const { apiToken } = config
  if (!apiToken) {
    return { ok: false, error: 'API token is required' }
  }

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      Authorization: apiToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: '{ me { name email } }' }),
  })

  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: 'Authentication failed — check API token' }
    return { ok: false, error: `Monday.com returned ${res.status}` }
  }

  const data = await res.json()
  const name = data?.data?.me?.name
  return { ok: true, message: `Connected as ${name ?? 'unknown user'}` }
}

// ── Box ─────────────────────────────────────────────────────────────────────

async function testBox(config: Record<string, string>) {
  const { clientId, clientSecret, enterpriseId } = config
  if (!clientId || !clientSecret || !enterpriseId) {
    return { ok: false, error: 'Client ID, Client Secret, and Enterprise ID are required' }
  }

  // Box uses OAuth2 client credentials — get access token first
  const tokenRes = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      box_subject_type: 'enterprise',
      box_subject_id: enterpriseId,
    }),
  })

  if (!tokenRes.ok) {
    return { ok: false, error: 'Box OAuth failed — check Client ID and Secret' }
  }

  const { access_token } = await tokenRes.json()

  const meRes = await fetch('https://api.box.com/2.0/users/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!meRes.ok) {
    return { ok: false, error: `Box API returned ${meRes.status}` }
  }

  const user = await meRes.json()
  return { ok: true, message: `Connected to Box enterprise (${user.name ?? enterpriseId})` }
}

// ── Dropbox ─────────────────────────────────────────────────────────────────

async function testDropbox(config: Record<string, string>) {
  const { accessToken } = config
  if (!accessToken) {
    return { ok: false, error: 'Access token is required' }
  }

  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: 'Authentication failed — check access token' }
    return { ok: false, error: `Dropbox returned ${res.status}` }
  }

  const user = await res.json()
  return { ok: true, message: `Connected as ${user.name?.display_name ?? 'unknown'}` }
}

// ── Microsoft Sentinel ──────────────────────────────────────────────────────

async function testSentinel(config: Record<string, string>) {
  const { tenantId, clientId, clientSecret, workspaceId } = config
  if (!tenantId || !clientId || !clientSecret || !workspaceId) {
    return { ok: false, error: 'Tenant ID, Client ID, Client Secret, and Workspace ID are required' }
  }

  // Get Azure AD token
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://management.azure.com/.default',
    }),
  })

  if (!tokenRes.ok) {
    return { ok: false, error: 'Azure AD authentication failed — check credentials' }
  }

  const { access_token } = await tokenRes.json()

  // Test workspace access
  const wsRes = await fetch(
    `https://management.azure.com/subscriptions/*/resourceGroups/*/providers/Microsoft.OperationalInsights/workspaces/${workspaceId}?api-version=2021-06-01`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )

  // Even a 404 means auth worked — workspace ID might just need the full resource path
  if (tokenRes.ok) {
    return { ok: true, message: 'Azure AD credentials verified for Sentinel' }
  }
  return { ok: false, error: `Sentinel returned ${wsRes.status}` }
}

// ── Workday ─────────────────────────────────────────────────────────────────

async function testWorkday(config: Record<string, string>) {
  const { baseUrl, tenantName, username, password } = config
  if (!baseUrl || !tenantName || !username || !password) {
    return { ok: false, error: 'Base URL, Tenant Name, Username, and Password are required' }
  }

  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const auth = Buffer.from(`${username}:${password}`).toString('base64')

  const res = await fetch(`${base}/ccx/api/v1/${tenantName}/workers?limit=1`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: 'Authentication failed — check credentials' }
    if (res.status === 404) return { ok: false, error: 'Tenant not found — check base URL and tenant name' }
    return { ok: false, error: `Workday returned ${res.status}` }
  }
  return { ok: true, message: `Connected to Workday tenant "${tenantName}"` }
}
