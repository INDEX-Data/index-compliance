'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Shield, CheckCircle2, XCircle, Clock, Loader2,
  AlertTriangle, ChevronDown, ChevronRight, Play, RotateCcw, Zap,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionStatus =
  | 'planned' | 'pending_approval' | 'approved' | 'executing'
  | 'complete' | 'failed' | 'rolled_back' | 'skipped'

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface AgentAction {
  id: string
  control_id: string
  agent_type: string
  status: ActionStatus
  action_data: {
    title: string
    description: string
    impact: string
    riskLevel: RiskLevel
    preconditions?: string[]
    graphOperation: { method: string; endpoint: string }
  }
  dry_run_result: { preview: unknown; warnings: string[] } | null
  approved_by: string | null
  approved_at: string | null
  executed_at: string | null
  error_message: string | null
  rolled_back_at: string | null
}

interface RemediationJob {
  id: string
  client_id: string
  assessment_id: string
  status: string
  agent_types: string[]
  created_at: string
  updated_at: string
  agent_actions: AgentAction[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const STATUS_ICONS: Record<ActionStatus, React.ReactNode> = {
  planned: <Clock className="w-4 h-4 text-zinc-400" />,
  pending_approval: <Clock className="w-4 h-4 text-amber-400" />,
  approved: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
  executing: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  complete: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
  rolled_back: <RotateCcw className="w-4 h-4 text-zinc-400" />,
  skipped: <XCircle className="w-4 h-4 text-zinc-500" />,
}

function formatTs(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function canRollback(action: AgentAction): boolean {
  if (action.status !== 'complete' || !action.executed_at) return false
  return Date.now() - new Date(action.executed_at).getTime() < 24 * 60 * 60 * 1000
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RemediationJobPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string

  const [job, setJob] = useState<RemediationJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [dryRunning, setDryRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadJob = useCallback(async () => {
    const res = await fetch(`/api/remediate/${jobId}`)
    if (!res.ok) { setLoading(false); return }
    const data: RemediationJob = await res.json()
    setJob(data)
    setLoading(false)
  }, [jobId])

  useEffect(() => { loadJob() }, [loadJob])

  // Supabase Realtime — subscribe to agent_actions changes for this job
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const channel = supabase
      .channel(`remediation-job-${jobId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'agent_actions',
        filter: `job_id=eq.${jobId}`,
      }, () => { loadJob() })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'remediation_jobs',
        filter: `id=eq.${jobId}`,
      }, () => { loadJob() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [jobId, loadJob])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const approvable = (job?.agent_actions ?? [])
      .filter((a) => a.status === 'pending_approval')
      .map((a) => a.id)
    setSelected(new Set(approvable))
  }

  const handleApprove = async () => {
    if (!selected.size) return
    const res = await fetch(`/api/remediate/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionIds: [...selected] }),
    })
    if (res.ok) { setSelected(new Set()); loadJob() }
    else setError((await res.json()).error)
  }

