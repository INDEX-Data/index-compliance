// Atlas — Microsoft Defender for Endpoint Query Functions
// Uses the same Azure app registration as Graph but with different scope
// Requires: Machine.Read.All, Vulnerability.Read.All, AdvancedQuery.Read.All, Alert.Read.All

const DEFENDER_BASE = 'https://api.securitycenter.microsoft.com'
const DEFENDER_SCOPE = 'https://api.securitycenter.microsoft.com/.default'

// ── Auth ──────────────────────────────────────────────────────────────────────

// Per-request cache (cache lives for the life of the request)
const tokenCache = new Map<string, { token: string; expiry: number }>()

export async function getDefenderToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cacheKey = `${tenantId}:${clientId}:defender`
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.token

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: DEFENDER_SCOPE,
        grant_type: 'client_credentials',
        client_secret: clientSecret,
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Defender auth failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  })
  return data.access_token
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function defenderGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${DEFENDER_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Defender API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function defenderPost(token: string, path: string, body: any): Promise<any> {
  const res = await fetch(`${DEFENDER_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Defender API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// ── Query Types ───────────────────────────────────────────────────────────────

export const DEFENDER_QUERY_TYPES = [
  'get_machines',
  'get_vulnerabilities',
  'get_recommendations',
  'get_software',
  'get_alerts',
  'get_exposure_score',
  'get_secure_score',
  'advanced_hunting',
] as const

export type DefenderQueryType = typeof DEFENDER_QUERY_TYPES[number]

interface DefenderResult {
  data: any
  summary: string
}

export async function executeDefenderQuery(
  token: string,
  queryType: string,
  params: Record<string, any> = {}
): Promise<DefenderResult> {
  switch (queryType) {
    // ── Device Inventory ────────────────────────────────────────────
    case 'get_machines': {
      const top = Math.min(params.limit || 50, 100)
      let path = `/api/machines?$top=${top}`
      if (params.filter) path += `&$filter=${encodeURIComponent(params.filter)}`
      const data = await defenderGet(token, path)
      const machines = (data.value || []).map((m: any) => ({
        id: m.id,
        computerDnsName: m.computerDnsName,
        osPlatform: m.osPlatform,
        osVersion: m.osVersion,
        healthStatus: m.healthStatus,
        riskScore: m.riskScore,
        exposureLevel: m.exposureLevel,
        onboardingStatus: m.onboardingStatus,
        lastSeen: m.lastSeen,
        avStatus: m.avStatus,
        managedBy: m.managedBy,
      }))
      return {
        data: machines,
        summary: `Found ${machines.length} devices (${machines.filter((m: any) => m.onboardingStatus === 'Onboarded').length} onboarded, ${machines.filter((m: any) => m.riskScore === 'High' || m.riskScore === 'Critical').length} high/critical risk)`,
      }
    }

    // ── Vulnerabilities ─────────────────────────────────────────────
    case 'get_vulnerabilities': {
      const top = Math.min(params.limit || 50, 100)
      let path = `/api/vulnerabilities?$top=${top}`
      if (params.filter) path += `&$filter=${encodeURIComponent(params.filter)}`
      const data = await defenderGet(token, path)
      const vulns = (data.value || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        description: v.description?.slice(0, 200),
        severity: v.severity,
        cvssV3: v.cvssV3,
        exposedMachines: v.exposedMachines,
        publishedOn: v.publishedOn,
        exploitVerified: v.exploitVerified,
        publicExploit: v.publicExploit,
      }))
      const critical = vulns.filter((v: any) => v.severity === 'Critical').length
      const high = vulns.filter((v: any) => v.severity === 'High').length
      return {
        data: vulns,
        summary: `Found ${vulns.length} vulnerabilities (${critical} critical, ${high} high)`,
      }
    }

    // ── Security Recommendations ────────────────────────────────────
    case 'get_recommendations': {
      const top = Math.min(params.limit || 30, 50)
      let path = `/api/recommendations?$top=${top}`
      if (params.filter) path += `&$filter=${encodeURIComponent(params.filter)}`
      const data = await defenderGet(token, path)
      const recs = (data.value || []).map((r: any) => ({
        id: r.id,
        productName: r.productName,
        recommendationName: r.recommendationName,
        recommendationCategory: r.recommendationCategory,
        subCategory: r.subCategory,
        severityScore: r.severityScore,
        exposedMachinesCount: r.exposedMachinesCount,
        remediationType: r.remediationType,
        status: r.status,
        configScoreImpact: r.configScoreImpact,
      }))
      return {
        data: recs,
        summary: `Found ${recs.length} security recommendations`,
      }
    }

    // ── Software Inventory ──────────────────────────────────────────
    case 'get_software': {
      const top = Math.min(params.limit || 50, 100)
      let path = `/api/software?$top=${top}`
      if (params.filter) path += `&$filter=${encodeURIComponent(params.filter)}`
      const data = await defenderGet(token, path)
      const sw = (data.value || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        vendor: s.vendor,
        vulnerabilities: s.vulnerabilities,
        activeAlert: s.activeAlert,
        exposedMachines: s.exposedMachines,
        impactScore: s.impactScore,
      }))
      return {
        data: sw,
        summary: `Found ${sw.length} software entries (${sw.filter((s: any) => s.vulnerabilities > 0).length} with known vulnerabilities)`,
      }
    }

    // ── Alerts ──────────────────────────────────────────────────────
    case 'get_alerts': {
      const top = Math.min(params.limit || 50, 200)
      let path = `/api/alerts?$top=${top}&$orderby=alertCreationTime desc`
      if (params.filter) path += `&$filter=${encodeURIComponent(params.filter)}`
      const data = await defenderGet(token, path)
      const alerts = (data.value || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        severity: a.severity,
        status: a.status,
        category: a.category,
        description: a.description?.slice(0, 200),
        alertCreationTime: a.alertCreationTime,
        assignedTo: a.assignedTo,
        detectionSource: a.detectionSource,
        machineId: a.machineId,
        computerDnsName: a.computerDnsName,
      }))
      return {
        data: alerts,
        summary: `Found ${alerts.length} Defender alerts (${alerts.filter((a: any) => a.severity === 'High' || a.severity === 'Critical').length} high/critical)`,
      }
    }

    // ── Exposure Score ──────────────────────────────────────────────
    case 'get_exposure_score': {
      const data = await defenderGet(token, '/api/exposureScore')
      return {
        data: {
          score: data.score,
          rbacGroupName: data.rbacGroupName,
        },
        summary: `Organization exposure score: ${data.score}/100`,
      }
    }

    // ── Defender Secure Score ───────────────────────────────────────
    case 'get_secure_score': {
      const data = await defenderGet(token, '/api/configurationScore')
      return {
        data: {
          score: data.score,
        },
        summary: `Defender configuration score: ${data.score}`,
      }
    }

    // ── Advanced Hunting (KQL) ──────────────────────────────────────
    case 'advanced_hunting': {
      const kql = params.kql
      if (!kql) throw new Error('KQL query string required in params.kql')
      // Safety: limit result set
      const safeKql = kql.includes('| take ') || kql.includes('| limit ')
        ? kql
        : `${kql} | take ${params.limit || 100}`
      const data = await defenderPost(token, '/api/advancedqueries/run', { Query: safeKql })
      return {
        data: {
          schema: data.Schema,
          results: data.Results,
          stats: data.Stats,
        },
        summary: `Advanced hunting query returned ${data.Results?.length || 0} results`,
      }
    }

    default:
      throw new Error(`Unknown Defender query type: ${queryType}`)
  }
}

// ── Describe for copilot step UI ──────────────────────────────────────────────

export function describeDefenderQuery(queryType: string, params: Record<string, any> = {}): string {
  const labels: Record<string, string> = {
    get_machines: 'Querying device inventory and health',
    get_vulnerabilities: 'Scanning vulnerability data',
    get_recommendations: 'Fetching security recommendations',
    get_software: 'Reviewing software inventory',
    get_alerts: 'Checking Defender alerts',
    get_exposure_score: 'Fetching exposure score',
    get_secure_score: 'Fetching Defender secure score',
    advanced_hunting: 'Running advanced hunting query',
  }
  return labels[queryType] || `Defender: ${queryType}`
}
