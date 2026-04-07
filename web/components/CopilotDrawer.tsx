'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import {
  X, Sparkles, Send, Square, Building2, ChevronDown, Loader2,
  CheckCircle2, AlertCircle, Search, Brain, Plus, MessageSquare,
  Clock, Trash2, ArrowLeft,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useCopilot, type CopilotConversation } from '@/contexts/CopilotContext'

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

export function CopilotDrawer() {
  const {
    close, pageContext, activeClient, allClients, setActiveClientId,
    activeConversationId, setActiveConversationId,
    conversations, refreshConversations,
  } = useCopilot()

  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
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

  // Escape key
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'history') {
          setView('chat')
        } else {
          close()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close, view])

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

        // Process buffer — split on status event boundaries
        while (buffer.length > 0) {
          // Check for status event (starts with \x01)
          if (buffer.startsWith('\x01')) {
            const newlineIdx = buffer.indexOf('\n')
            if (newlineIdx === -1) break // wait for full line
            const eventJson = buffer.slice(1, newlineIdx)
            buffer = buffer.slice(newlineIdx + 1)

            try {
              const event = JSON.parse(eventJson) as { type: string; detail: string }

              // Capture conversation ID sent from backend
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

          // Regular text content — find next status event or consume all
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

      // Refresh conversation list after exchange
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

  // Format relative time
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

          {/* Client picker dropdown */}
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

          {/* New chat button at bottom of history */}
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
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-[#f5f5f4] flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-[#a8a29e]" strokeWidth={1.5} />
                </div>
                <p className="text-[15px] font-medium text-[#1c1917] mb-1">Hi, I&apos;m Atlas</p>
                <p className="text-[13px] text-[#78716c] leading-relaxed max-w-[280px] mb-5">
                  I have live access to{' '}
                  <span className="font-medium text-[#1c1917]">{activeClient?.name || 'your tenant'}</span>.
                  Ask me anything about your compliance posture or environment.
                </p>
                {/* Quick-start prompts */}
                <div className="flex flex-col gap-2 w-full max-w-[300px]">
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
                      className="text-left text-[12px] text-[#78716c] px-3 py-2 rounded-lg border border-[#e7e5e4] hover:border-[#d6d3d1] hover:bg-[#fafaf9] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {/* Agent steps — shown above the assistant message */}
                {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                  <div className="mb-2 ml-1 space-y-1">
                    {msg.steps.map((step, si) => {
                      const isLatest = si === msg.steps!.length - 1
                      const isActive = isLatest && !msg.content && (step.type === 'thinking' || step.type === 'tool_start' || step.type === 'responding')
                      return (
                        <div key={si} className={`flex items-center gap-2 text-[11px] ${isActive ? 'text-[#44403c]' : 'text-[#a8a29e]'}`}>
                          {step.type === 'thinking' && (
                            <Brain className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#78716c] animate-pulse' : ''}`} strokeWidth={1.5} />
                          )}
                          {step.type === 'tool_start' && (
                            <Search className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#78716c] animate-pulse' : ''}`} strokeWidth={1.5} />
                          )}
                          {step.type === 'tool_done' && (
                            <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500" strokeWidth={1.5} />
                          )}
                          {step.type === 'tool_error' && (
                            <AlertCircle className="w-3 h-3 shrink-0 text-red-400" strokeWidth={1.5} />
                          )}
                          {step.type === 'responding' && (
                            <Sparkles className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#78716c] animate-pulse' : ''}`} strokeWidth={1.5} />
                          )}
                          <span className="truncate">{step.detail}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Message bubble — hide empty assistant bubble when steps are showing */}
                {!(msg.role === 'assistant' && !msg.content && msg.steps && msg.steps.length > 0) && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#1c1917] text-white rounded-2xl rounded-br-md'
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
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-[#e7e5e4] px-4 py-3 bg-white">
            <div className="flex items-end gap-2 bg-[#f5f5f4] rounded-xl px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={activeClient ? `Ask about ${activeClient.name}...` : 'Ask Atlas about compliance...'}
                rows={1}
                className="flex-1 bg-transparent text-[13.5px] text-[#1c1917] placeholder-[#a8a29e] resize-none outline-none leading-relaxed max-h-[120px]"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1c1917] text-white hover:bg-[#0c0a09] transition-colors"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1c1917] text-white hover:bg-[#0c0a09] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#a8a29e] text-center mt-2">
              Atlas has live access to your tenant. Verify important compliance data.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
