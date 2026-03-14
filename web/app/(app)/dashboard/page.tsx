'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Clock, Play, AlertTriangle, ChevronRight,
  FileText, Building2, ArrowRight, TrendingUp,
  CheckCircle2, XCircle, MinusCircle, HelpCircle,
} from 'lucide-react'
import { getReports, getClients } from '@/lib/api'
import { ComplianceDonut } from '@/components/ComplianceDonut'
import { RiskBadge } from '@/components/RiskBadge'
import { ScoreTrend } from '@/components/ScoreTrend'
import type { ReportMeta } from '@/lib/types'

// ─── Stat Card ────────────────────────────────────────────────────────────────

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
    <div className="bg-white rounded-xl border border-[#e4e7ec] p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon className="w-[15px] h-[15px]" style={{ color: iconColor }} />
        </div>
      </div>
      <div className="text-[28px] font-bold text-[#1c1d1f] tabular-nums leading-none tracking-tight">
        {value}
      </div>
      <div className="text-[12px] font-medium text-[#6f7988] mt-2">{label}</div>
      {sub && <div className="text-[11px] text-[#a4adba] mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Framework Card ───────────────────────────────────────────────────────────

interface FrameworkCardProps {
  report:  ReportMeta
  history: ReportMeta[]
}

function FrameworkCard({ report, history }: FrameworkCardProps) {
  const ago       = timeAgo(report.generatedAt)
  const pct       = report.summary.compliancePercentage
  const scores    = history.map(r => r.summary.compliancePercentage)
  const runCount  = history.length
  const prevScore = scores.length >= 2 ? scores[scores.length - 2] : null
  const delta     = prevScore !== null ? pct - prevScore : null

  const scoreColor =
    pct >= 90 ? '#16A34A' :
    pct >= 70 ? '#D97706' :
    '#DC2626'

  const scoreBg =
    pct >= 90 ? '#F0FDF4' :
    pct >= 70 ? '#FFFBEB' :
    '#FEF2F2'

  const controls = [
    { label: 'Passed',       value: report.summary.passed,       icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
    { label: 'Partial',      value: report.summary.partial,      icon: MinusCircle,  color: '#D97706', bg: '#FFFBEB' },
    { label: 'Failed',       value: report.summary.failed,       icon: XCircle,      color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Not Assessed', value: report.summary.notAssessed,  icon: HelpCircle,   color: '#6f7988', bg: '#F3F4F6' },
  ]

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden shadow-card hover:shadow-card-hover transition-shadow">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#eeeff1]">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">{report.frameworkName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-[#6f7988]">
              <Clock className="w-3 h-3" />
              {ago}
            </span>
            {runCount > 1 && (
              <span className="text-[11px] text-[#a4adba]">{runCount} runs</span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-[#cad0d9] font-mono">
              <FileText className="w-3 h-3" />
              {report.reportId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge score={report.summary.riskScore} />
          <Link
            href={`/assess/${report.reportId}`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1c1d1f] hover:text-[#1c1d1f] transition"
          >
            Full report <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Score panel */}
        <div
          className="flex flex-col items-center justify-center rounded-xl p-5 gap-1"
          style={{ background: scoreBg }}
        >
          <div
            className="tabular-nums font-bold leading-none tracking-tight"
            style={{ fontSize: 52, color: scoreColor }}
          >
            {pct}
            <span className="text-2xl font-medium" style={{ color: scoreColor, opacity: 0.5 }}>%</span>
          </div>
          <p className="text-[11px] font-medium mt-1" style={{ color: scoreColor, opacity: 0.7 }}>
            Compliance Score
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-[120px] bg-white/60 rounded-full h-1.5 mt-3">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%`, background: scoreColor }}
            />
          </div>

          {/* Delta indicator */}
          {delta !== null && (
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/40 w-full justify-center">
              <TrendingUp className="w-3 h-3" style={{ color: delta >= 0 ? '#16A34A' : '#DC2626' }} />
              <span className="text-[11px] font-semibold" style={{ color: delta >= 0 ? '#16A34A' : '#DC2626' }}>
                {delta >= 0 ? '+' : ''}{delta}% from last run
              </span>
            </div>
          )}

          {/* Trend sparkline */}
          {scores.length >= 2 && (
            <div className="mt-2">
              <ScoreTrend scores={scores} width={100} height={28} />
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="flex items-center justify-center">
          <ComplianceDonut summary={report.summary} />
        </div>

        {/* Control stats */}
        <div className="grid grid-cols-2 gap-2.5 content-start">
          {controls.map(s => (
            <div key={s.label} className="rounded-lg p-3 border" style={{ background: s.bg, borderColor: s.bg }}>
              <div className="flex items-center gap-1.5 mb-2">
                <s.icon className="w-3.5 h-3.5 shrink-0" style={{ color: s.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>
                  {s.label}
                </span>
              </div>
              <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key Findings ── */}
      {report.summary.topFindings.length > 0 && (
        <div className="px-6 pb-5 border-t border-[#eeeff1] pt-4">
          <p className="text-[10px] font-semibold text-[#6f7988] uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[#D97706]" />
            Key Findings
          </p>
          <ul className="space-y-1.5">
            {report.summary.topFindings.slice(0, 3).map((f, i) => (
              <li key={i} className="text-[12px] text-[#505967] flex items-start gap-2 leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-[#DC2626] shrink-0 mt-[6px]" />
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
  const [loading, setLoading]                 = useState(true)
  const [reports, setReports]                 = useState<ReportMeta[]>([])
  const [hasClients, setHasClients]           = useState<boolean | null>(null)
  const [firstClientName, setFirstClientName] = useState<string>('')

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
          <Shield className="w-8 h-8 text-[#cad0d9] animate-pulse" />
          <span className="text-[13px] text-[#6f7988]">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  // Group reports by framework, sorted ascending by date
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
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#1c1d1f] tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-[#6f7988] mt-1">Compliance posture across all clients</p>
        </div>
        <Link
          href="/assess"
          className="inline-flex items-center gap-2 bg-[#1c1d1f] hover:bg-[#1c1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          New Assessment
        </Link>
      </div>

      {latestReports.length === 0 ? (
        /* ── Empty states ── */
        !hasClients ? (
          <EmptyNoClients />
        ) : (
          <EmptyNoAssessments firstClientName={firstClientName} />
        )
      ) : (
        <>
          {/* ── KPI stat row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatCard
              label="Avg. Compliance"
              value={`${avgScore}%`}
              icon={Shield}
              iconColor="#6366F1"
              iconBg="#EEF2FF"
              sub={`${latestReports.length} framework${latestReports.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Controls Passing"
              value={totals.passed}
              icon={CheckCircle2}
              iconColor="#16A34A"
              iconBg="#F0FDF4"
              sub="across all frameworks"
            />
            <StatCard
              label="Controls Failing"
              value={totals.failed}
              icon={XCircle}
              iconColor="#DC2626"
              iconBg="#FEF2F2"
              sub={totals.partial > 0 ? `+${totals.partial} partial` : undefined}
            />
            <StatCard
              label="Frameworks"
              value={latestReports.length}
              icon={FileText}
              iconColor="#D97706"
              iconBg="#FFFBEB"
              sub="assessed"
            />
          </div>

          {/* ── Framework cards ── */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-[#1c1d1f]">Framework Posture</h2>
            <Link
              href="/history"
              className="text-[12px] text-[#6f7988] hover:text-[#1c1d1f] font-medium transition flex items-center gap-1"
            >
              View history <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-5">
            {latestReports.map(report => (
              <FrameworkCard
                key={report.frameworkId}
                report={report}
                history={historyByFramework[report.frameworkId] ?? []}
              />
            ))}
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

      <div className="flex items-center gap-3 mb-8 text-[13px] flex-wrap justify-center">
        {[
          { step: '1', label: 'Add client',       active: true,  done: false, time: '~2 min' },
          { step: '2', label: 'Run assessment',    active: false, done: false, time: '~5 min' },
          { step: '3', label: 'View results',      active: false, done: false, time: '' },
        ].map((s, i, arr) => (
          <>
            <div key={s.step} className="flex flex-col items-center gap-1">
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold border ${
                s.active
                  ? 'bg-[#1c1d1f] text-white border-transparent'
                  : 'bg-white text-[#6f7988] border-[#e4e7ec]'
              }`}>
                <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  s.active ? 'bg-[#C4A96D] text-[#1c1d1f]' : 'bg-[#e4e7ec] text-[#6f7988]'
                }`}>{s.step}</span>
                {s.label}
              </div>
              {s.time && <span className="text-[10px] text-[#6f7988]">{s.time}</span>}
            </div>
            {i < arr.length - 1 && (
              <ArrowRight key={`arrow-${i}`} className="w-4 h-4 text-[#cad0d9] mb-4 shrink-0" />
            )}
          </>
        ))}
      </div>

      <Link
        href="/clients"
        className="inline-flex items-center gap-2 bg-[#1c1d1f] hover:bg-[#1c1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
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
          : <>Your client is connected. Choose a framework and run your first compliance assessment.</>
        }
      </p>

      <div className="flex items-center gap-3 mb-8 text-[13px] flex-wrap justify-center">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium border bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]">
            <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white text-[10px] font-bold flex items-center justify-center shrink-0">✓</span>
            {firstClientName || 'Client added'}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[#cad0d9] mb-4 shrink-0" />
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold border bg-[#1c1d1f] text-white border-transparent">
            <span className="w-4 h-4 rounded-full bg-[#C4A96D] text-[#1c1d1f] text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            Run assessment
          </div>
          <span className="text-[10px] text-[#6f7988]">~5 min</span>
        </div>
        <ArrowRight className="w-4 h-4 text-[#cad0d9] mb-4 shrink-0" />
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium border bg-white text-[#6f7988] border-[#e4e7ec]">
            <span className="w-4 h-4 rounded-full bg-[#e4e7ec] text-[#6f7988] text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            View results
          </div>
        </div>
      </div>

      <Link
        href="/assess"
        className="inline-flex items-center gap-2 bg-[#1c1d1f] hover:bg-[#1c1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        <Play className="w-3.5 h-3.5" />
        Run First Assessment
      </Link>
    </div>
  )
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
