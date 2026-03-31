// =============================================================================
// Edge Function: get-ca-exclusions
// Scans Conditional Access policies for user/group exclusions via Graph API.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { createAdminClient, getUser } from '../_shared/supabase.ts'
import { GraphClient } from '../_shared/graph-client.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const { user } = await getUser(authHeader)
    const admin = createAdminClient()
    const body = await req.json()
    const { clientId } = body

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get client Azure credentials
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('tenant_id, client_id, client_secret')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single()

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const graphClient = new GraphClient({
      tenantId: client.tenant_id,
      clientId: client.client_id,
      clientSecret: client.client_secret,
    })

    // Fetch CA policies
    const policies = await graphClient.queryAll<any>('/identity/conditionalAccess/policies')

    // Load existing snapshots
    const { data: snapshots } = await admin
      .from('ca_exclusion_snapshots')
      .select('*')
      .eq('client_id', clientId)

    const snapshotMap = new Map((snapshots ?? []).map(s => [s.policy_id, s]))

    const results = []
    for (const p of policies) {
      const excludedUsers: string[] = p.conditions?.users?.excludeUsers ?? []
      const excludedGroups: string[] = p.conditions?.users?.excludeGroups ?? []

      if (excludedUsers.length === 0 && excludedGroups.length === 0) continue

      const prev = snapshotMap.get(p.id)
      const changed = prev
        ? (JSON.stringify(prev.excluded_users) !== JSON.stringify(excludedUsers) ||
           JSON.stringify(prev.excluded_groups) !== JSON.stringify(excludedGroups))
        : false

      // Upsert snapshot
      await admin.from('ca_exclusion_snapshots').upsert({
        client_id: clientId,
        user_id: user.id,
        policy_id: p.id,
        policy_name: p.displayName,
        excluded_users: excludedUsers,
        excluded_groups: excludedGroups,
        changed: changed ? 'yes' : 'no',
        scanned_at: new Date().toISOString(),
        justification: prev?.justification ?? null,
      }, { onConflict: 'client_id,policy_id' })

      results.push({
        policyId: p.id,
        policyName: p.displayName,
        state: p.state,
        excludedUsers,
        excludedGroups,
        justification: prev?.justification ?? null,
        changed,
        scannedAt: new Date().toISOString(),
      })
    }

    return new Response(JSON.stringify({
      policies: results,
      total: results.length,
      withChanges: results.filter(r => r.changed).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Failed to scan CA exclusions',
    }), {
      status: err instanceof Error && err.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
