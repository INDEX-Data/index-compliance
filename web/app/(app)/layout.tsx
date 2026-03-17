import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ClerkTokenSync } from '@/components/ClerkTokenSync'
import { ProfileGuard } from '@/components/ProfileGuard'

// ── Server-side profile gate ──────────────────────────────────────────────────
// Runs before any HTML is sent to the browser. If the authenticated user has
// no profile row yet (HTTP 404), redirect them to /welcome immediately.
// This is the authoritative check — ProfileGuard is a belt-and-suspenders
// client-side backup for soft navigations.

function normaliseApiUrl(url: string) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return `https://${url}`
  return url
}

const API_BASE = normaliseApiUrl(process.env.INTERNAL_API_URL ?? 'http://localhost:3001')

async function checkProfile(): Promise<'ok' | 'no_profile' | 'error'> {
  try {
    const { userId, getToken } = await auth()
    if (!userId) return 'error'          // not signed in — Clerk middleware handles this

    const token = await getToken()
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })

    if (res.status === 404) return 'no_profile'
    if (res.ok)             return 'ok'
    return 'error'                        // 500 / network — don't block the user
  } catch {
    return 'error'
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const status = await checkProfile()
  if (status === 'no_profile') redirect('/welcome')

  return (
    <>
      <ClerkTokenSync />
      <ProfileGuard />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  )
}
