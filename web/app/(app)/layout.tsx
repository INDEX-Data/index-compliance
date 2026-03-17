import { Sidebar } from '@/components/Sidebar'
import { ClerkTokenSync } from '@/components/ClerkTokenSync'
import { ProfileGuard } from '@/components/ProfileGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
