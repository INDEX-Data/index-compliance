import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// POST /api/complete-onboarding
// Called by the onboarding wizard after saveProfile() succeeds on Railway.
// Sets publicMetadata.onboarded = true on the Clerk user so the middleware
// gate lets them into the app on the next navigation.
//
// Runs on Vercel (same CLERK_SECRET_KEY as clerkMiddleware) — reliable, no
// Railway dependency, no cold-start issues.
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboarded: true },
    })
  } catch (err) {
    console.error('[onboarding] updateUserMetadata failed:', err)
    return NextResponse.json({ error: 'Failed to complete workspace setup' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
