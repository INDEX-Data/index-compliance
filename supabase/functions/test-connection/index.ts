// =============================================================================
// Edge Function: test-connection
// Tests Azure AD credentials by attempting a Graph API call.
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

    let tenantId: string, clientId: string, clientSecret: string

    if (body.clientId && !body.tenantId) {
      // Testing an existing client by its DB ID
      const { data: client, error } = await admin
        .from('clients')
        .select('tenant_id, client_id, client_secret')
        .eq('id', body.clientId)
        .eq('user_id', user.id)
        .single()
      if (error || !client) {
        return new Response(JSON.stringify({ ok: false, error: 'Client not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      tenantId = client.tenant_id
      clientId = client.client_id
      clientSecret = client.client_secret
    } else {
      // Testing raw credentials
      tenantId = body.tenantId
      clientId = body.clientId
      clientSecret = body.clientSecret
      if (!tenantId || !clientId || !clientSecret) {
        return new Response(JSON.stringify({ ok: false, error: 'tenantId, clientId, and clientSecret are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const graphClient = new GraphClient({ tenantId, clientId, clientSecret })

    // Try to read /organization to verify credentials and get tenant name
    const result = await graphClient.rawQuery('/organization?$select=displayName,verifiedDomains') as any
    const org = Array.isArray(result.value) ? result.value[0] : result
    const tenantName = org?.displayName ?? 'Unknown'
    const domain = (org?.verifiedDomains as any[])?.find((d: any) => d.isDefault)?.name

    return new Response(JSON.stringify({ ok: true, tenantName, domain }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed'
    const status = message === 'Unauthorized' ? 401 : 200
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
