'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Shield } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
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

  // Tick elapsed seconds while starting
  useEffect(() => {
    if (!starting) { setStartingSeconds(0); return }
    const id = setInterval(() => setStartingSeconds(s => s + 1), 1_000)
    return () => clearInterval(id)
  }, [starting])

  useEffect(() => {
    if (!frameworkId) { router.replace('/assess'); return }

    let jobId: string | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function startAssessment() {
      setStarting(true)

      // Get access token for Edge Function call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Your session has expired. Please refresh the page and try again.')
        return
      }

      // Call the assess Edge Function to start the assessment job
      const { data, error: fnError } = await supabase.functions.invoke('assess', {
        body: {
          frameworkId,
          clientId,
        },
      })

      if (fnError) {
        setError(fnError.message ?? 'Failed to start assessment. Please try again.')
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

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

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
            {done ? 'Assessment Complete' : starting ? 'Starting Assessment...' : 'Running Assessment'}
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
            {done ? 'All controls assessed' : currentTitle || (starting ? 'Connecting to assessment engine...' : 'Preparing...')}
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
          {!done && !starting && <span className="animate-pulse text-[#6f7988]">Querying Microsoft Graph...</span>}
          {starting && <span className="text-[#a4adba]">Initializing...</span>}
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
              {starting ? (
                <>
                  <p className="text-xs text-[#6f7988] font-medium">Starting assessment engine...</p>
                  <p className="text-[11px] text-[#a4adba] mt-1">
                    {startingSeconds < 5
                      ? 'Connecting...'
                      : startingSeconds < 15
                      ? `${startingSeconds}s — authenticating with Microsoft Graph...`
                      : `${startingSeconds}s — assessing controls...`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#6f7988]">Starting...</p>
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
