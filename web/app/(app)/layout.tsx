import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ClerkTokenSync } from '@/components/ClerkTokenSync'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  // Mirror the middleware dual-signal check:
  //   • JWT signal  — publicMetadata.onboarded (permanent, after token refresh)
  //   • Cookie signal — idx_onboarded=userId   (instant, set by /onboard-finish)
  //
  // Without the cookie check here, new users loop: middleware passes them through
  // (cookie present) but this layout immediately redirects them back to /onboarding
  // because the JWT hasn't been reissued with onboarded:true yet.
  const jwtOnboarded    = !!(sessionClaims?.publicMetadata as any)?.onboarded
  const cookieStore     = await cookies()
  const cookieOnboarded = cookieStore.get('idx_onboarded')?.value === userId

  if (!jwtOnboarded && !cookieOnboarded) redirect('/onboarding')

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
