import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'

// POST /api/complete-onboarding
// Called by the onboarding wizard after saveProfile() succeeds.
// Sets user_metadata.onboarded = true + idx_onboarded cookie.
export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { onboarded: true },
    })
  } catch (err) {
    console.error('[onboarding] updateUserMetadata failed:', err)
    return NextResponse.json({ error: 'Failed to complete workspace setup' }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('idx_onboarded', user.id, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,
  })
  return res
}
