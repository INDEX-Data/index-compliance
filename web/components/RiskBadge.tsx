import type { RiskScore } from '@/lib/types'
import { cn } from '@/lib/cn'

// Quiet, Cursor-style risk: a dot + colored text — no filled pill.
const MAP: Record<RiskScore, { label: string; cls: string; dot: string }> = {
  low: { label: 'Low', cls: 'text-pass', dot: 'bg-pass' },
  medium: { label: 'Medium', cls: 'text-warn', dot: 'bg-warn' },
  high: { label: 'High', cls: 'text-warn', dot: 'bg-warn' },
  critical: { label: 'Critical', cls: 'text-fail', dot: 'bg-fail' },
}

export function RiskBadge({ score }: { score: RiskScore }) {
  const { label, cls, dot } = MAP[score] ?? MAP.critical
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap', cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} aria-hidden />
      {label}
    </span>
  )
}
