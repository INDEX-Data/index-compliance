import { CircleCheck, Wand2 } from 'lucide-react'
import { Card, Badge, StatCard, SectionHeader, Button, type BadgeTone } from '@/components/ui'

// Coverage/score ring — value 0–100. Green = secure (kept distinct from brand orange).
function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circ
  return (
    <svg viewBox="0 0 92 92" width="92" height="92" role="img" aria-label={`${label} ${value} percent`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--border-default)" strokeWidth="8" />
      <circle
        cx="46" cy="46" r={r} fill="none" stroke="var(--status-pass)" strokeWidth="8"
        strokeLinecap="round" strokeDasharray={`${filled} ${circ - filled}`} transform="rotate(-90 46 46)"
      />
      <text x="46" y="43" textAnchor="middle" fontSize="21" fontWeight="600" fill="var(--text-ink)" fontFamily="var(--font-inter), system-ui">{value}%</text>
      <text x="46" y="58" textAnchor="middle" fontSize="9" fill="var(--text-faint)" letterSpacing="0.5" fontFamily="var(--font-inter), system-ui">{label.toUpperCase()}</text>
    </svg>
  )
}

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

      <div className="px-8 py-6 flex flex-col gap-4 max-w-5xl">
        {/* Hero */}
        <Card raised padded={false} className="p-5 flex items-center gap-6">
          <ScoreRing value={data.score} label={data.scoreLabel ?? 'Coverage'} />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-[23px] font-semibold text-ink tracking-[-0.02em]">{data.status}</span>
              <Badge tone={data.statusTone ?? 'pass'} dot>
                <CircleCheck className="w-3.5 h-3.5" aria-hidden />
                {data.statusLabel ?? 'Passing'}
              </Badge>
            </div>
            <p className="text-[13px] text-muted leading-relaxed">{data.summaryLine}</p>
          </div>
        </Card>

        {/* Metrics */}
        {data.stats.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {data.stats.map((s) => (
              <StatCard
                key={s.label}
                label={s.label}
                value={s.value}
                delta={s.delta}
                deltaDirection={s.deltaDirection}
                deltaGood={s.deltaGood}
                hint={s.hint}
              />
            ))}
          </div>
        )}

        {/* Top finding */}
        {data.topFinding && (
          <div>
            <SectionHeader>Top finding</SectionHeader>
            <Card raised>
              <div className="flex items-center gap-2.5 mb-2">
                <Badge tone="fail" dot size="sm">Fail</Badge>
                <span className="text-[14.5px] font-semibold text-ink">{data.topFinding.title}</span>
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
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
