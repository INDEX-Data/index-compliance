// =============================================================================
// INDEX ATLAS — Shared Graph Client resolver for web routes
// Replaces the repeated "fetch client → decrypt → create GraphClient" pattern.
//
// As of the OAuth connector framework (Slice 1) this delegates to
// resolveM365Session(), which prefers a real admin-consent grant and falls back
// to the legacy per-customer secret. The return shape is unchanged
// ({ graphClient, client }) so all existing callers keep working; `source` is
// added for callers/telemetry that care which path was taken.
// =============================================================================

import { resolveM365Session } from '@/lib/connector-resolver'

/**
 * Resolves a GraphClient for a given user + optional client ID.
 * If clientId is omitted, returns the first client row for the user.
 * Throws with a user-friendly message if not found.
 */
export async function resolveGraphClient(userId: string, clientId?: string) {
  const { graphClient, client, source } = await resolveM365Session(userId, clientId)
  return { graphClient, client, source }
}
