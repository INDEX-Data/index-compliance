import { CheckCircle2, Clock, XCircle, HelpCircle } from 'lucide-react'
import type { ComplianceSummary } from '@/lib/types'

interface Props {
  summary: ComplianceSummary
  className?: string
}

export function ComplianceSummaryCards({ summary, className }: Props) {
  const { passed, failed, partial, notAssessed, totalControls } = summary

  const cards = [
    {
      label: 'Passed',
      value: passed,
      pct: Math.round((passed / totalControls) * 100),
      color: '#1c1917',
      icon: CheckCircle2,
      danger: false,
    },
    {
      label: 'Partial',
      value: partial,
      pct: Math.round((partial / totalControls) * 100),
      color: '#78716c',
      icon: Clock,
      danger: false,
    },
    {
      label: 'Failed',
      value: failed,
      pct: Math.round((failed / totalControls) * 100),
      color: '#9f403d',
      icon: XCircle,
      danger: true,
    },
    {
      label: 'Unassessed',
      value: notAssessed,
      pct: Math.round((notAssessed / totalControls) * 100),
      color: '#78716c',
      icon: HelpCircle,
      danger: false,
    },
  ]

  return (
    <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${className ?? ''}`}>
      {cards.map(({ label, value, pct, color, icon: Icon, danger }) => (
        <div
          key={label}
          className={`bg-[#fafaf9] p-5 rounded-xl ${danger ? 'border-l-4 border-[#9f403d]' : ''}`}
        >
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-bold text-[#44403c] uppercase tracking-wider">{label}</p>
            <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.5} />
          </div>
          <p className="text-2xl font-bold text-[#1c1917] mb-1">{value}</p>
          <p className="text-xs text-[#44403c]">{pct}% of {totalControls} controls</p>
          <div className="mt-4 w-full bg-[#d6d3d1] h-1 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
