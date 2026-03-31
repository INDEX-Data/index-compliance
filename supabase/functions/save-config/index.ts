// =============================================================================
// Edge Function: save-config
// Saves Azure AD credentials as a new client entry.
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
    const { tenantId, clientId, clientSecret, tenantName } = body

    if (!tenantId || !clientId || !clientSecret) {
      return new Response(JSON.stringify({ ok: false, error: 'tenantId, clientId, and clientSecret are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error } = await admin
      .from('clients')
      .insert({
        user_id: user.id,
        external_id: crypto.randomUUID(),
        name: tenantName ?? 'Default Tenant',
        tenant_id: tenantId,
        client_id: clientId,
        client_secret: clientSecret,
      })

    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : 'Save failed',
    }), {
      status: err instanceof Error && err.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
