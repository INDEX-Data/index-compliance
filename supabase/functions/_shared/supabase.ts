// Supabase admin client for Edge Functions
// Uses service role key for full DB access (bypasses RLS)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// Supabase client scoped to the calling user's JWT (respects RLS)
export function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
    },
  )
}

// Extract user from JWT
export async function getUser(authHeader: string) {
  const client = createUserClient(authHeader)
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { user, client }
}