  const handleDryRun = async () => {
    const ids = (job?.agent_actions ?? [])
      .filter((a) => a.status === 'pending_approval')
      .map((a) => a.id)
    if (!ids.length) return
    setDryRunning(true)
    await fetch(`/api/remediate/${jobId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionIds: ids, dryRun: true }),
    })
    setDryRunning(false)
    loadJob()
  }

  const handleExecute = async () => {
    const ids = (job?.agent_actions ?? [])
      .filter((a) => a.status === 'approved')
      .map((a) => a.id)
    if (!ids.length) return
    setExecuting(true)
    const res = await fetch(`/api/remediate/${jobId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionIds: ids }),
    })
    setExecuting(false)
    if (!res.ok) setError((await res.json()).error)
    else loadJob()
  }

  const handleRollback = async (actionId: string) => {
    const res = await fetch(`/api/remediate/${jobId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
    })
    if (!res.ok) setError((await res.json()).error)
    else loadJob()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-8 text-zinc-400">
        Job not found.{' '}
        <Link href="/dashboard" className="text-blue-400 hover:underline">Back to dashboard</Link>
      </div>
    )
  }

  const actions = job.agent_actions ?? []
  const pendingCount = actions.filter((a) => a.status === 'pending_approval').length
  const approvedCount = actions.filter((a) => a.status === 'approved').length
  const completeCount = actions.filter((a) => a.status === 'complete').length
  const failedCount = actions.filter((a) => a.status === 'failed').length
  const executedActions = actions.filter((a) => ['complete', 'failed', 'rolled_back'].includes(a.status))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Shield className="w-5 h-5 text-blue-400" />
        <div>
          <h1 className="text-sm font-semibold text-zinc-100">Remediation Job</h1>
          <p className="text-xs text-zinc-500 font-mono">{jobId.slice(0, 8)}…</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            job.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
            job.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
            job.status === 'failed' ? 'bg-red-500/10 text-red-400' :
            'bg-amber-500/10 text-amber-400'
          }`}>
            {job.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left — Job Summary */}
        <aside className="w-64 shrink-0 border-r border-zinc-800 p-4 overflow-y-auto">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Summary</p>
          <div className="space-y-3">
            {[
              { label: 'Pending approval', value: pendingCount, color: 'text-amber-400' },
              { label: 'Approved', value: approvedCount, color: 'text-blue-400' },
              { label: 'Complete', value: completeCount, color: 'text-emerald-400' },
              { label: 'Failed', value: failedCount, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{label}</span>
                <span className={`text-sm font-semibold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
            <p className="text-xs text-zinc-500">Agents</p>
            {job.agent_types.map((t) => (
              <span key={t} className="block text-xs text-zinc-300 capitalize">{t.replace(/_/g, ' ')}</span>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-1">
            <p className="text-xs text-zinc-500 mb-1">Actions</p>
            {pendingCount > 0 && (
              <button
                onClick={handleDryRun}
                disabled={dryRunning}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {dryRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Preview all actions
              </button>
            )}
            {approvedCount > 0 && (
              <button
                onClick={handleExecute}
                disabled={executing}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Execute approved ({approvedCount})
              </button>
            )}
          </div>
        </aside>

        {/* Center — Action List */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Actions</p>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <>
                  <button
                    onClick={selectAll}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Select all pending
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={handleApprove}
                      className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                    >
                      Approve ({selected.size})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {actions.map((action) => {
              const expanded = expandedId === action.id
              const ad = action.action_data
              const isSelectable = action.status === 'pending_approval'

              return (
                <div
                  key={action.id}
                  className={`rounded-lg border transition-colors ${
                    selected.has(action.id)
                      ? 'border-blue-500/40 bg-blue-500/5'
                      : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => isSelectable && toggleSelect(action.id)}
                  >
                    {isSelectable ? (
                      <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                        selected.has(action.id) ? 'border-blue-500 bg-blue-500' : 'border-zinc-600'
                      }`}>
                        {selected.has(action.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    ) : (
                      <div className="mt-0.5 shrink-0">{STATUS_ICONS[action.status]}</div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-100 truncate">{ad?.title}</span>
                        {ad?.riskLevel && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RISK_COLORS[ad.riskLevel]}`}>
                            {ad.riskLevel}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500 font-mono">{action.control_id}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{ad?.impact}</p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : action.id) }}
                      className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {expanded && (
                    <div className="px-3 pb-3 border-t border-zinc-800 mt-1 pt-3 space-y-3">
                      <p className="text-xs text-zinc-300">{ad?.description}</p>

                      {ad?.preconditions?.length ? (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Preconditions</p>
                          <ul className="space-y-0.5">
                            {ad.preconditions.map((p, i) => (
                              <li key={i} className="text-xs text-amber-400 flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="bg-zinc-800/50 rounded p-2 font-mono text-xs text-zinc-400">
                        {ad?.graphOperation?.method} {ad?.graphOperation?.endpoint}
                      </div>

                      {action.dry_run_result && (
                        <div className="bg-zinc-800/50 rounded p-2">
                          <p className="text-xs text-zinc-500 mb-1">Dry-run preview</p>
                          {action.dry_run_result.warnings?.map((w, i) => (
                            <p key={i} className="text-xs text-amber-400">⚠ {w}</p>
                          ))}
                          <pre className="text-xs text-zinc-300 overflow-x-auto mt-1">
                            {JSON.stringify(action.dry_run_result.preview, null, 2)}
                          </pre>
                        </div>
                      )}

                      {action.error_message && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                          {action.error_message}
                        </div>
                      )}

                      {canRollback(action) && (
                        <button
                          onClick={() => handleRollback(action.id)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" /> Rollback (within 24h)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>

        {/* Right — Audit Log */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 p-4 overflow-y-auto">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Audit Log</p>
          {executedActions.length === 0 ? (
            <p className="text-xs text-zinc-500">No actions executed yet.</p>
          ) : (
            <div className="space-y-3">
              {executedActions.map((action) => (
                <div key={action.id} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1">
                    {STATUS_ICONS[action.status]}
                    <span className="text-zinc-200 font-medium truncate">{action.action_data?.title}</span>
                  </div>
                  {action.approved_by && (
                    <p className="text-zinc-500 pl-5">Approved by {action.approved_by}</p>
                  )}
                  {action.executed_at && (
                    <p className="text-zinc-500 pl-5">Executed {formatTs(action.executed_at)}</p>
                  )}
                  {action.rolled_back_at && (
                    <p className="text-amber-400 pl-5">Rolled back {formatTs(action.rolled_back_at)}</p>
                  )}
                  {action.error_message && (
                    <p className="text-red-400 pl-5 line-clamp-2">{action.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
