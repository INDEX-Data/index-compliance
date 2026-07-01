'use client'

// =============================================================================
// INDEX ATLAS — Agent conversation (block model)
//
// The agent-native chat surface. Unlike the legacy drawer (one markdown string
// per message), an assistant message here is an ORDERED LIST OF BLOCKS:
//   - text     → rendered as markdown
//   - artifact → rendered as a React component (ArtifactRenderer)
// It consumes the same streaming protocol as the drawer
// (`\x01{type,detail}\n` events + raw text chunks); the new `artifact` event
// carries JSON in `detail` and pushes an artifact block into the live message.
// =============================================================================

import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, Brain, Search, CheckCircle2, AlertCircle, Sparkles, Square, Copy, Check } from 'lucide-react'
import { useCopilot } from '@/contexts/CopilotContext'
import { ArtifactRenderer, type Artifact } from '@/components/ArtifactRenderer'

type Block = { type: 'text'; text: string } | { type: 'artifact'; artifact: Artifact }

interface AgentStep {
  type: 'thinking' | 'tool_start' | 'tool_done' | 'tool_error' | 'responding' | string
  detail: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  blocks: Block[]
  steps?: AgentStep[]
}

function textOf(m: ChatMessage): string {
  return m.blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

const STEP_ICON: Record<string, typeof Brain> = {
  thinking: Brain,
  tool_start: Search,
  tool_done: CheckCircle2,
  tool_error: AlertCircle,
  responding: Sparkles,
}

export function AgentConversation({
  starters = [],
  emptyTitle = 'Ask your environment',
  emptySubtitle,
}: {
  starters?: string[]
  emptyTitle?: string
  emptySubtitle?: string
}) {
  const { pageContext, activeConversationId, setActiveConversationId, refreshConversations, activeClient } =
    useCopilot()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const copy = (i: number, text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedIdx(i)
    setTimeout(() => setCopiedIdx(null), 1500)
  }
  const conversationIdRef = useRef<string | null>(activeConversationId)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const appendTextToLast = useCallback((chunk: string) => {
    setMessages((prev) => {
      const copy = [...prev]
      const last = copy[copy.length - 1]
      const blocks = [...last.blocks]
      const tail = blocks[blocks.length - 1]
      if (tail && tail.type === 'text') {
        blocks[blocks.length - 1] = { type: 'text', text: tail.text + chunk }
      } else {
        blocks.push({ type: 'text', text: chunk })
      }
      copy[copy.length - 1] = { ...last, blocks }
      return copy
    })
  }, [])

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim()
      if (!text || isStreaming) return

      const userMsg: ChatMessage = { role: 'user', blocks: [{ type: 'text', text }] }
      const assistantMsg: ChatMessage = { role: 'assistant', blocks: [], steps: [] }
      const history = [...messages, userMsg]
      setMessages([...history, assistantMsg])
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/copilot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: textOf(m) })),
            context: pageContext,
            conversationId: conversationIdRef.current,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }))
          appendTextToLast(`**Error:** ${err.error || 'Something went wrong.'}`)
          setIsStreaming(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          while (buffer.length > 0) {
            if (buffer.startsWith('\x01')) {
              const nl = buffer.indexOf('\n')
              if (nl === -1) break
              const eventJson = buffer.slice(1, nl)
              buffer = buffer.slice(nl + 1)
              try {
                const event = JSON.parse(eventJson) as { type: string; detail: string }
                if (event.type === 'conversation_id') {
                  setActiveConversationId(event.detail)
                  conversationIdRef.current = event.detail
                } else if (event.type === 'artifact') {
                  const artifact = JSON.parse(event.detail) as Artifact
                  setMessages((prev) => {
                    const copy = [...prev]
                    const last = copy[copy.length - 1]
                    copy[copy.length - 1] = {
                      ...last,
                      blocks: [...last.blocks, { type: 'artifact', artifact }],
                    }
                    return copy
                  })
                } else {
                  setMessages((prev) => {
                    const copy = [...prev]
                    const last = copy[copy.length - 1]
                    copy[copy.length - 1] = {
                      ...last,
                      steps: [...(last.steps || []), { type: event.type, detail: event.detail }],
                    }
                    return copy
                  })
                }
              } catch {}
              continue
            }

            const next = buffer.indexOf('\x01')
            const chunk = next === -1 ? buffer : buffer.slice(0, next)
            buffer = next === -1 ? '' : buffer.slice(next)
            if (chunk) appendTextToLast(chunk)
          }
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
        }

        refreshConversations()
      } catch (err: any) {
        if (err?.name !== 'AbortError') appendTextToLast('\n\n**Error:** Connection failed.')
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [input, isStreaming, messages, pageContext, appendTextToLast, setActiveConversationId, refreshConversations]
  )

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const empty = messages.length === 0

  // Shared composer pill — rendered centered on the landing, docked at the bottom
  // once a conversation has started (the ChatGPT/Cursor transition).
  const composer = (
    <div className="flex items-end gap-2 rounded-[28px] border border-border bg-surface px-3 py-2 pl-5 min-h-[54px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_32px_-18px_rgba(0,0,0,0.22)] focus-within:border-border-strong transition-colors">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          const el = e.target
          el.style.height = 'auto'
          el.style.height = Math.min(el.scrollHeight, 180) + 'px'
        }}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Message Atlas…"
        className="flex-1 resize-none bg-transparent text-[15px] text-ink placeholder:text-faint outline-none py-2.5 max-h-44 leading-relaxed"
      />
      {isStreaming ? (
        <button
          onClick={() => abortRef.current?.abort()}
          className="shrink-0 w-9 h-9 rounded-full bg-ink text-on-accent flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Stop"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={() => send()}
          disabled={!input.trim()}
          className="shrink-0 w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center disabled:bg-surface-sunken disabled:text-faint transition-colors hover:bg-accent-hover"
          title="Send"
        >
          <ArrowUp className="w-[18px] h-[18px]" />
        </button>
      )}
    </div>
  )

  const disclaimer = (
    <p className="text-[11px] text-faint text-center mt-2.5">
      Atlas can make mistakes. Verify important findings before acting.
    </p>
  )

  // ── Landing: greeting + centered composer + suggestion chips (no messages yet) ──
  if (empty) {
    return (
      <div className="relative h-full flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* Amplemarket move: a single soft accent atmosphere bleeding in from a corner */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 12% -10%, var(--accent-wash) 0%, transparent 55%)',
          }}
        />
        <div className="relative w-full max-w-3xl flex flex-col items-center text-center">
          <h1 className="text-[40px] leading-[1.02] font-semibold text-ink tracking-[-0.03em] mb-3">
            {emptyTitle}
          </h1>
          <p className="text-[14px] text-muted leading-relaxed max-w-[480px] mb-7">
            {emptySubtitle ??
              <>I have live access to <span className="text-ink font-medium">{activeClient?.name || 'your environment'}</span>. Ask me to scan, find gaps, explain a control, or show where you stand.</>}
          </p>
          <div className="w-full">{composer}</div>
          {starters.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[12.5px] text-muted px-3.5 py-1.5 rounded-full border border-border hover:border-accent hover:bg-accent-wash hover:text-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Active conversation: messages scroll, composer docked at the bottom ──
  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              {m.role === 'user' ? (
                <div className="bg-surface-sunken rounded-3xl px-4 py-2.5 text-[14.5px] text-ink max-w-[80%] leading-relaxed">
                  {textOf(m)}
                </div>
              ) : (
                <div className="flex gap-3 w-full">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-ink flex items-center justify-center mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-on-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-ink mb-1.5">Atlas</div>
                    {m.steps && m.steps.length > 0 && isStreaming && i === messages.length - 1 && (
                      <div className="flex flex-col gap-1 mb-2">
                        {m.steps.slice(-3).map((step, si) => {
                          const Icon = STEP_ICON[step.type] ?? Sparkles
                          const done = step.type === 'tool_done'
                          return (
                            <div key={si} className="flex items-center gap-2 text-[11px] text-faint">
                              <Icon
                                className={`w-3 h-3 ${done ? 'text-pass' : step.type === 'tool_error' ? 'text-fail' : 'animate-pulse'}`}
                              />
                              {step.detail}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {m.blocks.map((b, bi) =>
                      b.type === 'text' ? (
                        b.text ? (
                          <div key={bi} className="copilot-markdown">
                            <ReactMarkdown>{b.text}</ReactMarkdown>
                          </div>
                        ) : null
                      ) : (
                        <ArtifactRenderer key={bi} artifact={b.artifact} />
                      )
                    )}
                    {textOf(m).trim() && !(isStreaming && i === messages.length - 1) && (
                      <div className="mt-2">
                        <button
                          onClick={() => copy(i, textOf(m))}
                          className="inline-flex items-center gap-1.5 text-[11px] text-faint hover:text-ink transition-colors"
                          title="Copy"
                        >
                          {copiedIdx === i ? (
                            <Check className="w-3 h-3 text-pass" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copiedIdx === i ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-canvas px-4 pt-2 pb-3">
        <div className="max-w-3xl mx-auto">
          {composer}
          {disclaimer}
        </div>
      </div>
    </div>
  )
}
