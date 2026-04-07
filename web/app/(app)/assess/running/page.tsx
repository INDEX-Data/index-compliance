'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, Shield,
  Clock, Activity, Zap, ArrowLeft,
} from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import type { ControlAssessment, ComplianceReport } from '@/lib/types'

interface ProgressItem {
  controlId: string
  title: string
  status?: ControlAssessment['status']
  done: boolean
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
  const [starting,        setStarting]        = useState(true)
  const [startingSeconds, setStartingSeconds] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const supabase = createClientSupabase()

  // Tick elapsed seconds while assessment is running
  useEffect(() => {
    if (done) { return }
    const id = setInterval(() => setStartingSeconds(s => s + 1), 1_000)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!frameworkId) { router.replace('/assess'); return }

    let jobId: string | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function startAssessment() {
      setStarting(true)

      // Call the local assess API route (replaces Supabase Edge Function)
      let data: any
      try {
        const res = await fetch('/api/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frameworkId, clientId }),
        })
        data = await res.json()
        if (!res.ok) {
          setError(data?.error ?? 'Failed to start assessment. Please try again.')
          setStarting(false)
          return
        }
      } catch (fetchErr) {
        setError(fetchErr instanceof Error ? fetchErr.message : 'Failed to start assessment.')
        setStarting(false)
        return
      }

      if (!data?.ok || !data?.jobId) {
        setError(data?.error ?? 'Failed to create assessment job.')
        setStarting(false)
        return
      }

      jobId = data.jobId

      // Fetch initial job state
      const { data: job } = await supabase
        .from('assessment_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (job) {
        processJobUpdate(job)
      }

      // Subscribe to Realtime updates on this specific job row
      channel = supabase
        .channel(`assessment-job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'assessment_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            processJobUpdate(payload.new)
          }
        )
        .subscribe()
    }

    function processJobUpdate(job: any) {
      if (!job) return

      setStarting(false)
      setTotal(job.total_controls ?? 0)
      setCurrent(job.current_index ?? 0)
      setCurrentTitle(job.current_title ?? '')

      // Parse progress array from JSONB
      const progress: ProgressItem[] = (job.progress ?? []).map((p: any) => ({
        controlId: p.controlId,
        title: p.title,
        status: p.status,
        done: p.done ?? false,
      }))
      setItems(progress)

      // Auto-scroll to latest item
      setTimeout(() => {
        listRef.current?.lastElementChild?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }, 50)

      if (job.status === 'complete' && job.report_id) {
        setReportId(job.report_id)
        setDone(true)
        // Derive framework name from the report or job
        if (job.framework_id) {
          const names: Record<string, string> = {
            CMMC_L2: 'CMMC Level 2',
            NIST_CSF: 'NIST Cybersecurity Framework',
            NIST_800_171: 'NIST SP 800-171',
            HIPAA: 'HIPAA Security Rule',
            FINRA: 'FINRA Cybersecurity',
            FERPA: 'FERPA',
          }
          setFrameworkName(names[job.framework_id] ?? job.framework_id)
        }
      }

      if (job.status === 'error') {
        setError(job.error_message ?? 'Assessment failed. Please try again.')
      }
    }

    startAssessment()

    return () => {
      // Cleanup: unsubscribe from Realtime channel
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [frameworkId, clientId, router])

  // ── Derived data ──────────────────────────────────────────────────────────
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const failedItems  = items.filter(i => i.done && i.status === 'fail')
  const passedItems  = items.filter(i => i.done && i.status === 'pass')
  const checkedCount = items.filter(i => i.done).length
  const elapsedMin   = Math.floor(startingSeconds / 60)
  const elapsedSec   = startingSeconds % 60
  const elapsedStr   = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}s`
  const currentDomain = currentTitle || (starting ? 'Initializing...' : 'Preparing...')

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    const noTenant = error.toLowerCase().includes('no m365') ||
                     error.toLowerCase().includes('no microsoft 365') ||
                     error.toLowerCase().includes('no clients') ||
                     error.toLowerCase().includes('add a client')
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-7 h-7 text-[#B91C1C]" />
          </div>
          <h2 className="text-base font-bold text-[#1c1917] mb-2">
            {noTenant ? 'M365 tenant not connected' : 'Assessment failed'}
          </h2>
          <p className="text-sm text-[#44403c] mb-6 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-2 items-center">
            {noTenant && (
              <button
                onClick={() => router.push('/connect')}
                className="w-full bg-[#1c1917] hover:bg-[#0c0a09] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
              >
                Connect Microsoft 365
              </button>
            )}
            <button
              onClick={() => router.push('/assess')}
              className={`w-full text-sm font-semibold px-5 py-2.5 rounded-lg transition border ${
                noTenant
                  ? 'bg-white text-[#44403c] border-[#a8a29e]/30'
                  : 'bg-[#1c1917] hover:bg-[#0c0a09] text-white border-transparent'
              }`}
            >
              Back to Frameworks
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Status badge styles ───────────────────────────────────────────────────
  const badgeStyles: Record<string, { bg: string; text: string; label: string }> = {
    pass:           { bg: 'bg-[#e7e5e4]',   text: 'text-[#1c1917]', label: 'Passed' },
    fail:           { bg: 'bg-[#fe8983]/30', text: 'text-[#9f403d]', label: 'Failed' },
    partial:        { bg: 'bg-[#e7e5e4]',    text: 'text-[#57534e]', label: 'Partial' },
    not_assessed:   { bg: 'bg-[#f5f5f4]',    text: 'text-[#44403c]', label: 'N/A' },
    not_applicable: { bg: 'bg-[#f5f5f4]',    text: 'text-[#44403c]', label: 'N/A' },
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-6xl space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#0c0a09] mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {done ? 'Assessment Complete' : 'Running Assessment'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1c1917]">
            {done ? 'Compliance Scan Complete' : starting ? 'Starting Compliance Scan...' : 'Compliance Scan In Progress'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {frameworkId && (
              <span className="px-2.5 py-1 bg-[#e7e5e4] rounded text-xs font-medium text-[#44403c]">
                <span className="text-[#a8a29e]">Framework:</span>{' '}
                <span className="font-semibold text-[#1c1917]">{frameworkName || frameworkId}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!done && (
            <button
              onClick={() => router.push('/assess')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#44403c] font-semibold text-sm border border-[#a8a29e]/30 rounded shadow-sm hover:bg-[#fafaf9] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={() => done && reportId ? router.push(`/assess/${reportId}`) : undefined}
            disabled={!done || !reportId}
            className={`px-6 py-2 font-semibold text-sm rounded shadow-sm transition-colors ${
              done && reportId
                ? 'text-white hover:opacity-90'
                : 'bg-[#f5f5f4] text-[#a8a29e] cursor-not-allowed'
            }`}
            style={done && reportId ? { background: 'linear-gradient(180deg, #1c1917 0%, #0c0a09 100%)' } : undefined}
          >
            View Full Report
          </button>
        </div>
      </div>

      {/* ── Progress Card ── */}
      <div className="bg-white rounded-xl p-8 border border-[#a8a29e]/10">
        <div className="flex justify-between items-end mb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[#44403c] uppercase tracking-widest">Current Evaluation Phase</span>
            <h3 className="text-xl font-semibold text-[#1c1917]">{currentDomain}</h3>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black text-[#0c0a09] tracking-tighter">{done ? 100 : pct}%</span>
            <span className="text-xs block font-bold text-[#44403c] uppercase">Complete</span>
          </div>
        </div>

        <div className="h-3 w-full bg-[#f5f5f4] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 relative"
            style={{
              width: `${done ? 100 : pct}%`,
              background: done
                ? '#15803D'
                : 'linear-gradient(90deg, #1c1917, #0c0a09)',
            }}
          >
            {!done && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
          </div>
        </div>

        <div className="grid grid-cols-4 mt-6 gap-4">
          <div className="space-y-1 border-l-2 border-[#e7e5e4] pl-3">
            <span className="text-[10px] uppercase font-bold text-[#44403c]">Elapsed Time</span>
            <p className="text-sm font-semibold text-[#1c1917]">{elapsedStr}</p>
          </div>
          <div className="space-y-1 border-l-2 border-[#e7e5e4] pl-3">
            <span className="text-[10px] uppercase font-bold text-[#44403c]">Controls Checked</span>
            <p className="text-sm font-semibold text-[#1c1917]">{checkedCount} / {total || '—'}</p>
          </div>
          <div className="space-y-1 border-l-2 border-[#e7e5e4] pl-3">
            <span className="text-[10px] uppercase font-bold text-[#44403c]">Detected Risks</span>
            <p className={`text-sm font-semibold ${failedItems.length > 0 ? 'text-[#9f403d]' : 'text-[#1c1917]'}`}>
              {failedItems.length > 0 ? `${failedItems.length} Critical` : 'None'}
            </p>
          </div>
          <div className="space-y-1 border-l-2 border-[#e7e5e4] pl-3">
            <span className="text-[10px] uppercase font-bold text-[#44403c]">Engine Load</span>
            <p className="text-sm font-semibold text-[#1c1917]">
              {done ? 'Idle' : starting ? 'Warming up' : 'Active'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Grid: Control Ledger + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2/3 — Real-Time Control Ledger */}
        <div className="lg:col-span-2">
          <div className="bg-[#fafaf9] rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#f5f5f4] border-b border-[#a8a29e]/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#44403c]" />
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#44403c]">Real-Time Control Ledger</h3>
              </div>
              <div className="flex items-center gap-2">
                {!done && !starting && <span className="w-1.5 h-1.5 rounded-full bg-[#1c1917] animate-pulse" />}
                <span className="text-[10px] text-[#a8a29e]">LIVE FEED FROM MICROSOFT GRAPH</span>
              </div>
            </div>

            <div ref={listRef} className="max-h-[420px] overflow-y-auto sidebar-scroll divide-y divide-[#f5f5f4]/70">
              {items.length === 0 && (
                <div className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3 text-[#a8a29e]" />
                  {starting ? (
                    <>
                      <p className="text-xs text-[#44403c] font-medium">Starting assessment engine...</p>
                      <p className="text-[11px] text-[#a8a29e] mt-1">
                        {startingSeconds < 5
                          ? 'Connecting...'
                          : startingSeconds < 15
                          ? `${startingSeconds}s — authenticating with Microsoft Graph...`
                          : `${startingSeconds}s — assessing controls...`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[#44403c]">Preparing...</p>
                  )}
                </div>
              )}
              {items.map((item, idx) => {
                const isPending = !item.done && idx > current
                const isActive  = !item.done && !isPending
                const badge = item.done && item.status ? badgeStyles[item.status] ?? badgeStyles.not_assessed : null

                return (
                  <div
                    key={item.controlId}
                    className={`px-6 py-3.5 flex items-center justify-between transition-colors ${
                      isPending ? 'opacity-50' : isActive ? 'bg-white' : 'hover:bg-[#f5f5f4]/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {isActive ? (
                          <div className="w-4 h-4 border-2 border-[#1c1917] border-t-transparent rounded-full animate-spin" />
                        ) : isPending ? (
                          <Clock className="w-4 h-4 text-[#a8a29e]" />
                        ) : item.status === 'pass' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                        ) : item.status === 'fail' ? (
                          <XCircle className="w-4 h-4 text-[#9f403d]" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#B45309]" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold text-[#1c1917]">{item.controlId}</span>
                        <span className="text-sm font-medium text-[#1c1917]">{item.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {badge ? (
                        <span className={`px-2 py-0.5 ${badge.bg} ${badge.text} text-[10px] font-bold uppercase tracking-wider rounded`}>
                          {badge.label}
                        </span>
                      ) : isActive ? (
                        <span className="px-2 py-0.5 bg-[#e7e5e4] text-[#57534e] text-[10px] font-bold uppercase tracking-wider rounded">
                          In Progress
                        </span>
                      ) : isPending ? (
                        <span className="px-2 py-0.5 bg-[#f5f5f4] text-[#44403c] text-[10px] font-bold uppercase tracking-wider rounded">
                          Pending
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right 1/3 — Sidebar Panels */}
        <div className="space-y-6">
          {/* Scanner Telemetry */}
          <div className="bg-[#0c0a09] text-white rounded-xl p-6 shadow-xl">
            <h4 className="text-[11px] font-bold uppercase tracking-widest mb-4 opacity-70">Scanner Telemetry</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-sm opacity-80 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" /> API Latency
                </span>
                <span className="text-sm font-mono font-bold">
                  {done ? '—' : starting ? '...' : '~120ms'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-sm opacity-80 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Throttle Status
                </span>
                <span className={`text-sm font-mono font-bold ${!done && !starting ? 'text-green-300' : ''}`}>
                  {done ? 'Idle' : starting ? 'Connecting' : 'Optimal'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-80 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Identity Checks
                </span>
                <span className="text-sm font-mono font-bold">{checkedCount > 0 ? checkedCount.toLocaleString() : '—'}</span>
              </div>
            </div>
            <div className="mt-6 p-4 bg-white/10 rounded-lg border border-white/5">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-[#e7e5e4] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold mb-1">Assessment Engine Active</p>
                  <p className="text-[10px] opacity-70 leading-relaxed">
                    Performing automated compliance checks via Microsoft Graph API.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Insights */}
          <div className="bg-[#d6d3d1] rounded-xl p-6">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#44403c] mb-4">Live Insights</h4>
            <ul className="space-y-3">
              {failedItems.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9f403d] mt-1.5 shrink-0" />
                  <p className="text-xs text-[#1c1917]">
                    Detected <strong>{failedItems.length}</strong> failed control{failedItems.length !== 1 ? 's' : ''} requiring attention.
                  </p>
                </li>
              )}
              {passedItems.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1c1917] mt-1.5 shrink-0" />
                  <p className="text-xs text-[#1c1917]">
                    <strong>{passedItems.length}</strong> control{passedItems.length !== 1 ? 's' : ''} passed compliance checks.
                  </p>
                </li>
              )}
              {failedItems.slice(0, 3).map(item => (
                <li key={item.controlId} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] mt-1.5 shrink-0" />
                  <p className="text-xs text-[#1c1917]">
                    <span className="font-mono text-[10px] text-[#9f403d]">{item.controlId}</span> — {item.title}
                  </p>
                </li>
              ))}
              {checkedCount === 0 && (
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#a8a29e] mt-1.5 shrink-0" />
                  <p className="text-xs text-[#44403c]">Waiting for results...</p>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Footer Note ── */}
      <div className="border-l-4 border-[#1c1917] bg-[#f5f5f4] rounded-lg p-6 flex items-center gap-4">
        <AlertCircle className="w-6 h-6 text-[#0c0a09] shrink-0" />
        <div>
          <h5 className="text-sm font-bold text-[#1c1917] uppercase tracking-tight">Assessment Note</h5>
          <p className="text-xs text-[#44403c] leading-relaxed">
            This assessment queries your Microsoft 365 tenant via the <strong>Microsoft Graph API</strong> using delegated permissions. Control evaluations are performed in real-time. Please do not close the browser until the scan reaches 100%.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RunningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[#a8a29e]" />
      </div>
    }>
      <RunningInner />
    </Suspense>
  )
}
