'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

// completeOnboarding — Server Action called by the onboarding wizard after
// saveProfile() succeeds on Railway.
//
// Using a Server Action (not a fetch to /api/*) because next.config.ts rewrites
// ALL /api/:path* to the Railway Express server. Server Actions POST to the
// current page URL with a Next-Action header — they are never caught by that
// rewrite. This guarantees the action runs on Vercel, where CLERK_SECRET_KEY
// is already configured for clerkMiddleware.
//
// Does two things:
//   1. Sets publicMetadata.onboarded = true on the Clerk user
//      (JWT gate — takes effect on next Clerk token refresh cycle)
//   2. Sets an idx_onboarded HttpOnly cookie
//      (instant gate — middleware reads this immediately, before JWT reissue)
export async function completeOnboarding(): Promise<{ ok: true } | { error: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    })
  } catch (err) {
    console.error('[onboarding] updateUserMetadata failed:', err)
    return { error: 'Failed to complete workspace setup' }
  }

  // Set the instant-gate cookie so middleware lets the user through on the
  // very next navigation — before Clerk reissues a JWT with onboarded=true.
  const cookieStore = await cookies()
  cookieStore.set('idx_onboarded', userId, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
  })

  return { ok: true }
}
