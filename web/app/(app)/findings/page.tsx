'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, CircleCheck } from 'lucide-react'
import { getReports, getReport } from '@/lib/api'
import { FRAMEWORK_CATALOG } from '@/lib/framework-catalog'
import type { ComplianceStatus } from '@/lib/types'
import { Card, Badge } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/cn'

interface Finding {
  controlId: string
  title: string
  frameworkId: string
  family: string
  status: ComplianceStatus
  detail: string
  reportId: string
}

function fwName(id: string): string {
  const norm = id.toLowerCase().replace(/_/g, '-')
  return FRAMEWORK_CATALOG.find((f) => f.id === norm)?.name ?? id
}

type Filter = 'all' | 'fail' | 'partial'

export default function FindingsPage() {
  const [loading, setLoading] = useState(true)
  const [findings, setFindings] = useState<Finding[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const reports = await getReports()
        // Latest report per framework
        const byFw: Record<string, (typeof reports)[number]> = {}
        for (const r of reports) {
          const cur = byFw[r.frameworkId]
          if (!cur || new Date(r.generatedAt) > new Date(cur.generatedAt)) byFw[r.frameworkId] = r
        }
        const full = await Promise.all(
          Object.values(byFw).map((r) => getReport(r.reportId).catch(() => null))
        )
        const out: Finding[] = []
        for (const report of full) {
          if (!report) continue
          for (const c of report.controlAssessments) {
            if (c.status === 'fail' || c.status === 'partial') {
              out.push({
                controlId: c.controlId,
                title: c.controlTitle,
                frameworkId: c.frameworkId,
                family: c.family,
                status: c.status,
                detail: c.findings?.[0] ?? c.recommendations?.[0] ?? '',
                reportId: report.reportId,
              })
            }
          }
        }
        // Failing before partial, then by control id
        out.sort((a, b) =>
          a.status === b.status
            ? a.controlId.localeCompare(b.controlId)
            : a.status === 'fail'
              ? -1
              : 1
        )
        if (!cancelled) setFindings(out)
      } catch {
        if (!cancelled) setFindings([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(
    () => ({
      all: findings.length,
      fail: findings.filter((f) => f.status === 'fail').length,
      partial: findings.filter((f) => f.status === 'partial').length,
    }),
    [findings]
  )
  const shown = filter === 'all' ? findings : findings.filter((f) => f.status === filter)

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="flex items-center gap-2.5 mb-1">
        <AlertTriangle className="w-5 h-5 text-faint" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Findings</h1>
      </div>
      <p className="text-sm text-muted mb-5">
        Open findings across your latest assessments, by severity.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-4">
        {(
          [
            ['all', 'All', counts.all],
            ['fail', 'Failing', counts.fail],
            ['partial', 'Needs review', counts.partial],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-medium border transition-colors',
              filter === key
                ? 'bg-ink text-surface border-ink'
                : 'bg-surface text-muted border-border hover:bg-surface-sunken hover:text-ink'
            )}
          >
            {label}
            <span
              className={cn(
                'font-mono text-[11px]',
                filter === key ? 'text-white/60' : 'text-faint'
              )}
            >
              {n}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="text-center py-12">
          <span className="text-[13px] text-faint">Loading findings…</span>
        </Card>
      ) : shown.length === 0 ? (
        <Card raised className="text-center py-12">
          <div className="w-11 h-11 rounded-lg bg-pass-bg flex items-center justify-center mx-auto mb-3">
            <CircleCheck className="w-5 h-5 text-pass" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-medium text-ink">
            {findings.length === 0 ? 'No open findings' : 'Nothing in this filter'}
          </p>
          <p className="text-[13px] text-muted mt-1">
            {findings.length === 0
              ? 'Every assessed control is passing or attested.'
              : 'Try a different severity.'}
          </p>
        </Card>
      ) : (
        <Card padded={false} className="divide-y divide-border-subtle">
          {shown.map((f) => (
            <Link
              key={`${f.frameworkId}-${f.controlId}`}
              href={`/assess/${f.reportId}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors"
            >
              <div className="pt-0.5">
                <StatusBadge status={f.status} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11.5px] text-faint">{f.controlId}</span>
                  <span className="text-[13.5px] font-medium text-ink truncate">{f.title}</span>
                </div>
                {f.detail && (
                  <p className="text-[12px] text-muted leading-snug mt-0.5 line-clamp-1">
                    {f.detail}
                  </p>
                )}
              </div>
              <Badge tone="neutral" size="sm" className="mt-0.5 shrink-0">
                {fwName(f.frameworkId)}
              </Badge>
              <ChevronRight className="w-4 h-4 text-faint shrink-0 mt-1" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
