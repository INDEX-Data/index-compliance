import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// POST /onboard-finish
// Called by the onboarding wizard after saveProfile() succeeds on Railway.
//
// WHY NOT /api/complete-onboarding:
//   next.config.ts rewrites /api/:path* → Railway Express server. Even with
//   afterFiles semantics, the broad wildcard catches /api/complete-onboarding
//   before the Next.js route handler can serve it. Placing this endpoint at
//   /onboard-finish puts it outside the /api/* rewrite entirely.
//
// WHY /onboard-finish WORKS WITH MIDDLEWARE:
//   Middleware has '/onboard(.*)' in isPublicRoute. The path /onboard-finish
//   matches that pattern, so:
//     • auth.protect() is not called (public route)
//     • The onboarding gate (userId && !isPublicRoute && !onboarded) is skipped
//   The route self-authenticates via auth() and returns 401 if no session.
//
// Does two things:
//   1. Sets publicMetadata.onboarded = true on the Clerk user (JWT gate)
//   2. Sets idx_onboarded HttpOnly cookie (instant gate for middleware)
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    })
  } catch (err) {
    console.error('[onboarding] updateUserMetadata failed:', err)
    return NextResponse.json({ error: 'Failed to complete workspace setup' }, { status: 500 })
  }

  // Set the instant-gate cookie so middleware lets the user through on the
  // very next navigation — before Clerk reissues a JWT with onboarded=true.
  const res = NextResponse.json({ ok: true })
  res.cookies.set('idx_onboarded', userId, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
  })
  return res
}
