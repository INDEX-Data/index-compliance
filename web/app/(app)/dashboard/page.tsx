'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Clock, Play, AlertTriangle, ChevronRight,
  FileText, Building2, ArrowRight, LayoutDashboard,
  TrendingUp, TrendingDown,
  ShieldCheck, ShieldX, Layers,
  CheckCircle2, XCircle, MinusCircle, HelpCircle,
  Activity, Users, X, ChevronDown, Lock,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getReports, getClients, getReportDrift, getProfile } from '@/lib/api'
import { createClientSupabase } from '@/lib/supabase'
import type { DriftResult } from '@/lib/api'
import { ScoreTrend } from '@/components/ScoreTrend'
import { RiskBadge } from '@/components/RiskBadge'
import type { ReportMeta } from '@/lib/types'
import { FRAMEWORK_CATALOG } from '@/lib/framework-catalog'

// ─── Drift Widget ─────────────────────────────────────────────────────────────

function DriftWidget() {
  const [drift, setDrift]     = useState<DriftResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    getReportDrift()
      .then(d  => setDrift(d))
      .catch(() => setDrift(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#e7e5e4] shadow-card p-5 flex items-center gap-3">
        <Activity className="w-4 h-4 text-[#a8a29e] animate-pulse" />
        <span className="text-[12px] text-[#a8a29e]">Checking for drift…</span>
      </div>
    )
  }

  if (!drift || !drift.hasDrift) {
    return (
      <div className="bg-white rounded-xl border border-[#e7e5e4] shadow-card p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[rgba(14,180,114,0.10)] flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-[#0eb472]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#1c1d1f]">No configuration drift</p>
          <p className="text-[11px] text-[#78716c] mt-0.5">
            {drift?.message ?? 'Not enough reports to compare yet.'}
          </p>
        </div>
      </div>
    )
  }

  const deltaPos = (drift.scoreDelta ?? 0) >= 0
  const changed  = drift.changed ?? []

  return (
    <div className="bg-white rounded-xl border border-[#e7e5e4] shadow-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-[#fafafa] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          deltaPos ? 'bg-[rgba(14,180,114,0.10)]' : 'bg-[rgba(242,87,87,0.10)]'
        }`}>
          <Activity className={`w-4 h-4 ${deltaPos ? 'text-[#0eb472]' : 'text-[#f25757]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1c1d1f]">
            Configuration Drift Detected
          </p>
          <p className="text-[11px] text-[#78716c] mt-0.5">
            {drift.improved ?? 0} improved · {drift.degraded ?? 0} degraded since last scan
            {drift.scoreDelta !== undefined && (
              <span className={`ml-2 font-semibold ${deltaPos ? 'text-[#0eb472]' : 'text-[#f25757]'}`}>
                {deltaPos ? '+' : ''}{drift.scoreDelta}% overall
              </span>
            )}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#a8a29e] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded: changed controls list */}
      {expanded && changed.length > 0 && (
        <div className="border-t border-[#f5f5f4] divide-y divide-[#f3f4f6]">
          {changed.slice(0, 10).map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                c.direction === 'improved' ? 'bg-[#0eb472]' : 'bg-[#f25757]'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#1c1d1f] truncate">{c.controlName}</p>
                <p className="text-[11px] text-[#78716c]">
                  <span className="capitalize">{c.from}</span>
                  {' → '}
                  <span className={`font-medium ${c.direction === 'improved' ? 'text-[#0eb472]' : 'text-[#f25757]'}`}>
                    {c.to}
                  </span>
                </p>
              </div>
              <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                c.direction === 'improved'
                  ? 'bg-[rgba(14,180,114,0.10)] text-[#0eb472]'
                  : 'bg-[rgba(242,87,87,0.10)] text-[#f25757]'
              }`}>
                {c.direction === 'improved' ? '▲ Improved' : '▼ Degraded'}
              </div>
            </div>
          ))}
          {changed.length > 10 && (
            <div className="px-5 py-3 text-[11px] text-[#a8a29e]">
              +{changed.length - 10} more controls changed
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Staffing / Timeline Estimator Modal ─────────────────────────────────────

const QUESTIONS = [
  {
    id: 'size',
    label: 'How many employees does the organisation have?',
    options: [
      { value: 'micro',  label: '1–10 employees' },
      { value: 'small',  label: '11–50 employees' },
      { value: 'medium', label: '51–250 employees' },
      { value: 'large',  label: '251–1,000 employees' },
      { value: 'xlarge', label: '1,000+ employees' },
    ],
  },
  {
    id: 'scope',
    label: 'How many CUI / controlled systems are in scope?',
    options: [
      { value: 'low',    label: 'Fewer than 10 systems' },
      { value: 'medium', label: '10–50 systems' },
      { value: 'high',   label: '50–200 systems' },
      { value: 'very_high', label: '200+ systems' },
    ],
  },
  {
    id: 'maturity',
    label: 'What is the current security programme maturity?',
    options: [
      { value: 'none',     label: 'No formal programme' },
      { value: 'basic',    label: 'Basic (policies exist, inconsistently applied)' },
      { value: 'managed',  label: 'Managed (documented, mostly enforced)' },
      { value: 'advanced', label: 'Advanced (continuous monitoring in place)' },
    ],
  },
  {
    id: 'gaps',
    label: 'Roughly how many controls are currently failing or partial?',
    options: [
      { value: 'few',    label: 'Fewer than 10' },
      { value: 'some',   label: '10–30' },
      { value: 'many',   label: '30–80' },
      { value: 'most',   label: '80+' },
    ],
  },
  {
    id: 'resources',
    label: 'Do you have dedicated security staff available for remediation?',
    options: [
      { value: 'none',     label: 'No — would need to hire / contract' },
      { value: 'part',     label: 'Part-time (< 50% bandwidth)' },
      { value: 'fulltime', label: 'Full-time security engineer' },
      { value: 'team',     label: 'Dedicated security team (2+ people)' },
    ],
  },
]

// Simple heuristic scoring → weeks & FTE
function estimateTimeline(answers: Record<string, string>) {
  let weeks = 8
  let fte   = 0.5

  // Size
  if (answers.size === 'medium') { weeks += 4; fte += 0.5 }
  if (answers.size === 'large')  { weeks += 8; fte += 1 }
  if (answers.size === 'xlarge') { weeks += 16; fte += 2 }

  // Scope
  if (answers.scope === 'medium')    { weeks += 2; fte += 0.25 }
  if (answers.scope === 'high')      { weeks += 6; fte += 0.5 }
  if (answers.scope === 'very_high') { weeks += 12; fte += 1 }

  // Maturity (inverse)
  if (answers.maturity === 'none')    { weeks += 8; fte += 0.5 }
  if (answers.maturity === 'basic')   { weeks += 4 }
  if (answers.maturity === 'advanced') { weeks -= 4; fte -= 0.25 }

  // Gaps
  if (answers.gaps === 'some') { weeks += 4; fte += 0.25 }
  if (answers.gaps === 'many') { weeks += 8; fte += 0.5 }
  if (answers.gaps === 'most') { weeks += 16; fte += 1 }

  // Resources (inverse)
  if (answers.resources === 'none')     { weeks += 4; fte += 1 }
  if (answers.resources === 'fulltime') { weeks -= 2 }
  if (answers.resources === 'team')     { weeks -= 4; fte -= 0.5 }

  return {
    weeks:  Math.max(4,  Math.round(weeks)),
    fte:    Math.max(0.25, Math.round(fte * 4) / 4),
  }
}

function StaffingEstimatorModal({ onClose }: { onClose: () => void }) {
  const [step,    setStep]    = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result,  setResult]  = useState<{ weeks: number; fte: number } | null>(null)

  function pick(value: string) {
    const q    = QUESTIONS[step]
    const next = { ...answers, [q.id]: value }
    setAnswers(next)
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1)
    } else {
      setResult(estimateTimeline(next))
    }
  }

  const q = QUESTIONS[step]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(28,29,31,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#f5f5f4]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(37,93,173,0.15)] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#1c1917]" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[#1c1d1f]">Staffing & Timeline Estimator</h2>
              {!result && (
                <p className="text-[11px] text-[#78716c]">
                  Question {step + 1} of {QUESTIONS.length}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[#a8a29e] hover:text-[#505967] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        {!result && (
          <div className="h-0.5 bg-[#f3f4f6]">
            <div
              className="h-0.5 bg-[#1c1917] transition-all duration-500"
              style={{ width: `${((step) / QUESTIONS.length) * 100}%` }}
            />
          </div>
        )}

        <div className="px-6 py-6">
          {result ? (
            /* Results */
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[rgba(37,93,173,0.15)] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-[#1c1917]" />
                </div>
                <h3 className="text-[17px] font-bold text-[#1c1d1f] mb-1" style={{ letterSpacing: '-0.01em' }}>
                  Your CMMC Remediation Estimate
                </h3>
                <p className="text-[12px] text-[#78716c]">Based on your inputs — for planning purposes only</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#fafafa] rounded-xl p-4 border border-[#e7e5e4] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a8a29e] mb-1">Timeline</p>
                  <p className="text-[28px] font-bold text-[#1c1d1f] tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                    {result.weeks}
                  </p>
                  <p className="text-[11px] text-[#78716c]">weeks to CMMC-ready</p>
                </div>
                <div className="bg-[#fafafa] rounded-xl p-4 border border-[#e7e5e4] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a8a29e] mb-1">Staffing</p>
                  <p className="text-[28px] font-bold text-[#1c1d1f] tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                    {result.fte}
                  </p>
                  <p className="text-[11px] text-[#78716c]">FTE equiv. needed</p>
                </div>
              </div>

              <div className="bg-[rgba(37,93,173,0.08)] border border-[rgba(37,93,173,0.3)] rounded-xl p-4 text-[12px] text-[#505967] leading-relaxed">
                <p className="font-semibold text-[#1c1d1f] mb-1">What this means:</p>
                <p>
                  Based on your profile, plan for a <strong>{result.weeks}-week remediation sprint</strong> with approximately{' '}
                  <strong>{result.fte} FTE</strong> dedicated to security improvements.
                  Engage a C3PAO at least 60 days before your target assessment date.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(0); setAnswers({}); setResult(null) }}
                  className="flex-1 text-[13px] font-medium text-[#505967] bg-[#f3f4f6] hover:bg-[#e7e5e4] px-4 py-2.5 rounded-lg transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 text-[13px] font-medium text-white px-4 py-2.5 rounded-lg transition-colors"
                  style={{ background: '#1c1917' }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Question */
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[#1c1d1f] leading-snug" style={{ letterSpacing: '-0.01em' }}>
                {q.label}
              </h3>
              <div className="space-y-2">
                {q.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => pick(opt.value)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-[#e7e5e4] text-[13px] text-[#1c1d1f] hover:border-[#1c1917] hover:bg-[rgba(37,93,173,0.04)] transition-all duration-150"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="text-[12px] text-[#a8a29e] hover:text-[#78716c] transition-colors"
                >
                  ← Back
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Donut colors (Lovable palette) ──────────────────────────────────────────

const DONUT_COLORS = {
  passed:      '#0eb472',
  partial:     '#f5a300',
  failed:      '#f25757',
  notAssessed: '#a8a29e',
}

// ─── Stat Card — tonal surface style ─────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string | React.ReactNode
  accent?: boolean
  danger?: boolean
  progress?: number // 0–100 for progress bar
  footer?: React.ReactNode
}

function StatCard({ label, value, sub, accent, danger, progress, footer }: StatCardProps) {
  return (
    <div className={`bg-white p-6 rounded-xl flex flex-col justify-between group border border-[#e7e5e4] shadow-sm hover:shadow-md transition-all duration-300 ${danger ? 'border-l-4 border-l-[#9f403d]' : ''}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${danger ? 'text-[#9f403d]' : 'text-[#44403c]'}`}>
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold tracking-tight ${accent ? 'text-[#1c1917]' : danger ? 'text-[#9f403d]' : 'text-[#1c1917]'}`}>
          {value}
        </span>
        {sub && <span className="text-xs text-[#44403c]">{sub}</span>}
      </div>
      {progress !== undefined && (
        <div className="mt-4 h-1 bg-[#d6d3d1] rounded-full overflow-hidden">
          <div className="h-full bg-[#1c1917] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}

// ─── Framework Card — Lovable structure + real data ───────────────────────────

interface FrameworkCardProps {
  report:  ReportMeta
  history: ReportMeta[]
}

function FrameworkCard({ report, history }: FrameworkCardProps) {
  const pct       = report.summary.compliancePercentage
  const scores    = history.map(r => r.summary.compliancePercentage)
  const prevScore = scores.length >= 2 ? scores[scores.length - 2] : null
  const delta     = prevScore !== null ? pct - prevScore : null
  const total     = report.summary.passed + report.summary.partial + report.summary.failed + report.summary.notAssessed

  const chartData = [
    { name: 'Passed',  value: report.summary.passed },
    { name: 'Partial', value: report.summary.partial },
    { name: 'Failed',  value: report.summary.failed },
    { name: 'N/A',     value: report.summary.notAssessed },
  ]

  const statDots = [
    { label: 'Passed',  count: report.summary.passed,      color: DONUT_COLORS.passed },
    { label: 'Partial', count: report.summary.partial,     color: DONUT_COLORS.partial },
    { label: 'Failed',  count: report.summary.failed,      color: DONUT_COLORS.failed },
    { label: 'N/A',     count: report.summary.notAssessed, color: DONUT_COLORS.notAssessed },
  ]

  return (
    <div className="bg-white rounded-xl border border-[#e7e5e4] shadow-card hover:shadow-card-hover transition-shadow">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-[#f5f5f4]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold text-[#1c1d1f]" style={{ letterSpacing: '-0.01em' }}>
              {report.frameworkName}
            </h3>
            <RiskBadge score={report.summary.riskScore} />
          </div>
          <p className="text-[12px] text-[#78716c] mt-1">
            {report.clientName ?? 'All clients'} · {report.frameworkId.toUpperCase()}
          </p>
        </div>

        {/* Score + delta */}
        <div className="text-right shrink-0 ml-4">
          <p className="text-[32px] font-bold text-[#1c1d1f] tabular-nums leading-none" style={{ letterSpacing: '-0.02em' }}>
            {pct}%
          </p>
          {delta !== null && (
            <div className={`flex items-center justify-end gap-1 text-[12px] font-medium mt-1 ${delta >= 0 ? 'text-[#0eb472]' : 'text-[#f25757]'}`}>
              {delta >= 0
                ? <TrendingUp className="h-3.5 w-3.5" />
                : <TrendingDown className="h-3.5 w-3.5" />
              }
              <span>{delta > 0 ? '+' : ''}{delta}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body: donut + stats ── */}
      <div className="px-6 py-5 flex gap-6">

        {/* Donut */}
        <div className="w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%" cy="50%"
                innerRadius={26} outerRadius={42}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill={DONUT_COLORS.passed} />
                <Cell fill={DONUT_COLORS.partial} />
                <Cell fill={DONUT_COLORS.failed} />
                <Cell fill={DONUT_COLORS.notAssessed} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stat dots grid */}
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-2 content-center">
          {statDots.map(s => (
            <div key={s.label} className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[12px] text-[#78716c] truncate">{s.label}</span>
              </div>
              <span className="text-[12px] font-semibold text-[#1c1d1f] tabular-nums shrink-0">{s.count}</span>
            </div>
          ))}
        </div>

        {/* Trend sparkline (if history) */}
        {scores.length >= 2 && (
          <div className="shrink-0 flex items-center">
            <ScoreTrend scores={scores} width={80} height={40} />
          </div>
        )}
      </div>

      {/* ── Footer: progress bar + link ── */}
      <div className="px-6 pb-5 flex items-center gap-4">
        <div className="flex-1 bg-[#f3f4f6] rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${total > 0 ? (report.summary.passed / total) * 100 : 0}%`,
              background: DONUT_COLORS.passed,
            }}
          />
        </div>
        <Link
          href={`/assess/${report.reportId}`}
          className="text-[12px] font-semibold text-[#1c1d1f] hover:text-[#505967] whitespace-nowrap flex items-center gap-1 transition-colors duration-300 hover:duration-50"
        >
          Full Report <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Key Findings (if present) ── */}
      {report.summary.topFindings?.length > 0 && (
        <div className="px-6 pb-5 border-t border-[#f5f5f4] pt-4">
          <p className="text-[10px] font-semibold text-[#78716c] uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[#f5a300]" />
            Key Findings
          </p>
          <ul className="space-y-1.5">
            {report.summary.topFindings.slice(0, 3).map((f, i) => (
              <li key={i} className="text-[12px] text-[#505967] flex items-start gap-2 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f25757] shrink-0 mt-[5px]" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const [loading,          setLoading]          = useState(true)
  const [reports,          setReports]          = useState<ReportMeta[]>([])
  const [hasClients,       setHasClients]       = useState<boolean | null>(null)
  const [firstClientName,  setFirstClientName]  = useState('')
  const [showEstimator,    setShowEstimator]    = useState(false)
  const [accountType,      setAccountType]      = useState<'org' | 'msp'>('org')
  const [userName,         setUserName]         = useState('')
  const [companyName,      setCompanyName]      = useState('')
  const [greeting,         setGreeting]         = useState('Good morning')

  useEffect(() => {
    // Grab display name from Supabase session (used for greeting)
    const supabase = createClientSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata
        const name = meta?.full_name ?? meta?.name ?? session.user.email?.split('@')[0] ?? ''
        setUserName(name)
      }
    })

    setGreeting(getTimeGreeting())

    // Safety timeout: if data loading takes more than 8s, clear spinner anyway
    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('[Dashboard] Loading timeout — forcing render with defaults')
        return false
      })
    }, 8_000)

    Promise.all([getReports(), getClients(), getProfile()])
      .then(([rpts, clients, profile]) => {
        setReports(rpts)
        setHasClients(clients.length > 0)
        setFirstClientName(clients[0]?.name ?? '')
        setAccountType(profile.accountType as 'org' | 'msp')
        setCompanyName(profile.companyName ?? '')
        if (profile.fullName) setUserName(profile.fullName)
      })
      .catch((err) => {
        console.error('[Dashboard] Data load error:', err)
        setReports([]); setHasClients(false)
      })
      .finally(() => { clearTimeout(timeout); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-[#e7e5e4] animate-pulse" />
          <span className="text-[13px] text-[#78716c]">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  // Group reports by framework, sort ascending by date
  const historyByFramework: Record<string, ReportMeta[]> = {}
  for (const r of reports) {
    if (!historyByFramework[r.frameworkId]) historyByFramework[r.frameworkId] = []
    historyByFramework[r.frameworkId].push(r)
  }
  for (const id of Object.keys(historyByFramework)) {
    historyByFramework[id].sort(
      (a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
    )
  }

  const latestReports = Object.values(historyByFramework).map(arr => arr[arr.length - 1])

  const totals = latestReports.reduce(
    (acc, r) => ({
      passed:      acc.passed      + r.summary.passed,
      failed:      acc.failed      + r.summary.failed,
      partial:     acc.partial     + r.summary.partial,
      notAssessed: acc.notAssessed + r.summary.notAssessed,
    }),
    { passed: 0, failed: 0, partial: 0, notAssessed: 0 }
  )

  const avgScore = latestReports.length > 0
    ? Math.round(latestReports.reduce((a, r) => a + r.summary.compliancePercentage, 0) / latestReports.length)
    : 0

  return (
    <div className="p-8 max-w-6xl space-y-8">

      {showEstimator && <StaffingEstimatorModal onClose={() => setShowEstimator(false)} />}

      {/* ── Page header ── */}
      {latestReports.length > 0 ? (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1c1917]">
              {greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-[#44403c] mt-1">
              {companyName ? `${companyName} compliance overview` : 'Overview of your compliance posture across all frameworks.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEstimator(true)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#1c1917]
                         bg-white hover:bg-[#fafaf9] px-4 py-2 rounded-lg border border-[#a8a29e]/20
                         transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Timeline Estimator
            </button>
            <Link
              href="/assess"
              className="inline-flex items-center gap-2 text-white text-xs font-semibold
                         bg-[#1c1917] hover:bg-[#0c0a09] px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              New Assessment
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1c1917]">
            {greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-[#78716c] font-medium text-base mt-1">
            Let{'\u2019'}s get your compliance monitoring set up.
          </p>
        </div>
      )}

      {latestReports.length === 0 ? (
        !hasClients
          ? (accountType === 'msp' ? <EmptyNoClients /> : <EmptyOrgNoTenant companyName={companyName} />)
          : (accountType === 'msp'
              ? <EmptyNoAssessments firstClientName={firstClientName} />
              : <EmptyOrgNoAssessments companyName={companyName} />)
      ) : (
        <>
          {/* ── KPI Summary Stats ── */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              label="Avg. Compliance (%)"
              value={`${avgScore}%`}
              accent
              progress={avgScore}
              sub={
                <span className="text-xs font-bold text-[#0c0a09] flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {latestReports.length} fw{latestReports.length !== 1 ? 's' : ''}
                </span>
              }
            />
            <StatCard
              label="Controls Passing"
              value={totals.passed.toLocaleString()}
              sub={`/ ${(totals.passed + totals.failed + totals.partial + totals.notAssessed).toLocaleString()}`}
              footer={
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i < 3 ? 'bg-[#1c1917]' : 'bg-[#a8a29e]/30'}`} />
                  ))}
                </div>
              }
            />
            <StatCard
              label="Controls Failing"
              value={totals.failed}
              danger
              sub={
                totals.partial > 0 ? (
                  <span className="text-xs font-bold text-[#9f403d] flex items-center gap-0.5">
                    +{totals.partial} partial
                  </span>
                ) : undefined
              }
              footer={
                <p className="text-[10px] text-[#44403c] font-medium italic">
                  Action required on {totals.failed} control{totals.failed !== 1 ? 's' : ''}
                </p>
              }
            />
            <StatCard
              label="Frameworks Assessed"
              value={String(latestReports.length).padStart(2, '0')}
              sub="Active Monitored"
              footer={
                <div className="flex -space-x-2">
                  {latestReports.slice(0, 3).map(r => (
                    <div key={r.frameworkId} className="w-6 h-6 rounded-full bg-[#e7e5e4] flex items-center justify-center text-[8px] font-bold border-2 border-[#fafaf9] text-[#1c1917]">
                      {r.frameworkId.slice(0, 3).toUpperCase()}
                    </div>
                  ))}
                  {latestReports.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-[#d6d3d1] flex items-center justify-center text-[8px] font-bold border-2 border-[#fafaf9] text-[#1c1917]">
                      +{latestReports.length - 3}
                    </div>
                  )}
                </div>
              }
            />
          </section>

          {/* ── Main Insights: Framework Posture + Drift (Asymmetric) ── */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Framework Posture (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1c1917] tracking-tight uppercase">Framework Posture</h3>
                <div className="flex gap-2">
                  <Link
                    href="/history"
                    className="px-3 py-1 bg-white text-[10px] font-bold uppercase tracking-wider border border-[#a8a29e]/20 rounded-lg hover:bg-[#fafaf9] transition-all text-[#1c1917]"
                  >
                    View History
                  </Link>
                  <Link
                    href="/assess"
                    className="px-3 py-1 bg-[#1c1917] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm"
                  >
                    New Assessment
                  </Link>
                </div>
              </div>

              {/* Framework cards */}
              <div className="space-y-4">
                {latestReports.map(report => (
                  <FrameworkCard
                    key={report.frameworkId}
                    report={report}
                    history={historyByFramework[report.frameworkId] ?? []}
                  />
                ))}
              </div>
            </div>

            {/* Configuration Drift + System Pulse (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <h3 className="text-sm font-bold text-[#1c1917] tracking-tight uppercase">Configuration Drift</h3>
              <DriftWidget />

              {/* System Pulse card */}
              <div className="bg-[#0c0a09] p-6 rounded-xl text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">System Pulse</span>
                </div>
                <p className="text-xs font-medium opacity-90 leading-relaxed mb-4">
                  All compliance scanners are active. Assessment engine ready.
                </p>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase font-bold opacity-70">Frameworks</p>
                    <p className="text-lg font-bold">{latestReports.length} Active</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] uppercase font-bold opacity-70">Status</p>
                    <p className="text-lg font-bold flex items-center gap-1.5 justify-end">
                      <span className="w-2 h-2 rounded-full bg-[#a8a29e] animate-pulse" />
                      Online
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      {latestReports.length === 0 && (
        <footer className="pt-8 pb-2 border-t border-[#e7e5e4]/40 flex justify-between text-[10px] text-[#a8a29e] uppercase tracking-[0.15em] font-bold">
          <span>© {new Date().getFullYear()} Atlas Compliance Automation</span>
          <span>Secure Platform v2.4.0</span>
        </footer>
      )}
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyNoClients() {
  return (
    <div className="space-y-12">
      {/* Step cards */}
      <section className="grid grid-cols-12 gap-6">
        {/* Step 1 — active */}
        <div className="col-span-12 lg:col-span-4 group cursor-pointer">
          <Link href="/clients" className="block bg-white p-8 h-full flex flex-col justify-between border-b-2 border-transparent hover:border-[#1c1917] transition-all duration-300 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1c1917]/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div>
              <div className="text-[#1c1917] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 01</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">Add your first client</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Connect a client&apos;s Microsoft 365 tenant using Azure App credentials to begin compliance monitoring.</p>
            </div>
            <span className="flex items-center gap-2 text-[#1c1917] font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Add Client <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
        {/* Step 2 — locked */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#fafaf9] p-8 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[#a8a29e] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 02</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">Run assessment</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Choose a compliance framework and run a full security assessment against your client&apos;s environment.</p>
            </div>
            <span className="flex items-center gap-2 text-[#a8a29e] font-semibold text-sm opacity-50 cursor-not-allowed">
              Select Framework <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
        {/* Step 3 — locked */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#fafaf9] p-8 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[#a8a29e] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 03</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">View results</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Review pass/fail/partial results, risk scores, key findings, and export audit-ready reports.</p>
            </div>
            <span className="flex items-center gap-2 text-[#a8a29e] font-semibold text-sm opacity-50 cursor-not-allowed">
              View Reports <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* Supported frameworks */}
      <section className="space-y-6">
        <div className="flex items-center gap-6">
          <h3 className="text-[10px] font-bold text-[#a8a29e] tracking-[0.15em] uppercase whitespace-nowrap">Supported Frameworks</h3>
          <div className="h-px flex-1 bg-[#e7e5e4]" />
        </div>
        <div className="flex flex-wrap gap-2.5">
          {FRAMEWORK_CATALOG.map(fw => (
            <div key={fw.id} className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wider flex items-center gap-2 ${
              fw.implemented
                ? 'bg-[#d6d3d1] text-[#1c1917] shadow-sm'
                : 'bg-[#fafaf9] text-[#a8a29e]'
            }`}>
              {fw.implemented
                ? <span className="w-1.5 h-1.5 rounded-full bg-[#1c1917]" />
                : <Lock className="w-2.5 h-2.5" />
              }
              {fw.name}
            </div>
          ))}
        </div>
      </section>

      {/* Promotional cards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="relative rounded-xl overflow-hidden h-64 bg-[#1c1d1f]">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1d1f] via-[#1c1d1f]/60 to-transparent p-8 flex flex-col justify-end">
            <h4 className="text-white font-bold text-lg mb-2">Automated Evidence Collection</h4>
            <p className="text-slate-300 text-xs leading-relaxed max-w-sm">Our engine automatically parses your Microsoft 365 logs to satisfy auditor requirements without manual screenshots.</p>
          </div>
        </div>
        <div className="bg-[#e7e5e4]/30 rounded-xl p-8 flex flex-col justify-center border-l-4 border-[#1c1917]">
          <ShieldCheck className="w-10 h-10 text-[#1c1917] mb-4" strokeWidth={1.5} />
          <h4 className="text-[#0c0a09] font-bold text-lg mb-2">Continuous Compliance</h4>
          <p className="text-[#0c0a09]/80 text-sm leading-relaxed">Atlas provides a continuous audit trail that meets the highest standards of federal and financial oversight.</p>
        </div>
      </section>
    </div>
  )
}

function EmptyNoAssessments({ firstClientName }: { firstClientName: string }) {
  return (
    <div className="space-y-12">
      {/* Success banner */}
      <div className="flex items-center gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-5 py-4">
        <div className="w-9 h-9 rounded-lg bg-[#0eb472]/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-[#0eb472]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#15803d]">
            {firstClientName ? `${firstClientName} connected` : 'Client connected'}
          </p>
          <p className="text-[12px] text-[#505967]">Ready for compliance assessment.</p>
        </div>
      </div>

      {/* Step cards */}
      <section className="grid grid-cols-12 gap-6">
        {/* Step 1 — done */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#f0fdf4]/50 p-8 h-full flex flex-col justify-between shadow-sm border border-[#bbf7d0]">
            <div>
              <div className="text-[#0eb472] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 01</div>
              <h3 className="text-xl font-bold text-[#0eb472] mb-3">Client added</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">{firstClientName || 'M365 tenant'} connected successfully.</p>
            </div>
            <span className="flex items-center gap-2 text-[#0eb472] font-semibold text-sm">
              Complete <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
        {/* Step 2 — active */}
        <div className="col-span-12 lg:col-span-4 group cursor-pointer">
          <Link href="/assess" className="block bg-white p-8 h-full flex flex-col justify-between border-b-2 border-transparent hover:border-[#1c1917] transition-all duration-300 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1c1917]/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div>
              <div className="text-[#1c1917] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 02</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">Run assessment</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Select a compliance framework and run a full security assessment.</p>
            </div>
            <span className="flex items-center gap-2 text-[#1c1917] font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Start Assessment <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
        {/* Step 3 — locked */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#fafaf9] p-8 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[#a8a29e] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 03</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">View results</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Review gaps and export audit-ready compliance reports.</p>
            </div>
            <span className="flex items-center gap-2 text-[#a8a29e] font-semibold text-sm opacity-50 cursor-not-allowed">
              View Reports <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Org-specific empty states ─────────────────────────────────────────────────

function EmptyOrgNoTenant({ companyName }: { companyName: string }) {
  return (
    <div className="space-y-12">
      {/* Step cards */}
      <section className="grid grid-cols-12 gap-6">
        {/* Step 1 — active */}
        <div className="col-span-12 lg:col-span-4 group cursor-pointer">
          <Link href="/connect" className="block bg-white p-8 h-full flex flex-col justify-between border-b-2 border-transparent hover:border-[#1c1917] transition-all duration-300 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1c1917]/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div>
              <div className="text-[#1c1917] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 01</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">Connect Microsoft 365</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Integrate your enterprise tenant to begin real-time data ingestion and baseline mapping.</p>
            </div>
            <span className="flex items-center gap-2 text-[#1c1917] font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Connect Tenant <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
        {/* Step 2 — locked */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#fafaf9] p-8 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[#a8a29e] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 02</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">Choose a framework</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Select the regulatory standards your organization must adhere to for automated cross-referencing.</p>
            </div>
            <span className="flex items-center gap-2 text-[#a8a29e] font-semibold text-sm opacity-50 cursor-not-allowed">
              Select Standards <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
        {/* Step 3 — locked */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#fafaf9] p-8 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[#a8a29e] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 03</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">View your posture</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Generate your first compliance report and identify immediate gaps in your security architecture.</p>
            </div>
            <span className="flex items-center gap-2 text-[#a8a29e] font-semibold text-sm opacity-50 cursor-not-allowed">
              Finalize Setup <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* Supported frameworks */}
      <section className="space-y-6">
        <div className="flex items-center gap-6">
          <h3 className="text-[10px] font-bold text-[#a8a29e] tracking-[0.15em] uppercase whitespace-nowrap">Supported Frameworks</h3>
          <div className="h-px flex-1 bg-[#e7e5e4]" />
        </div>
        <div className="flex flex-wrap gap-2.5">
          {FRAMEWORK_CATALOG.map(fw => (
            <div key={fw.id} className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wider flex items-center gap-2 ${
              fw.implemented
                ? 'bg-[#d6d3d1] text-[#1c1917] shadow-sm'
                : 'bg-[#fafaf9] text-[#a8a29e]'
            }`}>
              {fw.implemented
                ? <span className="w-1.5 h-1.5 rounded-full bg-[#1c1917]" />
                : <Lock className="w-2.5 h-2.5" />
              }
              {fw.name}
            </div>
          ))}
        </div>
      </section>

      {/* Promotional cards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="relative rounded-xl overflow-hidden h-64 bg-[#1c1d1f]">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1d1f] via-[#1c1d1f]/60 to-transparent p-8 flex flex-col justify-end">
            <h4 className="text-white font-bold text-lg mb-2">Automated Evidence Collection</h4>
            <p className="text-slate-300 text-xs leading-relaxed max-w-sm">Our engine automatically parses your Microsoft 365 logs to satisfy auditor requirements without manual screenshots.</p>
          </div>
        </div>
        <div className="bg-[#e7e5e4]/30 rounded-xl p-8 flex flex-col justify-center border-l-4 border-[#1c1917]">
          <ShieldCheck className="w-10 h-10 text-[#1c1917] mb-4" strokeWidth={1.5} />
          <h4 className="text-[#0c0a09] font-bold text-lg mb-2">Continuous Compliance</h4>
          <p className="text-[#0c0a09]/80 text-sm leading-relaxed">Atlas provides a continuous audit trail that meets the highest standards of federal and financial oversight.</p>
        </div>
      </section>
    </div>
  )
}

function EmptyOrgNoAssessments({ companyName }: { companyName: string }) {
  return (
    <div className="space-y-12">
      {/* Success banner */}
      <div className="flex items-center gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-5 py-4">
        <div className="w-9 h-9 rounded-lg bg-[#0eb472]/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-[#0eb472]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#15803d]">Microsoft 365 connected</p>
          <p className="text-[12px] text-[#505967]">
            {companyName ? `${companyName} is` : 'Your environment is'} ready for compliance assessment.
          </p>
        </div>
      </div>

      {/* Step cards */}
      <section className="grid grid-cols-12 gap-6">
        {/* Step 1 — done */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#f0fdf4]/50 p-8 h-full flex flex-col justify-between shadow-sm border border-[#bbf7d0]">
            <div>
              <div className="text-[#0eb472] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 01</div>
              <h3 className="text-xl font-bold text-[#0eb472] mb-3">M365 connected</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">{companyName || 'Microsoft 365'} tenant linked successfully.</p>
            </div>
            <span className="flex items-center gap-2 text-[#0eb472] font-semibold text-sm">
              Complete <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
        {/* Step 2 — active */}
        <div className="col-span-12 lg:col-span-4 group cursor-pointer">
          <Link href="/assess" className="block bg-white p-8 h-full flex flex-col justify-between border-b-2 border-transparent hover:border-[#1c1917] transition-all duration-300 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#1c1917]/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div>
              <div className="text-[#1c1917] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 02</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">Run assessment</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Select a compliance framework and get a full gap analysis in minutes.</p>
            </div>
            <span className="flex items-center gap-2 text-[#1c1917] font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Start Assessment <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
        {/* Step 3 — locked */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#fafaf9] p-8 h-full flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[#a8a29e] font-bold text-[10px] tracking-[0.2em] mb-6">STEP 03</div>
              <h3 className="text-xl font-bold text-[#1c1917] mb-3">View your posture</h3>
              <p className="text-[#44403c] text-sm leading-relaxed mb-6">Review gaps, risk scores, and export audit-ready reports.</p>
            </div>
            <span className="flex items-center gap-2 text-[#a8a29e] font-semibold text-sm opacity-50 cursor-not-allowed">
              Finalize Setup <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
