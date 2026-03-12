'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Clock, Play, AlertTriangle, ChevronRight,
  FileText, Building2, ArrowRight,
} from 'lucide-react'
import { getReports, getClients } from '@/lib/api'
import { ComplianceDonut } from '@/components/ComplianceDonut'
import { RiskBadge } from '@/components/RiskBadge'
import { ScoreTrend } from '@/components/ScoreTrend'
import type { ReportMeta } from '@/lib/types'

export default function DashboardPage() {
  const [loading, setLoading]           = useState(true)
  const [reports, setReports]           = useState<ReportMeta[]>([])
  const [hasClients, setHasClients]     = useState<boolean | null>(null)
  const [firstClientName, setFirstClientName] = useState<string>('')

  useEffect(() => {
    Promise.all([getReports(), getClients()])
      .then(([rpts, clients]) => {
        setReports(rpts)
        setHasClients(clients.length > 0)
        setFirstClientName(clients[0]?.name ?? '')
      })
      .catch(() => {
        setReports([])
        setHasClients(false)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-[#D4CFC5] animate-pulse" />
          <span className="text-sm text-[#9CA3AF]">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  // Latest report per framework + sorted history per framework
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

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#18181B] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#6B7280] mt-1">Compliance posture across all clients</p>
        </div>
        <Link
          href="/assess"
          className="inline-flex items-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Play className="w-3.5 h-3.5" />
          New Assessment
        </Link>
      </div>

      {latestReports.length === 0 ? (
        /* ── Empty state ── */
        !hasClients ? (
          /* Step 1: no clients yet */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#E9E5DD] flex items-center justify-center mb-5 shadow-card">
              <Building2 className="w-7 h-7 text-[#D4CFC5]" />
            </div>
            <h3 className="text-base font-semibold text-[#18181B] mb-2">Add your first client</h3>
            <p className="text-sm text-[#6B7280] max-w-sm mb-8 leading-relaxed">
              Connect a Microsoft 365 tenant to start running compliance assessments.
            </p>

            {/* Onboarding steps */}
            <div className="flex items-center gap-3 mb-8 text-sm flex-wrap justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-[#18181B] text-white px-3.5 py-2 rounded-lg font-semibold">
                  <span className="w-4 h-4 rounded-full bg-[#C4A96D] text-[#18181B] text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  Add client
                </div>
                <span className="text-[10px] text-[#9CA3AF]">~2 min</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#D4CFC5] mb-4" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-[#F7F5F1] text-[#9CA3AF] px-3.5 py-2 rounded-lg font-medium border border-[#E9E5DD]">
                  <span className="w-4 h-4 rounded-full bg-[#E9E5DD] text-[#9CA3AF] text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  Run assessment
                </div>
                <span className="text-[10px] text-[#C4BFB5]">~5 min</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#D4CFC5] mb-4" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-[#F7F5F1] text-[#9CA3AF] px-3.5 py-2 rounded-lg font-medium border border-[#E9E5DD]">
                  <span className="w-4 h-4 rounded-full bg-[#E9E5DD] text-[#9CA3AF] text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  View results
                </div>
                <span className="text-[10px] text-[#C4BFB5]">&nbsp;</span>
              </div>
            </div>

            <Link
              href="/clients"
              className="inline-flex items-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              <Building2 className="w-3.5 h-3.5" />
              Add First Client
            </Link>
          </div>
        ) : (
          /* Step 2: has clients, no assessments yet */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#E9E5DD] flex items-center justify-center mb-5 shadow-card">
              <Shield className="w-7 h-7 text-[#D4CFC5]" />
            </div>
            <h3 className="text-base font-semibold text-[#18181B] mb-2">Run your first assessment</h3>
            <p className="text-sm text-[#6B7280] max-w-sm mb-8 leading-relaxed">
              {firstClientName ? (
                <><strong className="text-[#374151]">{firstClientName}</strong> is connected. Choose a framework and run a compliance assessment.</>
              ) : (
                <>Your client is connected. Choose a framework and run your first compliance assessment.</>
              )}
            </p>

            <div className="flex items-center gap-3 mb-8 text-sm flex-wrap justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-[#F0FDF4] text-[#15803D] px-3.5 py-2 rounded-lg font-medium border border-[#BBF7D0]">
                  <span className="w-4 h-4 rounded-full bg-[#15803D] text-white text-[10px] font-bold flex items-center justify-center shrink-0">✓</span>
                  {firstClientName || 'Client added'}
                </div>
                <span className="text-[10px] text-[#9CA3AF]">&nbsp;</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#D4CFC5] mb-4" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-[#18181B] text-white px-3.5 py-2 rounded-lg font-semibold">
                  <span className="w-4 h-4 rounded-full bg-[#C4A96D] text-[#18181B] text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  Run assessment
                </div>
                <span className="text-[10px] text-[#9CA3AF]">~5 min</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#D4CFC5] mb-4" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-[#F7F5F1] text-[#9CA3AF] px-3.5 py-2 rounded-lg font-medium border border-[#E9E5DD]">
                  <span className="w-4 h-4 rounded-full bg-[#E9E5DD] text-[#9CA3AF] text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  View results
                </div>
                <span className="text-[10px] text-[#C4BFB5]">&nbsp;</span>
              </div>
            </div>

            <Link
              href="/assess"
              className="inline-flex items-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              <Play className="w-3.5 h-3.5" />
              Run First Assessment
            </Link>
          </div>
        )
      ) : (
        <>
          {/* Cross-framework summary row */}
          {latestReports.length > 1 && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Passed',       value: totals.passed,      color: '#15803D', bg: '#DCFCE7' },
                { label: 'Partial',      value: totals.partial,     color: '#B45309', bg: '#FEF3C7' },
                { label: 'Failed',       value: totals.failed,      color: '#B91C1C', bg: '#FEE2E2' },
                { label: 'Not Assessed', value: totals.notAssessed, color: '#9CA3AF', bg: '#F3F4F6' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-[#E9E5DD] p-4 shadow-card">
                  <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] text-[#9CA3AF] mt-0.5 font-medium">{s.label}</div>
                  <div className="text-[10px] text-[#C4BFB5] mt-1">across all frameworks</div>
                </div>
              ))}
            </div>
          )}

          {/* Framework cards */}
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

interface FrameworkCardProps {
  report:  ReportMeta
  history: ReportMeta[]
}

function FrameworkCard({ report, history }: FrameworkCardProps) {
  const ago = timeAgo(report.generatedAt)
  const pct = report.summary.compliancePercentage
  const scoreColor = pct >= 90 ? '#15803D' : pct >= 70 ? '#B45309' : '#B91C1C'
  const scores = history.map(r => r.summary.compliancePercentage)
  const runCount = history.length

  return (
    <div className="bg-white rounded-xl border border-[#E9E5DD] overflow-hidden shadow-card hover:shadow-card-hover transition-shadow">

      {/* Header */}
      <div className="px-6 py-4 border-b border-[#F0EDE6] flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#18181B]">{report.frameworkName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
              <Clock className="w-3 h-3" /> {ago}
            </span>
            {runCount > 1 && (
              <span className="text-[11px] text-[#C4BFB5]">{runCount} runs</span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-[#D4CFC5] font-mono">
              <FileText className="w-3 h-3" /> {report.reportId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge score={report.summary.riskScore} />
          <Link
            href={`/assess/${report.reportId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#18181B] hover:text-[#27272A] transition"
          >
            Full report <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Score + trend */}
        <div className="flex flex-col items-center justify-center bg-[#F7F5F1] rounded-xl p-5 gap-2">
          <div className="tabular-nums font-bold leading-none" style={{ fontSize: 48, color: scoreColor }}>
            {pct}
            <span className="text-2xl text-[#D4CFC5] font-medium">%</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Compliance Score</p>
          <div className="mt-2 w-full max-w-[140px] bg-[#E9E5DD] rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: scoreColor }} />
          </div>
          {scores.length >= 2 && (
            <div className="mt-3 pt-3 border-t border-[#E9E5DD] w-full flex flex-col items-center gap-2">
              <ScoreTrend scores={scores} width={110} height={32} />
              <p className="text-[10px] text-[#C4BFB5]">{scores.length} assessments</p>
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="lg:col-span-1">
          <ComplianceDonut summary={report.summary} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 content-start">
          {[
            { label: 'Passed',       value: report.summary.passed,      bar: '#15803D' },
            { label: 'Partial',      value: report.summary.partial,     bar: '#B45309' },
            { label: 'Failed',       value: report.summary.failed,      bar: '#B91C1C' },
            { label: 'Not Assessed', value: report.summary.notAssessed, bar: '#D1D5DB' },
          ].map(s => (
            <div key={s.label} className="relative bg-[#F7F5F1] rounded-lg p-3 overflow-hidden">
              <div className="text-2xl font-bold text-[#18181B] tabular-nums">{s.value}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">{s.label}</div>
              <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-lg" style={{ background: s.bar, opacity: 0.7 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Findings */}
      {report.summary.topFindings.length > 0 && (
        <div className="px-6 pb-5 border-t border-[#F0EDE6] pt-4">
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[#B45309]" /> Key Findings
          </p>
          <ul className="space-y-1.5">
            {report.summary.topFindings.slice(0, 3).map((f, i) => (
              <li key={i} className="text-xs text-[#6B7280] flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-[#B91C1C] shrink-0 mt-1.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
