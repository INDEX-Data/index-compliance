import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// POST /api/set-onboarded
// Sets idx_onboarded=<userId> so the middleware can verify the cookie belongs
// to the currently signed-in user. Storing the userId (not just "1") means the
// cookie auto-invalidates when a different user signs in on the same browser.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('idx_onboarded', userId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 365, // 1 year
    path:     '/',
  })
  return res
}
