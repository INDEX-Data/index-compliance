'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shield, Plug, ArrowRight, ChevronRight } from 'lucide-react'
import { getReports, getClients, getProfile } from '@/lib/api'
import type { ReportMeta } from '@/lib/types'
import { FRAMEWORK_CATALOG } from '@/lib/framework-catalog'
import { PostureView, type PostureData } from '@/components/PostureView'
import { Card, Button } from '@/components/ui'
import { RiskBadge } from '@/components/RiskBadge'

function fwName(id: string): string {
  const norm = id.toLowerCase().replace(/_/g, '-')
  return FRAMEWORK_CATALOG.find((f) => f.id === norm)?.name ?? id
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [hasClients, setHasClients] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8_000)
    Promise.all([getReports(), getClients(), getProfile().catch(() => null)])
      .then(([rpts, clients]) => {
        setReports(rpts)
        setHasClients(clients.length > 0)
      })
      .catch(() => {
        setReports([])
        setHasClients(false)
      })
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-border-strong animate-pulse" />
          <span className="text-[13px] text-faint">Loading posture…</span>
        </div>
      </div>
    )
  }

  // Latest report per framework
  const byFramework: Record<string, ReportMeta[]> = {}
  for (const r of reports) (byFramework[r.frameworkId] ??= []).push(r)
  const latest = Object.values(byFramework).map(
    (arr) =>
      arr
        .sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime())
        .at(-1)!
  )

  // ── Empty state ──
  if (latest.length === 0) {
    return (
      <div className="px-8 py-16 max-w-xl">
        <Card raised className="text-center px-8 py-10">
          <div className="w-12 h-12 rounded-lg bg-surface-sunken border border-border flex items-center justify-center mx-auto mb-4">
            <Plug className="w-5 h-5 text-faint" strokeWidth={1.7} />
          </div>
          <h2 className="text-lg font-semibold text-ink mb-1.5">
            {hasClients ? 'Run your first assessment' : 'Connect your environment'}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-5">
            {hasClients
              ? 'Assess a framework to see your security posture, findings, and evidence here.'
              : 'Add a Microsoft 365 connection, then assess a framework to light up your posture.'}
          </p>
          <Link href={hasClients ? '/assess' : '/clients'}>
            <Button variant="primary" size="md">
              {hasClients ? 'Start an assessment' : 'Add a connection'}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  // ── Live posture aggregation ──
  const totals = latest.reduce(
    (a, r) => ({
      passed: a.passed + r.summary.passed,
      failed: a.failed + r.summary.failed,
      partial: a.partial + r.summary.partial,
      manual: a.manual + (r.summary.manualRequired ?? 0),
      notAssessed: a.notAssessed + r.summary.notAssessed,
    }),
    { passed: 0, failed: 0, partial: 0, manual: 0, notAssessed: 0 }
  )
  const controls =
    totals.passed + totals.failed + totals.partial + totals.manual + totals.notAssessed
  const score = Math.round(
    latest.reduce((s, r) => s + r.summary.compliancePercentage, 0) / latest.length
  )
  const frameworks = latest.map((r) => fwName(r.frameworkId))
  const mostRecent = [...latest].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )[0]

  const tone = score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail'
  const posture: PostureData = {
    status: score >= 80 ? 'Secure' : score >= 50 ? 'Needs attention' : 'At risk',
    statusLabel: tone === 'pass' ? 'Passing' : 'Action needed',
    statusTone: tone,
    score,
    scoreLabel: 'Score',
    syncedLabel: `assessed ${relativeDate(mostRecent.generatedAt)}`,
    summaryLine: (
      <>
        <span className="font-mono text-ink">{controls.toLocaleString()}</span> controls evaluated ·{' '}
        <span className="font-mono text-ink">{totals.failed}</span> open findings · across{' '}
        <span className="text-ink">{frameworks.slice(0, 3).join(', ')}</span>
        {frameworks.length > 3 ? ` +${frameworks.length - 3}` : ''}.
      </>
    ),
    stats: [
      {
        label: 'Open findings',
        value: totals.failed,
        hint: totals.failed === 0 ? 'none' : 'review',
      },
      { label: 'Needs review', value: totals.partial, hint: 'partial' },
      { label: 'Frameworks', value: latest.length, hint: 'monitored' },
    ],
    topFinding:
      mostRecent.summary.topFindings && mostRecent.summary.topFindings.length > 0
        ? {
            title: mostRecent.summary.topFindings[0],
            controlId: fwName(mostRecent.frameworkId),
            reasoning: 'Flagged by the most recent assessment',
          }
        : undefined,
  }

  return (
    <div>
      <PostureView data={posture} />

      {/* Recent assessments */}
      <div className="px-8 pb-10 max-w-5xl">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11.5px] uppercase tracking-[0.06em] text-faint font-medium">
            Recent assessments
          </span>
          <Link href="/assess" className="text-[12px] text-muted hover:text-ink transition-colors">
            New assessment →
          </Link>
        </div>
        <Card padded={false} className="divide-y divide-border-subtle">
          {[...latest]
            .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
            .map((r) => (
              <Link
                key={r.reportId}
                href={`/assess/${r.reportId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors"
              >
                <span className="text-[13px] font-medium text-ink flex-1 min-w-0 truncate">
                  {fwName(r.frameworkId)}
                </span>
                <span className="font-mono text-[13px] text-ink tabular-nums">
                  {r.summary.compliancePercentage}%
                </span>
                <RiskBadge score={r.summary.riskScore} />
                <span className="text-[11.5px] text-faint font-mono w-16 text-right">
                  {relativeDate(r.generatedAt)}
                </span>
                <ChevronRight className="w-4 h-4 text-faint shrink-0" aria-hidden />
              </Link>
            ))}
        </Card>
      </div>
    </div>
  )
}
