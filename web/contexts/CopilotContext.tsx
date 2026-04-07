'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { usePathname, useParams } from 'next/navigation'
import { getClients } from '@/lib/api'
import type { Client } from '@/lib/types'

interface CopilotPageContext {
  clientId?: string
  reportId?: string
}

export interface CopilotConversation {
  id: string
  title: string
  clientId: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface CopilotState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  pageContext: CopilotPageContext
  setCopilotContext: (ctx: CopilotPageContext) => void
  activeClient: Client | null
  allClients: Client[]
  setActiveClientId: (id: string) => void
  // Conversation persistence
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  conversations: CopilotConversation[]
  refreshConversations: () => Promise<void>
}

const CopilotCtx = createContext<CopilotState | null>(null)

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pageContext, setPageContext] = useState<CopilotPageContext>({})
  const [allClients, setAllClients] = useState<Client[]>([])
  const [activeClientId, setActiveClientIdState] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<CopilotConversation[]>([])

  const pathname = usePathname()
  const params = useParams()

  // Load clients on mount
  useEffect(() => {
    getClients().then(clients => {
      setAllClients(clients)
      // Default to first client if none selected
      if (clients.length > 0 && !activeClientId) {
        setActiveClientIdState(clients[0].id)
      }
    }).catch(() => {})
  }, [])

  // Auto-detect client from URL (e.g., /clients/[id])
  useEffect(() => {
    if (pathname.startsWith('/clients/') && params?.id) {
      const urlClientId = String(params.id)
      setActiveClientIdState(urlClientId)
      setPageContext(prev => ({ ...prev, clientId: urlClientId }))
    }
  }, [pathname, params])

  // Auto-detect report from URL (e.g., /assess/[reportId])
  useEffect(() => {
    if (pathname.startsWith('/assess/') && params?.reportId) {
      setPageContext(prev => ({ ...prev, reportId: String(params.reportId) }))
    }
  }, [pathname, params])

  // Sync pageContext.clientId with activeClientId
  useEffect(() => {
    if (activeClientId) {
      setPageContext(prev => ({ ...prev, clientId: activeClientId }))
    }
  }, [activeClientId])

  // Clear conversation when switching clients
  useEffect(() => {
    setActiveConversationId(null)
  }, [activeClientId])

  const activeClient = allClients.find(c => c.id === activeClientId) ?? null

  // Load conversations when panel opens or client changes
  const refreshConversations = useCallback(async () => {
    try {
      const url = activeClientId
        ? `/api/copilot/conversations?clientId=${activeClientId}`
        : '/api/copilot/conversations'
      const res = await fetch(url)
      if (res.ok) {
        const list = await res.json()
        setConversations(list)
      }
    } catch {}
  }, [activeClientId])

  useEffect(() => {
    if (isOpen) {
      refreshConversations()
    }
  }, [isOpen, activeClientId, refreshConversations])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(s => !s), [])
  const setCopilotContext = useCallback((ctx: CopilotPageContext) => setPageContext(ctx), [])
  const setActiveClientId = useCallback((id: string) => setActiveClientIdState(id), [])

  return (
    <CopilotCtx.Provider value={{
      isOpen, open, close, toggle,
      pageContext, setCopilotContext,
      activeClient, allClients, setActiveClientId,
      activeConversationId, setActiveConversationId,
      conversations, refreshConversations,
    }}>
      {children}
    </CopilotCtx.Provider>
  )
}

export function useCopilot() {
  const ctx = useContext(CopilotCtx)
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider')
  return ctx
}
