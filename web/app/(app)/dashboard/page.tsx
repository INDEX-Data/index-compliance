'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Clock, Play, AlertTriangle, ChevronRight,
  FileText, Building2, ArrowRight,
  TrendingUp, TrendingDown,
  ShieldCheck, ShieldX, Layers,
  CheckCircle2, XCircle, MinusCircle, HelpCircle,
  Activity, Users, X, ChevronDown,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getReports, getClients, getReportDrift } from '@/lib/api'
import type { DriftResult } from '@/lib/api'
import { ScoreTrend } from '@/components/ScoreTrend'
import { RiskBadge } from '@/components/RiskBadge'
import type { ReportMeta } from '@/lib/types'

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
      <div className="bg-white rounded-xl border border-[#e4e7ec] shadow-card p-5 flex items-center gap-3">
        <Activity className="w-4 h-4 text-[#a4adba] animate-pulse" />
        <span className="text-[12px] text-[#a4adba]">Checking for drift…</span>
      </div>
    )
  }

  if (!drift || !drift.hasDrift) {
    return (
      <div className="bg-white rounded-xl border border-[#e4e7ec] shadow-card p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[rgba(14,180,114,0.10)] flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-[#0eb472]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#1c1d1f]">No configuration drift</p>
          <p className="text-[11px] text-[#6f7988] mt-0.5">
            {drift?.message ?? 'Not enough reports to compare yet.'}
          </p>
        </div>
      </div>
    )
  }

  const deltaPos = (drift.scoreDelta ?? 0) >= 0
  const changed  = drift.changed ?? []

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] shadow-card overflow-hidden">
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
          <p className="text-[11px] text-[#6f7988] mt-0.5">
            {drift.improved ?? 0} improved · {drift.degraded ?? 0} degraded since last scan
            {drift.scoreDelta !== undefined && (
              <span className={`ml-2 font-semibold ${deltaPos ? 'text-[#0eb472]' : 'text-[#f25757]'}`}>
                {deltaPos ? '+' : ''}{drift.scoreDelta}% overall
              </span>
            )}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#a4adba] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded: changed controls list */}
      {expanded && changed.length > 0 && (
        <div className="border-t border-[#eeeff1] divide-y divide-[#f3f4f6]">
          {changed.slice(0, 10).map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                c.direction === 'improved' ? 'bg-[#0eb472]' : 'bg-[#f25757]'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#1c1d1f] truncate">{c.controlName}</p>
                <p className="text-[11px] text-[#6f7988]">
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
            <div className="px-5 py-3 text-[11px] text-[#a4adba]">
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
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#eeeff1]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(196,169,109,0.15)] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#C4A96D]" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[#1c1d1f]">Staffing & Timeline Estimator</h2>
              {!result && (
                <p className="text-[11px] text-[#6f7988]">
                  Question {step + 1} of {QUESTIONS.length}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[#a4adba] hover:text-[#505967] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        {!result && (
          <div className="h-0.5 bg-[#f3f4f6]">
            <div
              className="h-0.5 bg-[#C4A96D] transition-all duration-500"
              style={{ width: `${((step) / QUESTIONS.length) * 100}%` }}
            />
          </div>
        )}

        <div className="px-6 py-6">
          {result ? (
            /* Results */
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[rgba(196,169,109,0.15)] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-[#C4A96D]" />
                </div>
                <h3 className="text-[17px] font-bold text-[#1c1d1f] mb-1" style={{ letterSpacing: '-0.01em' }}>
                  Your CMMC Remediation Estimate
                </h3>
                <p className="text-[12px] text-[#6f7988]">Based on your inputs — for planning purposes only</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#fafafa] rounded-xl p-4 border border-[#e4e7ec] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a4adba] mb-1">Timeline</p>
                  <p className="text-[28px] font-bold text-[#1c1d1f] tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                    {result.weeks}
                  </p>
                  <p className="text-[11px] text-[#6f7988]">weeks to CMMC-ready</p>
                </div>
                <div className="bg-[#fafafa] rounded-xl p-4 border border-[#e4e7ec] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a4adba] mb-1">Staffing</p>
                  <p className="text-[28px] font-bold text-[#1c1d1f] tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                    {result.fte}
                  </p>
                  <p className="text-[11px] text-[#6f7988]">FTE equiv. needed</p>
                </div>
              </div>

              <div className="bg-[rgba(196,169,109,0.08)] border border-[rgba(196,169,109,0.3)] rounded-xl p-4 text-[12px] text-[#505967] leading-relaxed">
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
                  className="flex-1 text-[13px] font-medium text-[#505967] bg-[#f3f4f6] hover:bg-[#e9ebee] px-4 py-2.5 rounded-lg transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 text-[13px] font-medium text-white px-4 py-2.5 rounded-lg transition-colors"
                  style={{ background: '#202124' }}
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
                    className="w-full text-left px-4 py-3 rounded-lg border border-[#e4e7ec] text-[13px] text-[#1c1d1f] hover:border-[#C4A96D] hover:bg-[rgba(196,169,109,0.04)] transition-all duration-150"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="text-[12px] text-[#a4adba] hover:text-[#6f7988] transition-colors"
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
  notAssessed: '#a4adba',
}

// ─── Stat Card — horizontal layout (Lovable style) ───────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  sub?: string
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] p-5 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
          style={{ background: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a4adba]">{label}</p>
          <p className="text-[26px] font-bold text-[#1c1d1f] tabular-nums leading-tight" style={{ letterSpacing: '-0.02em' }}>
            {value}
          </p>
          {sub && <p className="text-[11px] text-[#6f7988] mt-0.5">{sub}</p>}
        </div>
      </div>
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
    <div className="bg-white rounded-xl border border-[#e4e7ec] shadow-card hover:shadow-card-hover transition-shadow">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-[#eeeff1]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold text-[#1c1d1f]" style={{ letterSpacing: '-0.01em' }}>
              {report.frameworkName}
            </h3>
            <RiskBadge score={report.summary.riskScore} />
          </div>
          <p className="text-[12px] text-[#6f7988] mt-1">
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
                <span className="text-[12px] text-[#6f7988] truncate">{s.label}</span>
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
        <div className="px-6 pb-5 border-t border-[#eeeff1] pt-4">
          <p className="text-[10px] font-semibold text-[#6f7988] uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
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

export default function DashboardPage() {
  const [loading,          setLoading]          = useState(true)
  const [reports,          setReports]          = useState<ReportMeta[]>([])
  const [hasClients,       setHasClients]       = useState<boolean | null>(null)
  const [firstClientName,  setFirstClientName]  = useState('')
  const [showEstimator,    setShowEstimator]    = useState(false)

  useEffect(() => {
    Promise.all([getReports(), getClients()])
      .then(([rpts, clients]) => {
        setReports(rpts)
        setHasClients(clients.length > 0)
        setFirstClientName(clients[0]?.name ?? '')
      })
      .catch(() => { setReports([]); setHasClients(false) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-[#e4e7ec] animate-pulse" />
          <span className="text-[13px] text-[#6f7988]">Loading dashboard…</span>
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
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {showEstimator && <StaffingEstimatorModal onClose={() => setShowEstimator(false)} />}

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1c1d1f]" style={{ letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
          <p className="text-[13px] text-[#6f7988] mt-1">
            Overview of your compliance posture across all frameworks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEstimator(true)}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#505967]
                       bg-white hover:bg-[#fafafa] px-4 py-2 rounded-[10px] border border-[#e4e7ec]
                       transition-colors shadow-card"
          >
            <Users className="w-3.5 h-3.5" />
            Timeline Estimator
          </button>
          <Link
            href="/assess"
            className="inline-flex items-center gap-2 text-[#f3f4f6] text-[13px] font-medium
                       px-4 py-2 rounded-[10px] transition-colors duration-300 hover:duration-50"
            style={{ background: '#202124', border: '0.667px solid rgba(80,89,103,0.4)' }}
          >
            <Play className="w-3.5 h-3.5" />
            New Assessment
          </Link>
        </div>
      </div>

      {latestReports.length === 0 ? (
        !hasClients ? <EmptyNoClients /> : <EmptyNoAssessments firstClientName={firstClientName} />
      ) : (
        <>
          {/* ── KPI stats (Lovable horizontal card layout) ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Avg. Compliance"
              value={`${avgScore}%`}
              icon={ShieldCheck}
              iconColor="#0eb472"
              iconBg="rgba(14,180,114,0.10)"
              sub={`${latestReports.length} framework${latestReports.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Controls Passing"
              value={totals.passed}
              icon={TrendingUp}
              iconColor="#0eb472"
              iconBg="rgba(14,180,114,0.10)"
              sub="across all frameworks"
            />
            <StatCard
              label="Controls Failing"
              value={totals.failed}
              icon={ShieldX}
              iconColor="#f25757"
              iconBg="rgba(242,87,87,0.10)"
              sub={totals.partial > 0 ? `+${totals.partial} partial` : undefined}
            />
            <StatCard
              label="Frameworks Assessed"
              value={latestReports.length}
              icon={Layers}
              iconColor="#266df0"
              iconBg="rgba(38,109,240,0.10)"
            />
          </div>

          {/* ── Configuration drift ── */}
          <div>
            <h2 className="text-[13px] font-semibold text-[#1c1d1f] flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-[#6f7988]" />
              Configuration Drift
            </h2>
            <DriftWidget />
          </div>

          {/* ── Framework posture ── */}
          <div>
            <h2 className="text-[13px] font-semibold text-[#1c1d1f] flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-[#6f7988]" />
              Framework Posture
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {latestReports.map(report => (
                <FrameworkCard
                  key={report.frameworkId}
                  report={report}
                  history={historyByFramework[report.frameworkId] ?? []}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyNoClients() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#e4e7ec] flex items-center justify-center mb-5 shadow-card">
        <Building2 className="w-6 h-6 text-[#cad0d9]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#1c1d1f] mb-2">Add your first client</h3>
      <p className="text-[13px] text-[#505967] max-w-sm mb-8 leading-relaxed">
        Connect a Microsoft 365 tenant to start running compliance assessments.
      </p>
      <div className="flex items-center gap-3 mb-8 flex-wrap justify-center">
        {[
          { n: '1', label: 'Add client',    active: true,  time: '~2 min' },
          { n: '2', label: 'Run assessment', active: false, time: '~5 min' },
          { n: '3', label: 'View results',   active: false, time: '' },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold border ${
                s.active ? 'bg-[#1c1d1f] text-white border-transparent' : 'bg-white text-[#6f7988] border-[#e4e7ec]'
              }`}>
                <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  s.active ? 'bg-[#C4A96D] text-[#1c1d1f]' : 'bg-[#e4e7ec] text-[#6f7988]'
                }`}>{s.n}</span>
                {s.label}
              </div>
              {s.time && <span className="text-[10px] text-[#a4adba]">{s.time}</span>}
            </div>
            {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-[#cad0d9] mb-4 shrink-0" />}
          </div>
        ))}
      </div>
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-[#f3f4f6] text-[13px] font-medium px-5 py-2.5 rounded-[10px]"
        style={{ background: '#202124', border: '0.667px solid rgba(80,89,103,0.4)' }}
      >
        <Building2 className="w-3.5 h-3.5" />
        Add First Client
      </Link>
    </div>
  )
}

function EmptyNoAssessments({ firstClientName }: { firstClientName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#e4e7ec] flex items-center justify-center mb-5 shadow-card">
        <Shield className="w-6 h-6 text-[#cad0d9]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#1c1d1f] mb-2">Run your first assessment</h3>
      <p className="text-[13px] text-[#505967] max-w-sm mb-8 leading-relaxed">
        {firstClientName
          ? <><strong className="text-[#1c1d1f]">{firstClientName}</strong> is connected. Choose a framework and run a compliance assessment.</>
          : <>Your client is connected. Choose a framework and run your first assessment.</>
        }
      </p>
      <div className="flex items-center gap-3 mb-8 flex-wrap justify-center">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium border bg-[#f0fdf4] text-[#0eb472] border-[#bbf7d0]">
          <span className="w-4 h-4 rounded-full bg-[#0eb472] text-white text-[10px] font-bold flex items-center justify-center shrink-0">✓</span>
          {firstClientName || 'Client added'}
        </div>
        <ArrowRight className="w-4 h-4 text-[#cad0d9] mb-4 shrink-0" />
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold border bg-[#1c1d1f] text-white border-transparent">
            <span className="w-4 h-4 rounded-full bg-[#C4A96D] text-[#1c1d1f] text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            Run assessment
          </div>
          <span className="text-[10px] text-[#a4adba]">~5 min</span>
        </div>
        <ArrowRight className="w-4 h-4 text-[#cad0d9] mb-4 shrink-0" />
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium border bg-white text-[#6f7988] border-[#e4e7ec]">
          <span className="w-4 h-4 rounded-full bg-[#e4e7ec] text-[#6f7988] text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
          View results
        </div>
      </div>
      <Link
        href="/assess"
        className="inline-flex items-center gap-2 text-[#f3f4f6] text-[13px] font-medium px-5 py-2.5 rounded-[10px]"
        style={{ background: '#202124', border: '0.667px solid rgba(80,89,103,0.4)' }}
      >
        <Play className="w-3.5 h-3.5" />
        Run First Assessment
      </Link>
    </div>
  )
}
