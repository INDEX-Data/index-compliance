import { Wand2 } from 'lucide-react'
import { SectionHeader, Button, type BadgeTone } from '@/components/ui'

export interface PostureStat {
  label: string
  value: React.ReactNode
  delta?: string
  deltaDirection?: 'up' | 'down'
  deltaGood?: boolean
  hint?: React.ReactNode
}

export interface PostureData {
  status: string
  statusLabel?: string
  statusTone?: BadgeTone
  score: number
  scoreLabel?: string
  summaryLine: React.ReactNode
  monitored?: boolean
  syncedLabel?: string
  stats: PostureStat[]
  topFinding?: {
    title: string
    controlId?: string
    reasoning?: string
    mapsTo?: string
    onRemediate?: () => void
    onViewEvidence?: () => void
  }
}

export function PostureView({ data }: { data: PostureData }) {
  return (
    <div className="flex flex-col">
      {/* Context strip */}
      <div className="flex items-center gap-2 px-8 py-3 border-b border-border bg-surface">
        <span className="text-[13px] font-medium text-ink">Security posture</span>
        {data.monitored !== false && (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-pass">
            <span className="w-1.5 h-1.5 rounded-full bg-pass" aria-hidden />
            All systems monitored
          </span>
        )}
        {data.syncedLabel && <span className={`text-[11.5px] text-faint font-mono ${data.monitored === false ? 'ml-auto' : ''}`}>{data.syncedLabel}</span>}
      </div>

      <div className="px-8 py-7 flex flex-col gap-6 max-w-4xl">
        {/* Hero — monochrome score + track (no ring) */}
        <div>
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[13px] text-muted">{data.scoreLabel ?? 'Score'}</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <span className={`w-1.5 h-1.5 rounded-full ${DOT[data.statusTone ?? 'neutral']}`} aria-hidden />
                  {data.status}
                </span>
              </div>
              <div className="text-[52px] font-semibold text-ink tracking-[-0.04em] leading-[0.85]">
                {data.score}
                <span className="text-[26px] text-faint font-medium">%</span>
              </div>
            </div>
            <p className="text-[12px] text-muted leading-[1.7] text-right max-w-[260px]">{data.summaryLine}</p>
          </div>
          <div className="h-0.5 rounded-full bg-border mt-5 overflow-hidden">
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, data.score))}%` }} />
          </div>
        </div>

        {/* Metrics — one flat hairline-divided group */}
        {data.stats.length > 0 && (
          <div className="grid grid-cols-3 border border-border rounded-lg overflow-hidden">
            {data.stats.map((s, i) => (
              <div key={s.label} className={i < data.stats.length - 1 ? 'p-4 border-r border-border' : 'p-4'}>
                <div className="text-[11.5px] text-muted mb-2">{s.label}</div>
                <div className="text-[24px] font-semibold text-ink tracking-[-0.02em] leading-none">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top finding */}
        {data.topFinding && (
          <div>
            <SectionHeader>Top finding</SectionHeader>
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fail shrink-0" aria-hidden />
                <span className="text-[14px] font-semibold text-ink">{data.topFinding.title}</span>
                {data.topFinding.controlId && (
                  <span className="ml-auto font-mono text-[11px] text-faint">{data.topFinding.controlId}</span>
                )}
              </div>
              {(data.topFinding.reasoning || data.topFinding.mapsTo) && (
                <p className="text-[12.5px] text-muted leading-relaxed mb-3.5">
                  {data.topFinding.reasoning}
                  {data.topFinding.reasoning && data.topFinding.mapsTo ? ' · ' : ''}
                  {data.topFinding.mapsTo && <>maps to <span className="font-mono text-ink">{data.topFinding.mapsTo}</span></>}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={data.topFinding.onRemediate}>
                  <Wand2 className="w-3.5 h-3.5" aria-hidden />
                  Draft remediation
                </Button>
                <Button variant="secondary" size="sm" onClick={data.topFinding.onViewEvidence}>View evidence</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const DOT: Record<BadgeTone, string> = {
  pass: 'bg-pass',
  warn: 'bg-warn',
  fail: 'bg-fail',
  info: 'bg-info',
  neutral: 'bg-faint',
  brand: 'bg-ink',
}
