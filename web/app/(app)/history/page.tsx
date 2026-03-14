'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Trash2, ChevronRight, Calendar, Shield, Loader2, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getReports, deleteReport } from '@/lib/api'
import { RiskBadge } from '@/components/RiskBadge'
import type { ReportMeta } from '@/lib/types'

export default function HistoryPage() {
  const router = useRouter()
  const [reports, setReports]   = useState<ReportMeta[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    getReports().then(setReports).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeleting(id)
    try {
      await deleteReport(id)
      setReports(r => r.filter(x => x.reportId !== id))
    } finally {
      setDeleting(null)
    }
  }

  function scoreColor(pct: number) {
    return pct >= 90 ? '#15803D' : pct >= 70 ? '#B45309' : '#B91C1C'
  }

  // Group by framework, sorted newest-first within each group
  // Groups ordered by most-recent run date
  const grouped: Record<string, ReportMeta[]> = {}
  for (const r of reports) {
    if (!grouped[r.frameworkId]) grouped[r.frameworkId] = []
    grouped[r.frameworkId].push(r)
  }
  // Sort each framework newest-first
  for (const id of Object.keys(grouped)) {
    grouped[id].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
  }
  // Sort groups by most recent run
  const frameworkIds = Object.keys(grouped).sort(
    (a, b) => new Date(grouped[b][0].generatedAt).getTime() - new Date(grouped[a][0].generatedAt).getTime()
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#0A0A0A] tracking-tight">Report History</h1>
          <p className="text-sm text-[#555555] mt-1">
            {reports.length > 0 ? `${reports.length} report${reports.length !== 1 ? 's' : ''} across ${frameworkIds.length} framework${frameworkIds.length !== 1 ? 's' : ''}` : 'All saved compliance assessment reports'}
          </p>
        </div>
        <Link
          href="/assess"
          className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#111111] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Play className="w-3.5 h-3.5" />
          New Assessment
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-[#999999]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading reports…</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8E8E8] flex items-center justify-center mb-5 shadow-card">
            <FileText className="w-7 h-7 text-[#D4D4D4]" />
          </div>
          <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">No reports yet</h3>
          <p className="text-sm text-[#555555] max-w-sm mb-7 leading-relaxed">
            Run an assessment to generate your first compliance report.
          </p>
          <Link
            href="/assess"
            className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#111111] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Play className="w-3.5 h-3.5" />
            Run Assessment
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {frameworkIds.map(fwId => {
            const rows = grouped[fwId]
            return (
              <div key={fwId} className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden shadow-card">
                {/* Framework group header */}
                <div className="px-5 py-3 bg-[#FAFAFA] border-b border-[#F3F3F3] flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-[#E8E8E8] flex items-center justify-center shrink-0">
                    <Shield className="w-3.5 h-3.5 text-[#999999]" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[13px] font-bold text-[#0A0A0A]">{rows[0].frameworkName}</span>
                  </div>
                  <span className="text-[11px] text-[#BBBBBB]">
                    {rows.length} run{rows.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F3F3F3]">
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#999999] uppercase tracking-widest">Date</th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#999999] uppercase tracking-widest">Score</th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#999999] uppercase tracking-widest">Δ vs prev</th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#999999] uppercase tracking-widest">Risk</th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#999999] uppercase tracking-widest">Controls</th>
                      <th className="text-right px-5 py-3 text-[10px] font-semibold text-[#999999] uppercase tracking-widest" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F3F3]">
                    {rows.map((r, idx) => {
                      const pct      = r.summary.compliancePercentage
                      const color    = scoreColor(pct)
                      // "prev" is the next item in this sorted-newest-first array
                      const prevPct  = idx < rows.length - 1 ? rows[idx + 1].summary.compliancePercentage : null
                      const delta    = prevPct !== null ? pct - prevPct : null
                      const isLatest = idx === 0

                      return (
                        <tr
                          key={r.reportId}
                          className="hover:bg-[#FAFAFA] transition cursor-pointer"
                          onClick={() => router.push(`/assess/${r.reportId}`)}
                        >
                          {/* Date */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              {isLatest && (
                                <span className="inline-block text-[9px] font-bold text-[#15803D] bg-[#DCFCE7] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                  Latest
                                </span>
                              )}
                              <div>
                                <div className="text-[12px] text-[#1A1A1A] flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-[#BBBBBB]" />
                                  {new Date(r.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="text-[10px] text-[#BBBBBB] mt-0.5 ml-4.5">
                                  {new Date(r.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-[9px] text-[#D4D4D4] font-mono mt-0.5">{r.reportId}</div>
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-[#F3F3F3] rounded-full h-1.5">
                                <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                              </div>
                              <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
                            </div>
                          </td>

                          {/* Delta vs previous */}
                          <td className="px-5 py-3.5">
                            <DeltaCell delta={delta} />
                          </td>

                          {/* Risk */}
                          <td className="px-5 py-3.5">
                            <RiskBadge score={r.summary.riskScore} />
                          </td>

                          {/* Controls */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-[#15803D]">{r.summary.passed}✓</span>
                              {r.summary.partial > 0 && <span className="font-semibold text-[#B45309]">{r.summary.partial}~</span>}
                              {r.summary.failed > 0 && <span className="font-semibold text-[#B91C1C]">{r.summary.failed}✗</span>}
                              <span className="text-[#D4D4D4]">/ {r.summary.totalControls}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/assess/${r.reportId}`}
                                className="p-1.5 rounded-lg text-[#BBBBBB] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] transition"
                                title="View report"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(r.reportId)}
                                disabled={deleting === r.reportId}
                                className="p-1.5 rounded-lg text-[#BBBBBB] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition disabled:opacity-40"
                                title="Delete report"
                              >
                                {deleting === r.reportId
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[11px] text-[#D4D4D4]">—</span>
  }
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#999999]">
        <Minus className="w-3 h-3" /> 0%
      </span>
    )
  }
  const up = delta > 0
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold"
      style={{ color: up ? '#15803D' : '#B91C1C' }}
    >
      {up
        ? <TrendingUp className="w-3.5 h-3.5" />
        : <TrendingDown className="w-3.5 h-3.5" />
      }
      {up ? '+' : ''}{delta.toFixed(0)}%
    </span>
  )
}
