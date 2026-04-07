'use client'

import { CopilotProvider, useCopilot } from '@/contexts/CopilotContext'
import { CopilotDrawer } from '@/components/CopilotDrawer'

function ShellInner({ children }: { children: React.ReactNode }) {
  const { isOpen } = useCopilot()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main app content (Sidebar + page) — shrinks when copilot is open */}
      <div className="flex-1 min-w-0 flex h-full">
        {children}
      </div>

      {/* Copilot panel — sits alongside content */}
      {isOpen && <CopilotDrawer />}
    </div>
  )
}

export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      <ShellInner>{children}</ShellInner>
    </CopilotProvider>
  )
}
