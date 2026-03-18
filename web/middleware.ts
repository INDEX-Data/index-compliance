import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Public routes — no auth required (pages + public API endpoints)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboard(.*)',
  '/join(.*)',
  '/api/team/join(.*)',           // public team-invite accept flow
  '/api/onboard(.*)',             // public client onboarding flow
  '/api/webhooks/(.*)',           // Clerk + future webhooks — verified by Svix, not JWT
  '/api/health',
  '/api/complete-onboarding',    // self-authenticates via auth(); must not be blocked by the onboarding gate
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  // Authenticated users hitting the landing page → send to dashboard
  if (userId && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Enforce Clerk auth on all protected routes first
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // Onboarding gate: signed-in users who haven't completed onboarding always
  // get redirected to /onboarding — regardless of refresh or re-login.
  //
  // Two-signal check (either is sufficient to pass):
  //   • JWT signal  — publicMetadata.onboarded = true (permanent, set by Clerk
  //                   updateUserMetadata; takes effect after next token refresh)
  //   • Cookie signal — idx_onboarded = userId  (instant; set by the
  //                   /api/complete-onboarding route in the same response that
  //                   calls updateUserMetadata, so the user is let through on
  //                   the very next navigation without waiting for JWT reissue)
  //
  // /onboard(.*)  is already in isPublicRoute so this never loops.
  const jwtOnboarded    = !!(sessionClaims?.publicMetadata as any)?.onboarded
  const cookieOnboarded = req.cookies.get('idx_onboarded')?.value === userId

  if (
    userId &&
    !isPublicRoute(req) &&
    !jwtOnboarded &&
    !cookieOnboarded
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
