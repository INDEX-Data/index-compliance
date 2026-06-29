'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Waves, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getReportDrift, type DriftResult } from '@/lib/api'
import { Card, Badge } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'

function fmtDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DriftPage() {
  const [loading, setLoading] = useState(true)
  const [drift, setDrift] = useState<DriftResult | null>(null)

  useEffect(() => {
    let cancelled = false
    getReportDrift()
      .then((d) => !cancelled && setDrift(d))
      .catch(() => !cancelled && setDrift(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const changed = drift?.changed ?? []
  const delta = drift?.scoreDelta ?? 0
  const deltaTone = delta > 0 ? 'pass' : delta < 0 ? 'fail' : 'neutral'

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="flex items-center gap-2.5 mb-1">
        <Waves className="w-5 h-5 text-faint" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Drift</h1>
      </div>
      <p className="text-sm text-muted mb-5">
        How your posture changed between the two most recent assessments.
      </p>

      {loading ? (
        <Card className="text-center py-12">
          <span className="text-[13px] text-faint">Checking for drift…</span>
        </Card>
      ) : !drift || (drift.reports ?? 0) < 2 ? (
        <Card raised className="text-center py-12">
          <div className="w-11 h-11 rounded-lg bg-surface-sunken border border-border flex items-center justify-center mx-auto mb-3">
            <Waves className="w-5 h-5 text-faint" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-medium text-ink">Not enough history yet</p>
          <p className="text-[13px] text-muted mt-1">
            Run another assessment to start tracking configuration drift over time.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <Card raised className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="font-mono text-[22px] font-semibold text-ink leading-none">
                  {drift.previousReport?.score ?? 0}%
                </div>
                <div className="text-[10px] text-faint mt-1">
                  {fmtDate(drift.previousReport?.generatedAt)}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-faint" aria-hidden />
              <div className="text-center">
                <div className="font-mono text-[22px] font-semibold text-ink leading-none">
                  {drift.latestReport?.score ?? 0}%
                </div>
                <div className="text-[10px] text-faint mt-1">
                  {fmtDate(drift.latestReport?.generatedAt)}
                </div>
              </div>
            </div>
            <Badge tone={deltaTone} dot>
              {delta > 0 ? '+' : ''}
              {delta} pts
            </Badge>
            <div className="ml-auto flex gap-6">
              <div>
                <div className="text-[11px] text-faint mb-1">Improved</div>
                <div className="text-[20px] font-semibold text-pass leading-none">
                  {drift.improved ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-faint mb-1">Degraded</div>
                <div className="text-[20px] font-semibold text-fail leading-none">
                  {drift.degraded ?? 0}
                </div>
              </div>
            </div>
          </Card>

          {/* Changed controls */}
          {changed.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-sm font-medium text-ink">No control changes</p>
              <p className="text-[13px] text-muted mt-1">
                Posture is stable between the last two runs.
              </p>
            </Card>
          ) : (
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.06em] text-faint font-medium mb-2.5">
                {changed.length} control{changed.length !== 1 ? 's' : ''} changed
              </div>
              <Card padded={false} className="divide-y divide-border-subtle">
                {changed.map((c) => {
                  const Icon =
                    c.direction === 'improved'
                      ? TrendingUp
                      : c.direction === 'degraded'
                        ? TrendingDown
                        : Minus
                  const tone =
                    c.direction === 'improved'
                      ? 'text-pass'
                      : c.direction === 'degraded'
                        ? 'text-fail'
                        : 'text-faint'
                  return (
                    <div key={c.controlId} className="flex items-center gap-3 px-4 py-3">
                      <Icon className={`w-4 h-4 shrink-0 ${tone}`} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11.5px] text-faint">{c.controlId}</span>
                          <span className="text-[13.5px] font-medium text-ink truncate">
                            {c.controlName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={c.from} size="sm" />
                        <ArrowRight className="w-3 h-3 text-faint" aria-hidden />
                        <StatusBadge status={c.to} size="sm" />
                      </div>
                    </div>
                  )
                })}
              </Card>
            </div>
          )}

          {drift.latestReport?.id && (
            <Link
              href={`/assess/${drift.latestReport.id}`}
              className="text-[12px] text-muted hover:text-ink transition-colors self-start"
            >
              View latest assessment →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
