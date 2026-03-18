import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// POST /api/complete-onboarding
// Called by the onboarding wizard after saveProfile() succeeds on Railway.
// Does two things:
//   1. Sets publicMetadata.onboarded = true on the Clerk user (JWT gate,
//      takes effect on next Clerk token refresh cycle).
//   2. Sets an idx_onboarded HttpOnly cookie (instant gate — lets the user
//      through middleware on the very next navigation without waiting for
//      Clerk to reissue a JWT with the new publicMetadata).
//
// Runs on Vercel (same CLERK_SECRET_KEY as clerkMiddleware) — reliable, no
// Railway dependency, no cold-start issues.
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
