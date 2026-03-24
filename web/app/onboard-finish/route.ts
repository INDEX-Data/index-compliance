import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// POST /onboard-finish
// Called by the onboarding wizard after the user clicks "Create workspace".
//
// WHY THIS PATH:
//   next.config.ts rewrites /api/:path* → Railway. /onboard-finish is outside
//   that rewrite so it always hits this Next.js route handler on Vercel.
//   The path also matches /onboard(.*)  in middleware's isPublicRoute, so the
//   onboarding gate is bypassed and auth.protect() is not called.
//   The route self-authenticates via auth().
//
// COOKIE-FIRST DESIGN:
//   The idx_onboarded cookie is set BEFORE calling updateUserMetadata so that
//   even if the Clerk API call fails the user still passes the middleware gate
//   on the very next navigation. updateUserMetadata is best-effort — its only
//   purpose is to stamp the JWT for cross-device/new-browser sessions.
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Build the response with the gate cookie set unconditionally.
  // Middleware checks: req.cookies.get('idx_onboarded')?.value === userId
  const res = NextResponse.json({ ok: true })
  res.cookies.set('idx_onboarded', userId, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
  })

  // Update Clerk publicMetadata — best-effort.
  // Needed for new devices / browsers that don't have the cookie.
  // Failure is logged but does NOT change the 200 response — cookie already set.
  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    })
  } catch (err) {
    console.error('[onboard-finish] updateUserMetadata failed (non-fatal):', err)
  }

  return res
}
