'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import {
  X, Sparkles, Send, Square, Building2, ChevronDown, Loader2,
  CheckCircle2, AlertCircle, Search, Brain, Plus, MessageSquare,
  Clock, Trash2, ArrowLeft, Maximize2, Minimize2,
  Copy, ThumbsUp, ThumbsDown, Share2, RefreshCw, MoreHorizontal,
  FileText, Zap, Download, ChevronRight, Shield, Link2,
  BookOpen, Activity, Upload, XCircle,
} from 'lucide-react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import { useCopilot, type CopilotConversation } from '@/contexts/CopilotContext'
import { getProfile } from '@/lib/api'

interface AgentStep {
  type: 'thinking' | 'tool_start' | 'tool_done' | 'tool_error' | 'responding'
  detail: string
  ts: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]
}

type View = 'chat' | 'history'

// ─── Message Action Bar ──────────────────────────────────────────────────────

function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState<'up' | 'down' | null>(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnClass = 'w-7 h-7 flex items-center justify-center rounded-md text-[#a8a29e] hover:text-[#44403c] hover:bg-[#f5f5f4] transition-colors'

  return (
    <div className="flex items-center gap-0.5 mt-2">
      <button onClick={handleCopy} className={btnClass} title={copied ? 'Copied!' : 'Copy'}>
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
      </button>
      <button onClick={() => setLiked(liked === 'up' ? null : 'up')} className={btnClass} title="Good response">
        <ThumbsUp className={`w-3.5 h-3.5 ${liked === 'up' ? 'text-[#1c1917] fill-current' : ''}`} strokeWidth={1.5} />
      </button>
      <button onClick={() => setLiked(liked === 'down' ? null : 'down')} className={btnClass} title="Bad response">
        <ThumbsDown className={`w-3.5 h-3.5 ${liked === 'down' ? 'text-[#9f403d] fill-current' : ''}`} strokeWidth={1.5} />
      </button>
      <button className={btnClass} title="Share"><Share2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
      <button className={btnClass} title="Regenerate"><RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
      <button className={btnClass} title="More"><MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
    </div>
  )
}

// ─── Action Chips ────────────────────────────────────────────────────────────

function ActionChips({ content, onChipClick }: { content: string; onChipClick: (text: string) => void }) {
  // Parse content for actionable suggestions
  const chips: { label: string; icon: typeof FileText }[] = []

  const lower = content.toLowerCase()
  if (lower.includes('affected') || lower.includes('users') || lower.includes('accounts'))
    chips.push({ label: 'View affected accounts', icon: Search })
  if (lower.includes('fix') || lower.includes('remediat') || lower.includes('enforce'))
    chips.push({ label: 'Fix with integration', icon: Zap })
  if (lower.includes('report') || lower.includes('compliance') || lower.includes('assessment'))
    chips.push({ label: 'Download compliance report', icon: Download })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map(chip => (
        <button
          key={chip.label}
          onClick={() => onChipClick(chip.label)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#44403c] bg-white border border-[#e7e5e4] rounded-full hover:bg-[#f5f5f4] hover:border-[#d6d3d1] transition-colors"
        >
          <chip.icon className="w-3 h-3" strokeWidth={1.5} />
          {chip.label}
        </button>
      ))}
    </div>
  )
}

// ─── Reference & Context Panel ───────────────────────────────────────────────

