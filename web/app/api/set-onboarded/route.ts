import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// POST /api/set-onboarded
// Sets the idx_onboarded cookie on the Vercel domain so the middleware
// can reliably gate access to the app without a DB round-trip on every request.
// Called by the welcome page after saveProfile() succeeds, and also when an
// existing profile is found (returning user on a new device/browser).
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('idx_onboarded', '1', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 365, // 1 year
    path:     '/',
  })
  return res
}
