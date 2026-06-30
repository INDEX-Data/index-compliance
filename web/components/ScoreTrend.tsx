'use client'

/**
 * ScoreTrend — inline SVG sparkline + delta badge for dashboard framework cards.
 * Pure computation, no external chart library.
 */

interface Props {
  /** Scores in chronological order (oldest first) */
  scores: number[]
  /** Width of the sparkline SVG */
  width?: number
  /** Height of the sparkline SVG */
  height?: number
}

export function ScoreTrend({ scores, width = 120, height = 36 }: Props) {
  if (scores.length < 2) return null

  // Keep last 8 data points
  const pts = scores.slice(-8)
  const min = Math.max(0,  Math.min(...pts) - 5)
  const max = Math.min(100, Math.max(...pts) + 5)
  const range = max - min || 1

  const padX = 4
  const padY = 4
  const innerW = width  - padX * 2
  const innerH = height - padY * 2

  const toX = (i: number) => padX + (i / (pts.length - 1)) * innerW
  const toY = (v: number) => padY + (1 - (v - min) / range) * innerH

  const pathD = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ')

  // Fill area under curve
  const areaD = `${pathD} L${toX(pts.length - 1).toFixed(1)},${(height - padY).toFixed(1)} L${padX},${(height - padY).toFixed(1)} Z`

  const latest   = pts[pts.length - 1]
  const previous = pts[pts.length - 2]
  const delta    = latest - previous

  const lineColor = latest >= 90 ? '#15803D' : latest >= 70 ? '#B45309' : '#B91C1C'
  const areaColor = latest >= 90 ? '#DCFCE7' : latest >= 70 ? '#FEF3C7' : '#FEE2E2'

  return (
    <div className="flex items-center gap-3">
      {/* Sparkline */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Area fill */}
        <path d={areaD} fill={areaColor} opacity={0.6} />
        {/* Line */}
        <path d={pathD} stroke={lineColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        {/* End dot */}
        <circle
          cx={toX(pts.length - 1)}
          cy={toY(latest)}
          r={2.5}
          fill={lineColor}
        />
      </svg>

      {/* Delta badge */}
      <DeltaBadge delta={delta} />
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-faint bg-canvas border border-border px-2 py-0.5 rounded-full">
        — no change
      </span>
    )
  }

  const up = delta > 0
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: up ? '#15803D' : '#B91C1C',
        background: up ? '#DCFCE7' : '#FEE2E2',
      }}
    >
      {up ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}%
    </span>
  )
}
