import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface StatCardProps {
  label: string
  value: React.ReactNode
  /** Optional delta, e.g. "4". Rendered with an arrow and pass/fail color. */
  delta?: string
  deltaDirection?: 'up' | 'down'
  /** True if the delta direction is the good one (drives green vs red). */
  deltaGood?: boolean
  /** Quiet supporting text shown instead of a delta. */
  hint?: React.ReactNode
  className?: string
}

export function StatCard({
  label,
  value,
  delta,
  deltaDirection = 'down',
  deltaGood = true,
  hint,
  className,
}: StatCardProps) {
  const Arrow = deltaDirection === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <div className={cn('bg-surface border border-border rounded-lg p-4', className)}>
      <div className="text-[11.5px] text-faint mb-2.5">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[27px] font-semibold text-ink leading-none tracking-[-0.02em]">
          {value}
        </span>
        {delta && (
          <span className={cn('text-[11px] inline-flex items-center', deltaGood ? 'text-pass' : 'text-fail')}>
            <Arrow className="w-3 h-3" aria-hidden />
            {delta}
          </span>
        )}
        {!delta && hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
    </div>
  )
}
