'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Clock, Play, AlertTriangle, ChevronRight,
  FileText, Building2, ArrowRight,
  TrendingUp, TrendingDown,
  ShieldCheck, ShieldX, Layers,
  CheckCircle2, XCircle, MinusCircle, HelpCircle,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getReports, getClients } from '@/lib/api'
import { ScoreTrend } from '@/components/ScoreTrend'
import { RiskBadge } from '@/components/RiskBadge'
import type { ReportMeta } from '@/lib/types'

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
