// =============================================================================
// Edge Function: scan-tickets
// Scans Jira/ServiceNow tickets and matches them to compliance controls.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { createAdminClient, getUser } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const { user } = await getUser(authHeader)
    const admin = createAdminClient()
    const body = await req.json()
    const { clientId, platform, frameworkId, projectKey } = body

    if (!clientId || !platform) {
      return new Response(JSON.stringify({ error: 'clientId and platform are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get integration credentials
    const { data: integration } = await admin
      .from('client_integrations')
      .select('config')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .single()

    if (!integration?.config) {
      return new Response(JSON.stringify({ error: `No ${platform} integration configured for this client` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const config = integration.config as Record<string, string>
    let tickets: any[] = []

    // Fetch tickets from platform
    if (platform === 'jira') {
      const jql = projectKey
        ? `project = "${projectKey}" ORDER BY updated DESC`
        : 'ORDER BY updated DESC'

      const jiraUrl = `${config.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100`
      const auth = btoa(`${config.email}:${config.apiToken}`)

      const res = await fetch(jiraUrl, {
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`Jira API error: ${res.status}`)
      const data = await res.json()
      tickets = (data.issues ?? []).map((issue: any) => ({
        id: issue.key,
        title: issue.fields?.summary ?? '',
        description: issue.fields?.description?.content?.[0]?.content?.[0]?.text ?? '',
        url: `${config.baseUrl}/browse/${issue.key}`,
      }))
    } else if (platform === 'servicenow') {
      const snUrl = `${config.instanceUrl}/api/now/table/incident?sysparm_limit=100&sysparm_fields=number,short_description,description`
      const auth = btoa(`${config.username}:${config.password}`)

      const res = await fetch(snUrl, {
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`ServiceNow API error: ${res.status}`)
      const data = await res.json()
      tickets = (data.result ?? []).map((inc: any) => ({
        id: inc.number,
        title: inc.short_description ?? '',
        description: inc.description ?? '',
        url: `${config.instanceUrl}/nav_to.do?uri=incident.do?sysparm_query=number=${inc.number}`,
      }))
    }

    // Load framework controls for matching
    // Simple token-overlap scoring (Jaccard similarity)
    let controls: { controlId: string; title: string; keywords: string[] }[] = []
    try {
      const registry = await import('../_shared/framework-registry.ts')
      const fw = registry.getFramework(frameworkId ?? 'CMMC_L2')
      if (fw) {
        controls = fw.controls.map(c => ({
          controlId: c.controlId,
          title: c.title,
          keywords: `${c.title} ${c.description}`.toLowerCase().split(/\W+/).filter(w => w.length > 3),
        }))
      }
    } catch { /* use empty controls */ }

    const nominations: any[] = []
    for (const ticket of tickets) {
      const ticketTokens = `${ticket.title} ${ticket.description}`.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3)
      const ticketSet = new Set(ticketTokens)

      for (const control of controls) {
        const controlSet = new Set(control.keywords)
        const intersection = [...ticketSet].filter(t => controlSet.has(t))
        const union = new Set([...ticketSet, ...controlSet])
        const confidence = union.size > 0 ? Math.round((intersection.length / union.size) * 100) : 0

        if (confidence >= 15) {
          nominations.push({
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            ticketUrl: ticket.url,
            controlId: control.controlId,
            controlTitle: control.title,
            confidence,
          })
        }
      }
    }

    // Keep top 3 per ticket, sort by confidence
    const grouped = new Map<string, any[]>()
    for (const n of nominations) {
      const arr = grouped.get(n.ticketId) ?? []
      arr.push(n)
      grouped.set(n.ticketId, arr)
    }

    const topNominations: any[] = []
    for (const [, noms] of grouped) {
      noms.sort((a: any, b: any) => b.confidence - a.confidence)
      topNominations.push(...noms.slice(0, 3))
    }

    // Upsert into ticket_nominations
    for (const n of topNominations) {
      await admin.from('ticket_nominations').upsert({
        client_id: clientId,
        user_id: user.id,
        platform,
        ticket_id: n.ticketId,
        ticket_title: n.ticketTitle,
        ticket_url: n.ticketUrl,
        control_id: n.controlId,
        control_title: n.controlTitle,
        framework_id: frameworkId ?? 'CMMC_L2',
        confidence: n.confidence,
        status: 'pending',
      }, { onConflict: 'client_id,platform,ticket_id,control_id' }).catch(() => {
        // Ignore upsert conflicts on missing unique constraint
      })
    }

    return new Response(JSON.stringify({
      scanned: tickets.length,
      nominated: topNominations.length,
      nominations: topNominations,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Ticket scan failed',
    }), {
      status: err instanceof Error && err.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