interface UploadedFile {
  id: string
  name: string
  size: number
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ReferencePanel({ activeClient }: { activeClient: { name: string; tenantId?: string } | null }) {
  const [tab, setTab] = useState<'documents' | 'live'>('documents')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ACCEPTED = '.pdf,.docx,.txt,.csv,.xlsx'

  const addFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div className="w-[280px] shrink-0 flex flex-col h-full border-l border-[#e7e5e4]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-[15px] font-semibold text-[#1c1917]">Reference & Context</h3>
        <p className="text-[11px] text-[#a8a29e] mt-0.5">Upload documents or view live data</p>
      </div>

      {/* Tab switcher */}
      <div className="mx-5 flex bg-[#f5f5f4] rounded-lg p-0.5 mb-4">
        <button
          onClick={() => setTab('documents')}
          className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${
            tab === 'documents' ? 'bg-white text-[#1c1917] shadow-sm' : 'text-[#78716c] hover:text-[#44403c]'
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setTab('live')}
          className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${
            tab === 'live' ? 'bg-white text-[#1c1917] shadow-sm' : 'text-[#78716c] hover:text-[#44403c]'
          }`}
        >
          Live data
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3">
        {tab === 'documents' ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#1c1917] bg-[#f5f5f4]'
                  : 'border-[#e7e5e4] hover:border-[#d6d3d1] hover:bg-[#fafaf9]'
              }`}
            >
              <Upload className={`w-6 h-6 ${isDragging ? 'text-[#1c1917]' : 'text-[#a8a29e]'}`} strokeWidth={1.5} />
              <p className="text-[12px] text-[#78716c] text-center">
                Drop files here or <span className="text-[#1c1917] font-medium underline">browse</span>
              </p>
              <p className="text-[10px] text-[#a8a29e]">PDF, DOCX, TXT, CSV, XLSX</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }}
              />
            </div>

            {/* Uploaded files list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-wider">
                  Uploaded ({files.length})
                </p>
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#e7e5e4] group">
                    <div className="w-7 h-7 rounded-md bg-[#f5f5f4] flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-[#78716c]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#1c1917] truncate">{f.name}</p>
                      <p className="text-[10px] text-[#a8a29e]">{formatFileSize(f.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[#a8a29e] hover:text-red-500 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length === 0 && (
              <p className="text-[11px] text-[#a8a29e] text-center py-2">
                Add policies, plans, or compliance documents for Atlas to reference during your conversation.
              </p>
            )}
          </>
        ) : (
          /* Live data tab */
          activeClient?.tenantId ? (
            <div className="space-y-3">
              {[
                { label: 'Microsoft Graph', desc: 'Users, policies, device management', icon: Shield },
                { label: 'Security & Compliance', desc: 'Alerts, secure score, incidents', icon: Activity },
                { label: 'Conditional Access', desc: 'Policies, named locations', icon: Link2 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[#e7e5e4]">
                  <div className="w-8 h-8 rounded-lg bg-[#f5f5f4] flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-[#78716c]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1c1917]">{item.label}</p>
                    <p className="text-[10px] text-[#a8a29e] mt-0.5">{item.desc}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-emerald-600 font-medium">Connected via {activeClient.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="w-8 h-8 text-[#d6d3d1] mb-2" strokeWidth={1.5} />
              <p className="text-[12px] text-[#78716c]">No integrations connected</p>
              <p className="text-[10px] text-[#a8a29e] mt-1 max-w-[200px]">
                Connect a Microsoft 365 tenant to see live data from your environment.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Expanded Left Sidebar ───────────────────────────────────────────────────

function ExpandedSidebar({
  conversations,
  activeConversationId,
  onLoadConversation,
  onNewChat,
  onDeleteConversation,
  deletingId,
  setDeletingId,
  relativeTime,
}: {
  conversations: CopilotConversation[]
  activeConversationId: string | null
  onLoadConversation: (conv: CopilotConversation) => void
  onNewChat: () => void
  onDeleteConversation: (id: string) => void
  deletingId: string | null
  setDeletingId: (id: string | null) => void
  relativeTime: (d: string) => string
}) {
  return (
    <div className="w-[240px] shrink-0 flex flex-col h-full bg-[#fafaf9] border-r border-[#e7e5e4]">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3">
        <Image src="/atlas-logo.svg" alt="Atlas" width={120} height={32} className="h-8 w-auto" />
      </div>

      {/* New chat button */}
      <div className="px-4 mb-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#1c1917] text-white text-[13px] font-medium hover:bg-[#0c0a09] transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          New chat
        </button>
      </div>

      {/* Nav items */}
      <div className="px-3 mb-4">
        {[
          { icon: Sparkles, label: 'Compliance assistant', active: true },
          { icon: Link2, label: 'Integrations', comingSoon: true },
          { icon: BookOpen, label: 'Regulations', comingSoon: true },
          { icon: FileText, label: 'Reports', comingSoon: true },
        ].map(item => (
          <button
            key={item.label}
            disabled={item.comingSoon}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
              item.active
                ? 'text-[#1c1917] font-medium bg-white border border-[#e7e5e4] shadow-sm'
                : item.comingSoon
                  ? 'text-[#a8a29e] cursor-default'
                  : 'text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4]'
            }`}
          >
            <item.icon className="w-4 h-4" strokeWidth={1.5} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.comingSoon && (
              <span className="text-[9px] font-medium text-[#a8a29e] bg-[#f5f5f4] px-1.5 py-0.5 rounded-full">Soon</span>
            )}
          </button>
        ))}
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-3">
        <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-wider px-3 mb-2">Chats</p>
        {conversations.length === 0 ? (
          <p className="text-[11px] text-[#a8a29e] px-3">No conversations yet</p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  conv.id === activeConversationId ? 'bg-white border border-[#e7e5e4] shadow-sm' : 'hover:bg-[#f5f5f4]'
                }`}
                onClick={() => onLoadConversation(conv)}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#a8a29e] shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#1c1917] truncate">{conv.title}</p>
                  <p className="text-[10px] text-[#a8a29e]">{relativeTime(conv.updatedAt)}</p>
                </div>
                {deletingId === conv.id ? (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id) }}
                      className="text-[10px] text-red-500 px-1 rounded hover:bg-red-50"
                    >
                      Del
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(null) }}
                      className="text-[10px] text-[#78716c] px-1 rounded hover:bg-[#f5f5f4]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(conv.id) }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[#a8a29e] hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                )}
                <ChevronRight className="w-3 h-3 text-[#d6d3d1] shrink-0" strokeWidth={1.5} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System status */}
      <div className="px-4 py-4 border-t border-[#e7e5e4]">
        <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-wider mb-2">System status</p>
        {[
          { name: 'Microsoft Graph', status: 'Connected' },
          { name: 'Supabase', status: 'Connected' },
          { name: 'Claude API', status: 'Connected' },
        ].map(s => (
          <div key={s.name} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-[#44403c]">{s.name}</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main CopilotDrawer ──────────────────────────────────────────────────────

export function CopilotDrawer() {
  const {
    close, pageContext, activeClient, allClients, setActiveClientId,
    isExpanded, toggleExpand,
    activeConversationId, setActiveConversationId,
    conversations, refreshConversations,
  } = useCopilot()

  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [profileCompany, setProfileCompany] = useState('')

  // Fetch user profile for company name in greetings
  useEffect(() => {
    getProfile().then(p => { if (p.companyName) setProfileCompany(p.companyName) }).catch(() => {})
  }, [])
  const [isStreaming, setIsStreaming] = useState(false)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const prevClientRef = useRef<string | undefined>()
  const conversationIdRef = useRef<string | null>(null)

  // Sync conversationIdRef with context
  useEffect(() => {
    conversationIdRef.current = activeConversationId
  }, [activeConversationId])

  // Clear chat when active client changes
  useEffect(() => {
    if (prevClientRef.current && prevClientRef.current !== activeClient?.id) {
      setMessages([])
      setActiveConversationId(null)
      conversationIdRef.current = null
    }
    prevClientRef.current = activeClient?.id
  }, [activeClient?.id, setActiveConversationId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus textarea on mount
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 150)
  }, [])

  // Escape key — collapse before closing
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExpanded) {
          toggleExpand()
        } else if (view === 'history') {
          setView('chat')
        } else {
          close()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close, view, isExpanded, toggleExpand])

  // Ctrl+Shift+E to toggle fullscreen
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        toggleExpand()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleExpand])

  // Close client picker on outside click
  useEffect(() => {
    if (!showClientPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowClientPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showClientPicker])

  // Load a conversation from history
  const loadConversation = useCallback(async (conv: CopilotConversation) => {
    try {
      const res = await fetch(`/api/copilot/conversations/${conv.id}`)
      if (!res.ok) return
      const data = await res.json()
      const loaded: Message[] = (data.messages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        steps: m.steps,
      }))
      setMessages(loaded)
      setActiveConversationId(conv.id)
      conversationIdRef.current = conv.id
      setView('chat')
      setTimeout(() => textareaRef.current?.focus(), 150)
    } catch {}
  }, [setActiveConversationId])

  // Start a new chat
  const startNewChat = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
    conversationIdRef.current = null
    setView('chat')
    setTimeout(() => textareaRef.current?.focus(), 150)
  }, [setActiveConversationId])

  // Delete a conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/copilot/conversations?id=${id}`, { method: 'DELETE' })
      if (activeConversationId === id) {
        setMessages([])
        setActiveConversationId(null)
        conversationIdRef.current = null
      }
      await refreshConversations()
    } catch {}
    setDeletingId(null)
  }, [activeConversationId, setActiveConversationId, refreshConversations])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Add empty assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: pageContext,
          conversationId: conversationIdRef.current,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: `**Error:** ${err.error || 'Something went wrong.'}` }
          return copy
        })
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) { setIsStreaming(false); return }

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        while (buffer.length > 0) {
          if (buffer.startsWith('\x01')) {
            const newlineIdx = buffer.indexOf('\n')
            if (newlineIdx === -1) break
            const eventJson = buffer.slice(1, newlineIdx)
            buffer = buffer.slice(newlineIdx + 1)

            try {
              const event = JSON.parse(eventJson) as { type: string; detail: string }

              if (event.type === 'conversation_id') {
                setActiveConversationId(event.detail)
                conversationIdRef.current = event.detail
                continue
              }

              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                const steps = [...(last.steps || []), { type: event.type as AgentStep['type'], detail: event.detail, ts: Date.now() }]
                copy[copy.length - 1] = { ...last, steps }
                return copy
              })
            } catch {}
            continue
          }

          const nextEvent = buffer.indexOf('\x01')
          const textChunk = nextEvent === -1 ? buffer : buffer.slice(0, nextEvent)
          buffer = nextEvent === -1 ? '' : buffer.slice(nextEvent)

          if (textChunk) {
            setMessages(prev => {
              const copy = [...prev]
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                role: 'assistant',
                content: copy[copy.length - 1].content + textChunk,
              }
              return copy
            })
          }
        }
      }

      refreshConversations()
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: '**Error:** Connection failed. Please try again.' }
          return copy
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, pageContext, setActiveConversationId, refreshConversations])

  const handleStop = useCallback(() => { abortRef.current?.abort() }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleChipClick = (text: string) => {
    setInput(text)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  // ─── Shared message rendering ──────────────────────────────────────────────

  const renderMessages = (expanded: boolean) => (
    <>
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <p className={`font-medium text-[#1c1917] mb-1 ${expanded ? 'text-xl' : 'text-[15px]'}`}>Hi, I&apos;m Atlas</p>
          <p className={`text-[13px] text-[#78716c] leading-relaxed mb-5 ${expanded ? 'max-w-[520px]' : 'max-w-[280px]'}`}>
            I have live access to{' '}
            <span className="font-medium text-[#1c1917]">{activeClient?.name || 'your tenant'}</span>.
            Ask me anything about {profileCompany ? `${profileCompany}'s` : 'your'} compliance posture or environment.
          </p>
          <div className={`flex flex-col gap-2 w-full ${expanded ? 'max-w-[520px]' : 'max-w-[300px]'}`}>
            {[
              'How many users have MFA enabled?',
              'Show me all conditional access policies',
              'What controls are failing in my last assessment?',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => {
                  setInput(prompt)
                  setTimeout(() => textareaRef.current?.focus(), 50)
                }}
                className="text-left text-[12px] text-[#78716c] px-4 py-2.5 rounded-full border border-[#e7e5e4] hover:border-[#d6d3d1] hover:bg-[#fafaf9] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i}>
          {/* Agent steps */}
          {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
            <div className="mb-2 ml-1 space-y-1">
              {msg.steps.map((step, si) => {
                const isLatest = si === msg.steps!.length - 1
                const isActive = isLatest && !msg.content && (step.type === 'thinking' || step.type === 'tool_start' || step.type === 'responding')
                return (
                  <div key={si} className={`flex items-center gap-2 text-[11px] ${isActive ? 'text-[#44403c]' : 'text-[#a8a29e]'}`}>
                    {step.type === 'thinking' && <Brain className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#78716c] animate-pulse' : ''}`} strokeWidth={1.5} />}
                    {step.type === 'tool_start' && <Search className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#78716c] animate-pulse' : ''}`} strokeWidth={1.5} />}
                    {step.type === 'tool_done' && <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" strokeWidth={1.5} />}
                    {step.type === 'tool_error' && <AlertCircle className="w-3 h-3 shrink-0 text-red-400" strokeWidth={1.5} />}
                    {step.type === 'responding' && <Sparkles className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#78716c] animate-pulse' : ''}`} strokeWidth={1.5} />}
                    <span className="truncate">{step.detail}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Message bubble */}
          {!(msg.role === 'assistant' && !msg.content && msg.steps && msg.steps.length > 0) && (
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={msg.role === 'user' ? 'max-w-[85%]' : expanded ? 'max-w-full' : 'max-w-[85%]'}>
                <div
                  className={`px-4 py-2.5 text-[13.5px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#f5f5f4] text-[#1c1917] rounded-2xl rounded-br-md'
                      : expanded
                        ? 'text-[#1c1917]'
                        : 'bg-[#f5f5f4] text-[#1c1917] rounded-2xl rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <div className="copilot-markdown max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 className="w-3.5 h-3.5 text-[#a8a29e] animate-spin" />
                        <span className="text-[12px] text-[#a8a29e]">Starting...</span>
                      </div>
                    )
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Action bar + chips for completed assistant messages */}
                {msg.role === 'assistant' && msg.content && !isStreaming && (
                  <>
                    <MessageActions content={msg.content} />
                    {expanded && <ActionChips content={msg.content} onChipClick={handleChipClick} />}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </>
  )

  // ─── Input bar rendering ───────────────────────────────────────────────────

  const renderInputBar = (expanded: boolean) => (
    <div className={`shrink-0 border-t border-[#e7e5e4] py-3 bg-white ${expanded ? 'px-6' : 'px-4'}`}>
      <div className={`flex items-end gap-2 rounded-2xl px-4 py-2.5 ${expanded ? 'bg-[#f5f5f4] border border-[#e7e5e4]' : 'bg-[#f5f5f4]'}`}>
        {expanded && (
          <button className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#a8a29e] hover:text-[#44403c] transition-colors mb-0.5">
            <Plus className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={expanded
            ? 'Type your question about security controls, policies, or compliance status...'
            : activeClient ? `Ask about ${activeClient.name}...` : 'Ask Atlas about compliance...'
          }
          rows={1}
          className="flex-1 bg-transparent text-[13.5px] text-[#1c1917] placeholder-[#a8a29e] resize-none outline-none leading-relaxed max-h-[120px]"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            onClick={handleStop}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1c1917] text-white hover:bg-[#0c0a09] transition-colors"
          >
            <Square className="w-3.5 h-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1c1917] text-white hover:bg-[#0c0a09] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
      {!expanded && (
        <p className="text-[11px] text-[#a8a29e] text-center mt-2">
          Atlas has live access to your tenant. Verify important compliance data.
        </p>
      )}
    </div>
  )

  // ─── EXPANDED 3-COLUMN LAYOUT ──────────────────────────────────────────────

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex bg-white">
        {/* Left sidebar */}
        <ExpandedSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onLoadConversation={loadConversation}
          onNewChat={startNewChat}
          onDeleteConversation={deleteConversation}
          deletingId={deletingId}
          setDeletingId={setDeletingId}
          relativeTime={relativeTime}
        />

        {/* Center chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Chat header */}
          <div
            className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-[#e7e5e4]"
            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-3">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors">
                <Minimize2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </div>
            <span className="text-[15px] font-semibold text-[#1c1917]">Atlas Copilot</span>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors" title="Download">
                <Download className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
              <button
                onClick={toggleExpand}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
                title="Collapse to drawer"
              >
                <Minimize2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {renderMessages(true)}
          </div>

          {/* Input */}
          {renderInputBar(true)}
        </div>

        {/* Right reference panel */}
        <ReferencePanel activeClient={activeClient} />
      </div>
    )
  }

  // ─── DRAWER LAYOUT (unchanged compact mode) ───────────────────────────────

  return (
    <div className="w-[420px] shrink-0 h-screen flex flex-col bg-white border-l border-[#e7e5e4]">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-[#e7e5e4]"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-2.5">
          {view === 'history' ? (
            <button
              onClick={() => setView('chat')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[#1c1917] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
          )}
          <span className="text-[15px] font-semibold text-[#1c1917]">
            {view === 'history' ? 'Chat History' : 'Atlas Copilot'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {view === 'chat' && (
            <>
              <button
                onClick={() => { setView('history'); refreshConversations() }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
                title="Chat history"
              >
                <Clock className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
              <button
                onClick={startNewChat}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
                title="New chat"
              >
                <Plus className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </>
          )}
          <button
            onClick={toggleExpand}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
            title="Expand to fullscreen"
          >
            <Maximize2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f5f5f4] transition-colors"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Org scope bar */}
      <div className="shrink-0 px-4 py-2 border-b border-[#f5f5f4] bg-[#fafaf9]">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowClientPicker(s => !s)}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-left hover:bg-[#f5f5f4] transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-[#78716c]" strokeWidth={1.5} />
            <span className="text-[12px] font-medium text-[#44403c] truncate flex-1">
              {activeClient ? activeClient.name : 'No org selected'}
            </span>
            {activeClient && (
              <span className="text-[10px] text-[#a8a29e] font-mono">{activeClient.tenantId?.slice(0, 8)}...</span>
            )}
            <ChevronDown className={`w-3 h-3 text-[#a8a29e] transition-transform ${showClientPicker ? 'rotate-180' : ''}`} />
          </button>

          {showClientPicker && allClients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e7e5e4] rounded-lg shadow-lg z-10 py-1 max-h-48 overflow-y-auto">
              {allClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveClientId(c.id)
                    setShowClientPicker(false)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f5f5f4] transition-colors ${
                    c.id === activeClient?.id ? 'bg-[#f5f5f4]' : ''
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-[#78716c] shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1c1917] truncate">{c.name}</p>
                    <p className="text-[10px] text-[#a8a29e] font-mono">{c.tenantId}</p>
                  </div>
                  {c.id === activeClient?.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── History View ─────────────────────────────────────────────── */}
      {view === 'history' && (
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <MessageSquare className="w-10 h-10 text-[#d6d3d1] mb-3" strokeWidth={1.5} />
              <p className="text-[13px] text-[#78716c]">No conversations yet</p>
              <p className="text-[12px] text-[#a8a29e] mt-1">Start chatting and your history will appear here.</p>
            </div>
          ) : (
            <div className="py-2">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-[#fafaf9] transition-colors ${
                    conv.id === activeConversationId ? 'bg-[#f5f5f4]' : ''
                  }`}
                  onClick={() => loadConversation(conv)}
                >
                  <MessageSquare className="w-4 h-4 text-[#a8a29e] shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1c1917] truncate">{conv.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[#a8a29e]">{relativeTime(conv.updatedAt)}</span>
                      <span className="text-[11px] text-[#d6d3d1]">&middot;</span>
                      <span className="text-[11px] text-[#a8a29e]">{conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {deletingId === conv.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                        className="text-[11px] text-red-500 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(null) }}
                        className="text-[11px] text-[#78716c] hover:text-[#1c1917] px-1.5 py-0.5 rounded hover:bg-[#f5f5f4]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(conv.id) }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-[#a8a29e] hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="sticky bottom-0 px-4 py-3 border-t border-[#e7e5e4] bg-white">
            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-[13px] font-medium hover:bg-[#0c0a09] transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              New Chat
            </button>
          </div>
        </div>
      )}

      {/* ── Chat View ────────────────────────────────────────────────── */}
      {view === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {renderMessages(false)}
          </div>
          {renderInputBar(false)}
        </>
      )}
    </div>
  )
}
