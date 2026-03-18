import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ClerkTokenSync } from '@/components/ClerkTokenSync'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth()

  // Middleware is the primary gate — this is defense-in-depth.
  // Reads from sessionClaims (JWT) — zero network calls, no fail-open risk.
  if (!userId) redirect('/sign-in')
  if (!(sessionClaims?.publicMetadata as any)?.onboarded) redirect('/onboarding')

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
