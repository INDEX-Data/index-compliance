import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareSupabase } from '@/lib/supabase'

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/sign-up',
  '/onboard',
  '/join',
  '/auth/callback',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some(p =>
    pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  // Create Supabase client and refresh the session cookie
  const supabase = createMiddlewareSupabase(request, response)
  const { data: { user } } = await supabase.auth.getUser()

  // ── Public routes: allow through ──────────────────────────────────────────
  if (isPublicRoute(pathname)) {
    // Redirect authenticated users away from landing / sign-in / sign-up
    if (user && (pathname === '/' || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // ── Protected routes: require auth ────────────────────────────────────────
  if (!user) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // ── Onboarding gate ───────────────────────────────────────────────────────
  // Dual signal: user_metadata.onboarded (permanent) + idx_onboarded cookie (instant)
  const metadataOnboarded = !!(user.user_metadata as any)?.onboarded
  const cookieOnboarded = request.cookies.get('idx_onboarded')?.value === user.id

  if (!metadataOnboarded && !cookieOnboarded && pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
