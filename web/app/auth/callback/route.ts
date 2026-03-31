import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareSupabase } from '@/lib/supabase'

// Supabase redirects here after email confirmation.
// Exchange the auth code for a session, then redirect to onboarding.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirect') ?? '/onboarding'

  if (code) {
    const response = NextResponse.redirect(new URL(redirectTo, request.url))
    const supabase = createMiddlewareSupabase(request, response)
    await supabase.auth.exchangeCodeForSession(code)
    return response
  }

  // No code — redirect to sign-in
  return NextResponse.redirect(new URL('/sign-in', request.url))
}
