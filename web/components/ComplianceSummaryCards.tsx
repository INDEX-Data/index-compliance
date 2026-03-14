import { TrendingUp } from 'lucide-react'
import type { ComplianceSummary } from '@/lib/types'
import { RiskBadge } from './RiskBadge'

interface Props {
  summary: ComplianceSummary
  className?: string
}

export function ComplianceSummaryCards({ summary, className }: Props) {
  const { passed, failed, partial, notAssessed, compliancePercentage, riskScore, totalControls } = summary

  const cards = [
    {
      label:    'Passed',
      value:    passed,
      sub:      `of ${totalControls}`,
      barColor: '#15803D',
      pct:      Math.round((passed / totalControls) * 100),
      valCls:   'text-[#15803D]',
    },
    {
      label:    'Partial',
      value:    partial,
      sub:      `of ${totalControls}`,
      barColor: '#B45309',
      pct:      Math.round((partial / totalControls) * 100),
      valCls:   'text-[#B45309]',
    },
    {
      label:    'Failed',
      value:    failed,
      sub:      `of ${totalControls}`,
      barColor: '#B91C1C',
      pct:      Math.round((failed / totalControls) * 100),
      valCls:   'text-[#B91C1C]',
    },
    {
      label:    'Not Assessed',
      value:    notAssessed,
      sub:      `of ${totalControls}`,
      barColor: '#999999',
      pct:      Math.round((notAssessed / totalControls) * 100),
      valCls:   'text-[#555555]',
    },
  ]

  const scoreColor = compliancePercentage >= 85 ? '#15803D'
                   : compliancePercentage >= 65 ? '#B45309'
                   : '#B91C1C'

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 ${className ?? ''}`}>

      {/* Four stat cards */}
      {cards.map(({ label, value, sub, barColor, pct, valCls }) => (
        <div key={label} className="lg:col-span-1 col-span-1 bg-white rounded-xl border border-[#E8E8E8] p-4 flex flex-col relative overflow-hidden">
          {/* Colored bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: barColor, opacity: 0.6 }} />
          <p className={`text-3xl font-bold tabular-nums ${valCls}`}>{value}</p>
          <p className="text-[11px] font-medium text-[#555555] mt-0.5 uppercase tracking-wide">{label}</p>
          <p className="text-[10px] text-[#999999] mt-2">{pct}% {sub}</p>
        </div>
      ))}

      {/* Compliance score — spans 2 cols */}
      <div className="col-span-2 bg-white rounded-xl border border-[#E8E8E8] p-4 flex items-center gap-4">
        <div className="shrink-0">
          <p className="text-4xl font-bold tabular-nums" style={{ color: scoreColor }}>
            {compliancePercentage}
            <span className="text-xl font-medium text-[#999999]">%</span>
          </p>
          <p className="text-[11px] font-medium text-[#555555] uppercase tracking-wide mt-0.5">Compliance Score</p>
          <div className="mt-2">
            <RiskBadge score={riskScore} />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] text-[#999999]">
            <div className="h-1.5 flex-1 rounded-full bg-[#F3F3F3] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${compliancePercentage}%`, background: scoreColor }} />
            </div>
            <span className="shrink-0 font-mono">{compliancePercentage}%</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <TrendingUp className="w-3 h-3 text-[#999999]" />
            <span className="text-[10px] text-[#999999]">{totalControls} total controls assessed</span>
          </div>
        </div>
      </div>

    </div>
  )
}
