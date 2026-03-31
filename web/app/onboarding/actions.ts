'use server'

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'

// completeOnboarding — Server Action called by the onboarding wizard after
// saveProfile() succeeds.
//
// Does two things:
//   1. Sets user_metadata.onboarded = true on the Supabase user
//      (permanent gate — takes effect on session refresh)
//   2. Sets an idx_onboarded HttpOnly cookie
//      (instant gate — middleware reads this immediately)
export async function completeOnboarding(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Use admin client to update user metadata (service role key required)
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
    return { error: 'Failed to complete workspace setup' }
  }

  // Set the instant-gate cookie so middleware lets the user through
  // immediately — before the session JWT is reissued with onboarded=true.
  const cookieStore = await cookies()
  cookieStore.set('idx_onboarded', user.id, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 365, // 1 year
  })

  return { ok: true }
}
