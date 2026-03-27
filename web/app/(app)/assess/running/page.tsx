'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Shield } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { getAssessStreamUrl, getClerkToken } from '@/lib/api'
import type { ControlAssessment, ComplianceReport, SSEEvent } from '@/lib/types'

interface ProgressItem {
  controlId: string
  title: string
  status?: ControlAssessment['status']
  done: boolean
}

// ─── Health poll ───────────────────────────────────────────────────────────────
// Railway (hobby tier) sleeps after inactivity and takes 30–60 s to cold-start.
// Poll GET /api/health (bypasses auth, returns {ok:true}) until Railway responds,
// THEN open the SSE stream. Any HTTP status < 500 means the server is alive.

const HEALTH_INTERVAL_MS = 3_000
const HEALTH_TIMEOUT_MS  = 5_000
const HEALTH_MAX_POLLS   = 20   // 20 × 3 s = 60 s max

async function awaitServer(signal: AbortSignal): Promise<boolean> {
  for (let i = 0; i < HEALTH_MAX_POLLS; i++) {
    if (signal.aborted) return false
    try {
      const ctrl = new AbortController()
      const tid  = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
      const r    = await fetch('/api/health', { signal: ctrl.signal })
      clearTimeout(tid)
      if (r.status < 500) return true
    } catch { /* still starting up */ }
    await new Promise<void>(res => {
      const t = setTimeout(res, HEALTH_INTERVAL_MS)
      signal.addEventListener('abort', () => { clearTimeout(t); res() }, { once: true })
    })
  }
  return false
}

