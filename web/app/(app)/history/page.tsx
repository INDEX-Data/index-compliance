'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Trash2,
  ChevronRight,
  Calendar,
  Shield,
  Loader2,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from 'lucide-react'
import { getReports, deleteReport } from '@/lib/api'
import { RiskBadge } from '@/components/RiskBadge'
import type { ReportMeta } from '@/lib/types'

export default function HistoryPage() {
  const router = useRouter()
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    getReports()
      .then(setReports)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeleting(id)
    setDeleteError(null)
    try {
      await deleteReport(id)
      setReports((r) => r.filter((x) => x.reportId !== id))
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete report')
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
    grouped[id].sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )
  }
  // Sort groups by most recent run
  const frameworkIds = Object.keys(grouped).sort(
    (a, b) =>
      new Date(grouped[b][0].generatedAt).getTime() - new Date(grouped[a][0].generatedAt).getTime()
  )

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>
            Report History
          </h1>
          <p className="text-[14px] text-faint mt-1.5">
            {reports.length > 0
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} across ${frameworkIds.length} framework${frameworkIds.length !== 1 ? 's' : ''}`
              : 'All saved compliance assessment reports'}
          </p>
        </div>
        <Link
          href="/assess"
          className="inline-flex items-center gap-2 bg-ink hover:bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Play className="w-3.5 h-3.5" />
          New Assessment
        </Link>
      </div>

      {deleteError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{deleteError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32 text-faint">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading reports…</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-border flex items-center justify-center mb-5 shadow-card">
            <FileText className="w-7 h-7 text-[#d6d3d1]" />
          </div>
          <h3 className="text-base font-semibold text-ink mb-2">No reports yet</h3>
          <p className="text-sm text-muted max-w-sm mb-7 leading-relaxed">
            Run an assessment to generate your first compliance report.
          </p>
          <Link
            href="/assess"
            className="inline-flex items-center gap-2 bg-ink hover:bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Play className="w-3.5 h-3.5" />
            Run Assessment
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {frameworkIds.map((fwId) => {
            const rows = grouped[fwId]
            return (
              <div
                key={fwId}
                className="bg-white rounded-xl border border-border overflow-hidden shadow-card"
              >
                {/* Framework group header */}
                <div className="px-5 py-3 bg-[#fafafa] border-b border-border-subtle flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-border flex items-center justify-center shrink-0">
                    <Shield className="w-3.5 h-3.5 text-faint" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[13px] font-bold text-ink">{rows[0].frameworkName}</span>
                  </div>
                  <span className="text-[11px] text-faint">
                    {rows.length} run{rows.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-widest">
                        Date
                      </th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-widest">
                        Score
                      </th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-widest">
                        Δ vs prev
                      </th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-widest">
                        Risk
                      </th>
                      <th className="text-left px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-widest">
                        Controls
                      </th>
                      <th className="text-right px-5 py-3 text-[10px] font-semibold text-faint uppercase tracking-widest" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f4]">
                    {rows.map((r, idx) => {
                      const pct = r.summary.compliancePercentage
                      const color = scoreColor(pct)
                      // "prev" is the next item in this sorted-newest-first array
                      const prevPct =
                        idx < rows.length - 1 ? rows[idx + 1].summary.compliancePercentage : null
                      const delta = prevPct !== null ? pct - prevPct : null
                      const isLatest = idx === 0

                      return (
                        <tr
                          key={r.reportId}
                          className="hover:bg-[#fafafa] transition cursor-pointer"
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
                                <div className="text-[12px] text-ink flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-faint" />
                                  {new Date(r.generatedAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </div>
                                <div className="text-[10px] text-faint mt-0.5 ml-4.5">
                                  {new Date(r.generatedAt).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                                <div className="text-[9px] text-[#d6d3d1] font-mono mt-0.5">
                                  {r.reportId}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-surface-sunken rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: color }}
                                />
                              </div>
                              <span
                                className="text-[13px] font-bold tabular-nums"
                                style={{ color }}
                              >
                                {pct}%
                              </span>
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
                              <span className="font-semibold text-[#15803D]">
                                {r.summary.passed}✓
                              </span>
                              {r.summary.partial > 0 && (
                                <span className="font-semibold text-[#B45309]">
                                  {r.summary.partial}~
                                </span>
                              )}
                              {r.summary.failed > 0 && (
                                <span className="font-semibold text-[#B91C1C]">
                                  {r.summary.failed}✗
                                </span>
                              )}
                              <span className="text-[#d6d3d1]">/ {r.summary.totalControls}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td
                            className="px-5 py-3.5 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/assess/${r.reportId}`}
                                className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-[#fafafa] transition"
                                title="View report"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(r.reportId)}
                                disabled={deleting === r.reportId}
                                className="p-1.5 rounded-lg text-faint hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition disabled:opacity-40"
                                title="Delete report"
                              >
                                {deleting === r.reportId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
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
    return <span className="text-[11px] text-[#d6d3d1]">—</span>
  }
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-faint">
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
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? '+' : ''}
      {delta.toFixed(0)}%
    </span>
  )
}
