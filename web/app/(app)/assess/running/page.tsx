'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Shield } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { getAssessStreamUrl } from '@/lib/api'
import type { ControlAssessment, ComplianceReport, SSEEvent } from '@/lib/types'

interface ProgressItem {
  controlId: string
  title: string
  status?: ControlAssessment['status']
  done: boolean
}

function RunningInner() {
  const router      = useRouter()
  const params      = useSearchParams()
  const frameworkId = params.get('framework') ?? ''
  const clientId    = params.get('clientId') ?? undefined

  const [frameworkName, setFrameworkName] = useState('')
  const [total, setTotal]                 = useState(0)
  const [current, setCurrent]             = useState(0)
  const [currentTitle, setCurrentTitle]   = useState('')
  const [items, setItems]                 = useState<ProgressItem[]>([])
  const [done, setDone]                   = useState(false)
  const [error, setError]                 = useState('')
  const [reportId, setReportId]           = useState('')
  const [warmingUp, setWarmingUp]         = useState(false)
  const [retryCount, setRetryCount]       = useState(0)
  const listRef    = useRef<HTMLDivElement>(null)
  const retryRef   = useRef(0)
  const esRef      = useRef<EventSource | null>(null)
  const MAX_RETRIES = 4

  useEffect(() => {
    if (!frameworkId) { router.replace('/assess'); return }

    function connect() {
      const es = new EventSource(getAssessStreamUrl(frameworkId, clientId))
      esRef.current = es

      es.onmessage = (e) => {
        // Got a real message — server is awake, clear warming state
        retryRef.current = 0
        setWarmingUp(false)
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
        if (retryRef.current < MAX_RETRIES) {
          retryRef.current += 1
          setRetryCount(retryRef.current)
          setWarmingUp(true)
          // Railway cold-start can take 5–10 s — retry with back-off
          setTimeout(connect, retryRef.current === 1 ? 3000 : 5000)
        } else {
          setWarmingUp(false)
          setError('Unable to reach the assessment server. Please try again in a moment.')
        }
      }
    }

    connect()
    return () => { esRef.current?.close() }
  }, [frameworkId, clientId, router])

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-7 h-7 text-[#B91C1C]" />
          </div>
          <h2 className="text-base font-bold text-[#1c1d1f] mb-2">Assessment failed</h2>
          <p className="text-sm text-[#505967] mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => router.push('/assess')}
            className="bg-[#1c1d1f] hover:bg-[#1c1d1f] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            Back to Frameworks
          </button>
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
            {done ? 'Assessment Complete' : 'Running Assessment'}
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
            {done ? 'All controls assessed' : currentTitle || 'Preparing…'}
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
          {!done && <span className="animate-pulse text-[#6f7988]">Querying Microsoft Graph…</span>}
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
              <p className="text-xs text-[#6f7988]">
                {warmingUp
                  ? `Connecting to assessment server… (attempt ${retryCount}/${MAX_RETRIES})`
                  : 'Starting…'}
              </p>
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
            className="flex-1 bg-[#1c1d1f] hover:bg-[#1c1d1f] text-white text-sm font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
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
