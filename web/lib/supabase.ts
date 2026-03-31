// =============================================================================
// INDEX — Supabase Client Factory
// Single source of truth for all Supabase client creation.
// =============================================================================

import { createBrowserClient as createBrowser } from '@supabase/ssr'
import { createServerClient as createServer } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// ── Environment ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client (client components) ───────────────────────────────────────
// Safe to call multiple times — @supabase/ssr deduplicates internally.

export function createClientSupabase() {
  return createBrowser(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// ── Server client (Server Components, Server Actions, Route Handlers) ────────
// Must receive the cookies() store from Next.js.

export async function createServerSupabase() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  return createServer(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll can throw in Server Components (read-only).
          // This is expected — the middleware will refresh the session.
        }
      },
    },
  })
}

// ── Middleware client ─────────────────────────────────────────────────────────
// Refreshes the auth session on every request so the cookie stays valid.

export function createMiddlewareSupabase(
  request: NextRequest,
  response: NextResponse
) {
  return createServer(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })
}
