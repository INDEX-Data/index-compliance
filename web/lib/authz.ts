// =============================================================================
// INDEX ATLAS — Authorization helpers
//
// The service-role Supabase client BYPASSES Row Level Security. Any route that
// reads report-scoped data with the service-role key MUST verify ownership in
// code — RLS will not do it for you. Centralizing that check here means the
// "service-role + ownership" pattern can't be silently forgotten on a new route
// (which is exactly how the two cross-tenant IDOR leaks happened).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verify the authenticated user owns `reportId`, returning the report row
 * (with the requested columns) or `null` if it does not exist or is not owned.
 *
 * Pass the columns you need via `select` (e.g. `'id'` for a pure ownership
 * gate, or `'data'` to also load the report payload in the same round trip).
 *
 * Usage:
 *   const owned = await getOwnedReport(admin, reportId, user.id)
 *   if (!owned) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
 */
export async function getOwnedReport<T = { id: string }>(
  admin: SupabaseClient,
  reportId: string,
  userId: string,
  select = 'id'
): Promise<T | null> {
  const { data, error } = await admin
    .from('reports')
    .select(select)
    .eq('id', reportId)
    .eq('user_id', userId) // ← the ownership gate the service role would otherwise skip
    .single()
  if (error || !data) return null
  return data as T
}
