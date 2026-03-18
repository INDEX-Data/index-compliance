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
  // Reads publicMetadata from the JWT (sessionClaims) — no DB call, Edge-safe,
  // persists permanently across sessions.
  // /onboard(.*)  is already in isPublicRoute so this never loops.
  if (
    userId &&
    !isPublicRoute(req) &&
    !(sessionClaims?.publicMetadata as any)?.onboarded
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
