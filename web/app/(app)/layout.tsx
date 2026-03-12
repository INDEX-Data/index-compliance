import { Sidebar } from '@/components/Sidebar'
import { ClerkTokenSync } from '@/components/ClerkTokenSync'

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