// ─── Diagnostic: why did the stream fail? ─────────────────────────────────────
async function diagnoseStreamError(): Promise<string> {
  const tok = getClerkToken()
  if (!tok) return 'Your session has expired. Please refresh the page and try again.'
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8_000)
    const r = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${tok}` },
      signal: ctrl.signal,
    })
    if (r.status === 401) return 'Authentication failed. Please sign out and sign back in.'
    if (r.ok) {
      const clients: unknown[] = await r.json().catch(() => [])
      if (!Array.isArray(clients) || clients.length === 0)
        return 'No Microsoft 365 tenant connected. Please connect your M365 environment before running an assessment.'
    }
  } catch { /* network / timeout */ }
  return 'Assessment server connection failed. Please try again in a moment.'
}

// ─── Main component ────────────────────────────────────────────────────────────

function RunningInner() {
  const router      = useRouter()
  const params      = useSearchParams()
  const frameworkId = params.get('framework') ?? ''
  const clientId    = params.get('clientId') ?? undefined

  const [frameworkName,   setFrameworkName]   = useState('')
  const [total,           setTotal]           = useState(0)
  const [current,         setCurrent]         = useState(0)
  const [currentTitle,    setCurrentTitle]    = useState('')
  const [items,           setItems]           = useState<ProgressItem[]>([])
  const [done,            setDone]            = useState(false)
  const [error,           setError]           = useState('')
  const [reportId,        setReportId]        = useState('')
  const [warmingUp,       setWarmingUp]       = useState(false)
  const [warmingSeconds,  setWarmingSeconds]  = useState(0)
  const listRef    = useRef<HTMLDivElement>(null)
  // Stores an abort controller's abort function so cleanup can cancel the stream
  const cancelRef  = useRef<(() => void) | null>(null)
  const { getToken } = useAuth()

  // Tick elapsed seconds while warming up
  useEffect(() => {
    if (!warmingUp) { setWarmingSeconds(0); return }
    const id = setInterval(() => setWarmingSeconds(s => s + 1), 1_000)
    return () => clearInterval(id)
  }, [warmingUp])

  useEffect(() => {
    if (!frameworkId) { router.replace('/assess'); return }

    const abort = new AbortController()

    async function run() {
      setWarmingUp(true)
      const ok = await awaitServer(abort.signal)
      if (abort.signal.aborted) return
      setWarmingUp(false)

      if (!ok) {
        setError('Assessment server could not be reached after 60 s. Please try again in a moment.')
        return
      }

      openStream()
    }

    async function openStream(isRetry = false) {
      if (abort.signal.aborted) return

      // Fetch a fresh Clerk token via Authorization header.
      // EventSource (the old approach) forced the token into the URL query param
      // (?token=...) which Railway's verifyToken consistently rejected.
      // fetch() lets us use the standard Authorization header — same path as all
      // other API calls which work correctly.
      let token: string | null = null
      try {
        token = await getToken()
      } catch { /* ignore — try cached token */ }
      if (!token) token = getClerkToken()
      if (!token) {
        if (!isRetry) { setTimeout(() => openStream(true), 3_000); return }
        setError('Your session has expired. Please refresh the page and try again.')
        return
      }

      const url = getAssessStreamUrl(frameworkId, clientId)
      const ctrl = new AbortController()
      cancelRef.current = () => ctrl.abort()

      let res: Response
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: ctrl.signal,
        })
      } catch (err: unknown) {
        if (ctrl.signal.aborted || abort.signal.aborted) return
        if (!isRetry) { setTimeout(() => openStream(true), 3_000); return }
        diagnoseStreamError().then(setError)
        return
      }

      if (!res.ok) {
        if (!isRetry) { setTimeout(() => openStream(true), 3_000); return }
        diagnoseStreamError().then(setError)
        return
      }

      // ── Parse SSE events from the ReadableStream ────────────────────────────
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      function processEvent(raw: string) {
        const dataLine = raw.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) return
        try {
          const evt: SSEEvent = JSON.parse(dataLine.slice(5).trim())

          if (evt.type === 'start') {
            setFrameworkName(evt.frameworkName)
            setTotal(evt.total)
          }

          if (evt.type === 'progress') {
            setCurrent(evt.index)
            setCurrentTitle(evt.title)
            setItems(prev => {
              if (prev.find(i => i.controlId === evt.controlId)) return prev
              return [...prev, { controlId: evt.controlId, title: evt.title, done: false }]
            })
            setTimeout(() => listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
          }

          if (evt.type === 'result') {
            const a = evt.assessment
            setItems(prev => prev.map(i =>
              i.controlId === a.controlId ? { ...i, status: a.status, done: true } : i
            ))
          }

          if (evt.type === 'complete') {
            const rpt: ComplianceReport = evt.report
            setReportId(rpt.reportId)
            setDone(true)
          }

          if (evt.type === 'error') {
            setError(evt.message)
          }
        } catch { /* ignore parse errors */ }
      }

      try {
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          if (abort.signal.aborted || ctrl.signal.aborted) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            if (part.trim()) processEvent(part)
          }
        }
      } catch (err: unknown) {
        if (ctrl.signal.aborted || abort.signal.aborted) return
        if (!isRetry) { setTimeout(() => openStream(true), 3_000); return }
        diagnoseStreamError().then(setError)
      }
    }

    run()
    return () => {
      abort.abort()
      cancelRef.current?.()
    }
  }, [frameworkId, clientId, router, getToken])

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  if (error) {
    const noTenant = error.toLowerCase().includes('no microsoft 365') ||
                     error.toLowerCase().includes('no clients')
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-7 h-7 text-[#B91C1C]" />
          </div>
          <h2 className="text-base font-bold text-[#1c1d1f] mb-2">
            {noTenant ? 'M365 tenant not connected' : 'Assessment failed'}
          </h2>
          <p className="text-sm text-[#505967] mb-6 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-2 items-center">
            {noTenant && (
              <button
                onClick={() => router.push('/connect')}
                className="w-full bg-[#1c1d1f] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
              >
                Connect Microsoft 365
              </button>
            )}
            <button
              onClick={() => router.push('/assess')}
              className={`w-full text-sm font-semibold px-5 py-2.5 rounded-lg transition border ${
                noTenant
                  ? 'bg-white text-[#505967] border-[#e4e7ec]'
                  : 'bg-[#1c1d1f] text-white border-transparent'
              }`}
            >
              Back to Frameworks
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {done
            ? <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
            : <Loader2 className="w-5 h-5 text-[#6f7988] animate-spin" />
          }
          <h1 className="text-[20px] font-bold text-[#1c1d1f] tracking-tight">
            {done ? 'Assessment Complete' : warmingUp ? 'Warming up…' : 'Running Assessment'}
          </h1>
        </div>
        {frameworkName && (
          <p className="text-sm text-[#505967] ml-8">{frameworkName}</p>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-[#e4e7ec] p-5 mb-5 shadow-card">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-[#1c1d1f] font-medium truncate mr-4">
            {done ? 'All controls assessed' : currentTitle || (warmingUp ? 'Waiting for server…' : 'Preparing…')}
          </span>
          <span className="text-[#6f7988] font-mono text-xs shrink-0">{current}/{total}</span>
        </div>
        <div className="w-full bg-[#eeeff1] rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${done ? 100 : pct}%`,
              background: done ? '#15803D' : '#1c1d1f',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-[#a4adba]">
          <span>{done ? '100' : pct}% complete</span>
          {!done && !warmingUp && <span className="animate-pulse text-[#6f7988]">Querying Microsoft Graph…</span>}
          {warmingUp && <span className="text-[#a4adba]">Server starting up…</span>}
        </div>
      </div>

      {/* Control list */}
      <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden mb-5 shadow-card">
        <div className="px-5 py-3 border-b border-[#eeeff1] flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-[#a4adba]" />
          <span className="text-[11px] font-semibold text-[#6f7988] uppercase tracking-widest">Controls</span>
        </div>
        <div ref={listRef} className="divide-y divide-[#fafafa] max-h-[400px] overflow-y-auto sidebar-scroll">
          {items.length === 0 && (
            <div className="py-10 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#a4adba]" />
              {warmingUp ? (
                <>
                  <p className="text-xs text-[#6f7988] font-medium">Waking up assessment server…</p>
                  <p className="text-[11px] text-[#a4adba] mt-1">
                    {warmingSeconds < 10
                      ? 'Starting up…'
                      : warmingSeconds < 30
                      ? `${warmingSeconds}s — this can take ~30 seconds`
                      : `${warmingSeconds}s — almost ready…`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#6f7988]">Starting…</p>
              )}
            </div>
          )}
          {items.map(item => (
            <div key={item.controlId} className="flex items-center gap-3 px-5 py-3">
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {!item.done ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#a4adba] animate-spin" />
                ) : item.status === 'pass' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                ) : item.status === 'fail' ? (
                  <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-[#B45309]" />
                )}
              </div>
              <span className="font-mono text-[10px] text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-1.5 py-0.5 rounded shrink-0">
                {item.controlId}
              </span>
              <span className="text-[13px] text-[#1c1d1f] flex-1 truncate">{item.title}</span>
              {item.done && item.status && (
                <StatusBadge status={item.status} size="sm" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Done CTA */}
      {done && reportId && (
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/assess/${reportId}`)}
            className="flex-1 bg-[#1c1d1f] text-white text-sm font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            View Full Report
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-3 bg-white hover:bg-[#fafafa] text-[#505967] hover:text-[#1c1d1f] text-sm font-medium rounded-lg transition border border-[#e4e7ec]"
          >
            Dashboard
          </button>
        </div>
      )}
    </div>
  )
}

export default function RunningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[#a4adba]" />
      </div>
    }>
      <RunningInner />
    </Suspense>
  )
}
