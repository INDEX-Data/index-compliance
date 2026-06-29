'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Trash2,
  ChevronRight,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { getReports, deleteReport } from '@/lib/api'
import { RiskBadge } from '@/components/RiskBadge'
import { Card, Badge, Button } from '@/components/ui'
import type { ReportMeta } from '@/lib/types'

function toneVar(pct: number): string {
  return pct >= 90 ? 'var(--status-pass)' : pct >= 70 ? 'var(--status-warn)' : 'var(--status-fail)'
}
function toneClass(pct: number): string {
  return pct >= 90 ? 'text-pass' : pct >= 70 ? 'text-warn' : 'text-fail'
}

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    getReports()
      .then(setReports)
      .catch(() => setReports([]))
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

  // Group by framework, newest-first within each; groups ordered by most-recent run
  const grouped: Record<string, ReportMeta[]> = {}
  for (const r of reports) (grouped[r.frameworkId] ??= []).push(r)
  for (const id of Object.keys(grouped)) {
    grouped[id].sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    )
  }
  const frameworkIds = Object.keys(grouped).sort(
    (a, b) =>
      new Date(grouped[b][0].generatedAt).getTime() - new Date(grouped[a][0].generatedAt).getTime()
  )
  const avgScore =
    frameworkIds.length > 0
      ? Math.round(
          frameworkIds.reduce((s, id) => s + grouped[id][0].summary.compliancePercentage, 0) /
            frameworkIds.length
        )
      : 0

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FileText className="w-5 h-5 text-faint" strokeWidth={1.7} />
            <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Reports</h1>
          </div>
          <p className="text-sm text-muted">
            {reports.length > 0
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} across ${frameworkIds.length} framework${frameworkIds.length !== 1 ? 's' : ''} · ${avgScore}% avg score`
              : 'Every saved compliance assessment, audit-ready for export.'}
          </p>
        </div>
        <Link href="/assess">
          <Button variant="primary" size="md">
            <Play className="w-3.5 h-3.5" aria-hidden />
            New assessment
          </Button>
        </Link>
      </div>

      {deleteError && (
        <div className="flex items-start gap-3 rounded-md border border-fail-border bg-fail-bg p-3.5 text-[13px] text-fail mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>{deleteError}</span>
        </div>
      )}

      {loading ? (
        <Card className="text-center py-14">
          <span className="text-[13px] text-faint">Loading reports…</span>
        </Card>
      ) : reports.length === 0 ? (
        <Card raised className="text-center py-14">
          <div className="w-12 h-12 rounded-lg bg-surface-sunken border border-border flex items-center justify-center mx-auto mb-4">
            <FileText className="w-5 h-5 text-faint" strokeWidth={1.7} />
          </div>
          <h2 className="text-base font-semibold text-ink mb-1.5">No reports yet</h2>
          <p className="text-sm text-muted mb-5">
            Run an assessment to generate your first compliance report.
          </p>
          <Link href="/assess">
            <Button variant="primary" size="md">
              <Play className="w-3.5 h-3.5" aria-hidden />
              Run assessment
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {frameworkIds.map((fwId) => {
            const rows = grouped[fwId]
            const latest = rows[0]
            return (
              <Card key={fwId} raised padded={false}>
                {/* Framework header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
                  <span className="text-[13px] font-semibold text-ink flex-1">
                    {latest.frameworkName}
                  </span>
                  <span
                    className={`font-mono text-[13px] font-semibold tabular-nums ${toneClass(latest.summary.compliancePercentage)}`}
                  >
                    {latest.summary.compliancePercentage}%
                  </span>
                  <RiskBadge score={latest.summary.riskScore} />
                  <span className="text-[11px] text-faint w-14 text-right">
                    {rows.length} run{rows.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Runs */}
                <div className="divide-y divide-border-subtle">
                  {rows.map((r, idx) => {
                    const pct = r.summary.compliancePercentage
                    const prevPct =
                      idx < rows.length - 1 ? rows[idx + 1].summary.compliancePercentage : null
                    const delta = prevPct !== null ? pct - prevPct : null
                    return (
                      <div
                        key={r.reportId}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors cursor-pointer"
                        onClick={() => router.push(`/assess/${r.reportId}`)}
                      >
                        <div className="w-[150px] shrink-0">
                          <div className="flex items-center gap-1.5">
                            {idx === 0 && (
                              <Badge tone="neutral" size="sm">
                                Latest
                              </Badge>
                            )}
                            <span className="text-[12.5px] text-ink">
                              {new Date(r.generatedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-faint">{r.reportId}</span>
                        </div>

                        {/* Score bar */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-20 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: toneVar(pct) }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[12.5px] font-semibold tabular-nums ${toneClass(pct)}`}
                          >
                            {pct}%
                          </span>
                        </div>

                        {/* Delta */}
                        <div className="w-16 shrink-0">
                          {delta === null ? (
                            <span className="text-[11px] text-faint">—</span>
                          ) : Math.abs(delta) < 0.5 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                              <Minus className="w-3 h-3" />0
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium ${delta > 0 ? 'text-pass' : 'text-fail'}`}
                            >
                              {delta > 0 ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                              {delta > 0 ? '+' : ''}
                              {delta.toFixed(0)}
                            </span>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono w-28 shrink-0">
                          <span className="text-pass">{r.summary.passed}</span>
                          {r.summary.partial > 0 && (
                            <span className="text-warn">{r.summary.partial}</span>
                          )}
                          {r.summary.failed > 0 && (
                            <span className="text-fail">{r.summary.failed}</span>
                          )}
                          <span className="text-faint">/ {r.summary.totalControls}</span>
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/assess/${r.reportId}`}
                            className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-canvas transition-colors"
                            title="View report"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(r.reportId)}
                            disabled={deleting === r.reportId}
                            className="p-1.5 rounded-md text-faint hover:text-fail hover:bg-fail-bg transition-colors disabled:opacity-40"
                            title="Delete report"
                          >
                            {deleting === r.reportId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
