import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Public routes — no auth required (pages + public API endpoints)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboard(.*)',
  '/join(.*)',
  '/api/team/join(.*)',      // public team-invite accept flow
  '/api/onboard(.*)',        // public client onboarding flow
  '/api/webhooks/(.*)',      // Clerk + future webhooks — verified by Svix, not JWT
  '/api/health',
])

// Welcome page and the cookie-setter are exempt from the onboarding gate
// (they ARE the onboarding flow, gating them would cause an infinite redirect)
const isOnboardingRoute = createRouteMatcher([
  '/welcome',
  '/api/set-onboarded',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Authenticated users hitting the landing page → send to dashboard
  if (userId && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // ── Onboarding gate ────────────────────────────────────────────────────────
  // Signed-in users who haven't completed the welcome wizard are redirected
  // to /welcome. We use a cookie (set server-side by /api/set-onboarded) rather
  // than a DB fetch so the check is zero-latency on every request.
  // Only applies to page routes — API routes are called by the frontend after
  // the page loads, so gating them here would break client-side fetches.
  const isPageRoute = !req.nextUrl.pathname.startsWith('/api/')
  if (
    userId &&
    isPageRoute &&
    !isPublicRoute(req) &&
    !isOnboardingRoute(req) &&
    !req.cookies.has('idx_onboarded')
  ) {
    return NextResponse.redirect(new URL('/welcome', req.url))
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
