'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Shield } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { getAssessStreamUrl, getClerkToken, setClerkToken } from '@/lib/api'
import type { ControlAssessment, ComplianceReport, SSEEvent } from '@/lib/types'

interface ProgressItem {
  controlId: string
  title: string
  status?: ControlAssessment['status']
  done: boolean
}

// ─── Health poll ───────────────────────────────────────────────────────────────
// Railway (hobby tier) sleeps after inactivity and takes 30–60 s to cold-start.
// EventSource.onerror fires the instant Vercel returns a 502 from the sleeping
// Railway server, so simple retry-on-error only buys ~18 s before giving up.
//
// Solution: poll GET /api/health (bypasses auth, returns {ok:true}) until Railway
// responds, THEN open EventSource. Any HTTP status < 500 means the server is
// alive. Timeout each individual fetch after 5 s; retry every 3 s; give up
// after 60 s total.

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
      if (r.status < 500) return true   // 200 OK or even 404 = server is alive
    } catch { /* fetch timeout or network error — still starting up */ }
    // Wait before next attempt (honour abort)
    await new Promise<void>(res => {
      const t = setTimeout(res, HEALTH_INTERVAL_MS)
      signal.addEventListener('abort', () => { clearTimeout(t); res() }, { once: true })
    })
  }
  return false
}

// ─── Diagnostic: why did the stream fail? ─────────────────────────────────────
// EventSource.onerror gives us NOTHING — no status code, no body. After both
// attempts fail, do a targeted REST fetch to surface the real Railway error.

async function diagnoseStreamError(): Promise<string> {
  const tok = getClerkToken()
  if (!tok) {
    return 'Your session has expired. Please refresh the page and try again.'
  }

  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8_000)
    const r = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${tok}` },
      signal: ctrl.signal,
    })
    if (r.status === 401) {
      return 'Authentication failed. Please sign out and sign back in.'
    }
    if (r.ok) {
      const clients: unknown[] = await r.json().catch(() => [])
      if (!Array.isArray(clients) || clients.length === 0) {
        return 'No Microsoft 365 tenant connected. Please connect your M365 environment before running an assessment.'
      }
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
  const listRef   = useRef<HTMLDivElement>(null)
  const esRef     = useRef<EventSource | null>(null)
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

    // ── Phase 1: wait for Railway to wake up ──
    async function run() {
      setWarmingUp(true)
      const ok = await awaitServer(abort.signal)
      if (abort.signal.aborted) return    // component unmounted — bail
      setWarmingUp(false)

      if (!ok) {
        setError('Assessment server could not be reached after 60 s. Please try again in a moment.')
        return
      }

      // ── Phase 2: open the SSE stream ──
      openStream()
    }

    async function openStream(isRetry = false) {
      // Always fetch a fresh token before opening the stream.
      // _clerkToken may be up to 50 s old (ClerkTokenSync refreshes every 50 s)
      // and Clerk tokens are only valid for 60 s. After a cold-start health poll
      // (up to 60 s) the stored token can be expired → Railway returns 401.
      try {
        const fresh = await getToken()
        if (fresh) setClerkToken(fresh)
      } catch { /* fall back to cached _clerkToken */ }

      const es = new EventSource(getAssessStreamUrl(frameworkId, clientId))
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const evt: SSEEvent = JSON.parse(e.data)

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
            es.close()
          }

          if (evt.type === 'error') {
            setError(evt.message)
            es.close()
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es.close()
        if (!isRetry) {
          // One silent retry after 3 s — fresh token is fetched in openStream
          setTimeout(() => { openStream(true) }, 3_000)
        } else {
          // Diagnose the real failure — EventSource gives us no status/body
          diagnoseStreamError().then(setError)
        }
      }
    }

    run()
    return () => { abort.abort(); esRef.current?.close() }
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
