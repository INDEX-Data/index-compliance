// =============================================================================
// Edge Function: get-access-reviews
// Queries Azure AD access review definitions and their status via Graph API.
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

    // Query access review definitions (beta API)
    let definitions: any[] = []
    try {
      definitions = await graphClient.queryAll('/identityGovernance/accessReviews/definitions', {
        apiVersion: 'beta',
      })
    } catch {
      return new Response(JSON.stringify({
        supported: false,
        message: 'Access Reviews not available. Requires Azure AD P2 license and AccessReview.Read.All permission.',
        configured: 0, onSchedule: 0, overdue: 0, definitions: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = Date.now()
    const results = definitions.map((d: any) => {
      const instances = d.instances ?? []
      const lastInstance = instances.length > 0 ? instances[instances.length - 1] : null
      const daysSinceLast = lastInstance?.startDateTime
        ? Math.floor((now - new Date(lastInstance.startDateTime).getTime()) / 86400000)
        : null

      const recurrence = d.settings?.recurrence
      const intervalDays = recurrence?.range?.numberOfOccurrences
        ? recurrence.range.numberOfOccurrences * (recurrence.pattern?.interval ?? 1)
        : null

      const overdue = daysSinceLast !== null && intervalDays !== null && daysSinceLast > intervalDays

      return {
        id: d.id,
        displayName: d.displayName,
        status: d.status,
        recurrenceType: recurrence?.pattern?.type ?? 'none',
        intervalDays,
        lastInstance: lastInstance ? {
          status: lastInstance.status,
          start: lastInstance.startDateTime,
          end: lastInstance.endDateTime,
        } : null,
        daysSinceLast,
        overdue,
        onSchedule: daysSinceLast !== null ? !overdue : null,
      }
    })

    return new Response(JSON.stringify({
      supported: true,
      configured: results.length,
      onSchedule: results.filter((r: any) => r.onSchedule === true).length,
      overdue: results.filter((r: any) => r.overdue).length,
      definitions: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Failed to query access reviews',
    }), {
      status: err instanceof Error && err.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
