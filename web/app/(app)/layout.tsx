import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ClerkTokenSync } from '@/components/ClerkTokenSync'

// Mirror the URL normalisation from next.config.ts
let API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:3001'
if (API_BASE && !API_BASE.startsWith('http://') && !API_BASE.startsWith('https://')) {
  API_BASE = `https://${API_BASE}`
}

async function hasProfile(): Promise<boolean> {
  try {
    const { userId, getToken } = await auth()
    if (!userId) return true // unauthenticated — Clerk middleware handles the redirect
    const token = await getToken()
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
    return res.status !== 404
  } catch {
    return true // network error — fail open, don't block existing users
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profileExists = await hasProfile()
  if (!profileExists) redirect('/onboarding')

  return (
    <>
      <ClerkTokenSync />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  )
}
