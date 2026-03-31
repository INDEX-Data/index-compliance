import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // Dual-signal onboarding check (mirrors middleware)
  const metadataOnboarded = !!(user.user_metadata as any)?.onboarded
  const cookieStore = await cookies()
  const cookieOnboarded = cookieStore.get('idx_onboarded')?.value === user.id

  if (!metadataOnboarded && !cookieOnboarded) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
