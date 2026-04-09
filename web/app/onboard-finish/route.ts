import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'

// POST /onboard-finish
// Called by the onboarding wizard after the user clicks "Create workspace".
//
// COOKIE-FIRST DESIGN:
//   The idx_onboarded cookie is set BEFORE calling admin.updateUserById so that
//   even if the metadata update fails the user still passes the middleware gate
//   on the very next navigation.
export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse optional fullName from request body
  let fullName: string | undefined
  try {
    const body = await request.json()
    fullName = body?.fullName
  } catch {
    // No body or invalid JSON — that's fine, fullName stays undefined
  }

  // Build the response with the gate cookie set unconditionally.
  const res = NextResponse.json({ ok: true })
  res.cookies.set('idx_onboarded', user.id, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
  })

  // Update Supabase user metadata — best-effort.
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { onboarded: true, ...(fullName ? { full_name: fullName } : {}) },
    })
  } catch (err) {
    console.error('[onboard-finish] updateUserMetadata failed (non-fatal):', err)
  }

  return res
}
