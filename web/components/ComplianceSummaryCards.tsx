import { CheckCircle2, Clock, XCircle, FileText, AlertTriangle } from 'lucide-react'
import type { ComplianceSummary } from '@/lib/types'

interface Props {
  summary: ComplianceSummary
  className?: string
}

export function ComplianceSummaryCards({ summary, className }: Props) {
  const { passed, failed, partial, notAssessed, totalControls } = summary
  const manualRequired = summary.manualRequired ?? 0
  // Derive coverage for reports generated before the coverage model shipped.
  const assessed = summary.assessedControls ?? (passed + failed + partial)
  const automatable = totalControls - manualRequired - (summary.notApplicable ?? 0)
  const automatedCoverage = summary.automatedCoverage ??
    (totalControls > 0 ? Math.round((automatable / Math.max(totalControls - (summary.notApplicable ?? 0), 1)) * 100) : 0)
  const collectionHealth = summary.collectionHealth ??
    (automatable > 0 ? Math.round((assessed / automatable) * 100) : 100)
  const lowCoverage = summary.lowCoverageWarning ?? (collectionHealth < 90)

  const cards = [
    { label: 'Passed',  value: passed,         color: '#1c1917', icon: CheckCircle2, danger: false },
    { label: 'Partial', value: partial,        color: '#78716c', icon: Clock,        danger: false },
    { label: 'Failed',  value: failed,         color: '#9f403d', icon: XCircle,      danger: true  },
    { label: 'Manual',  value: manualRequired, color: '#6D28D9', icon: FileText,     danger: false },
  ]

  return (
    <div className={className ?? ''}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, color, icon: Icon, danger }) => {
          const pct = Math.round((value / totalControls) * 100)
          return (
            <div
              key={label}
              className={`bg-white p-5 rounded-xl border border-[#e7e5e4] shadow-sm hover:shadow-md transition-all duration-300 ${danger ? 'border-l-4 border-l-[#9f403d]' : ''}`}
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
          )
        })}
      </div>

      {/* Coverage strip — makes the score's basis honest. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#fafaf9] border border-[#e7e5e4] rounded-xl px-5 py-3 text-xs">
        <span className="text-[#44403c]">
          <span className="font-bold text-[#1c1917]">{automatedCoverage}%</span> automated coverage
          <span className="text-[#78716c]"> · {manualRequired} controls need attestation</span>
        </span>
        <span className="text-[#44403c]">
          <span className={`font-bold ${lowCoverage ? 'text-[#9f403d]' : 'text-[#1c1917]'}`}>{collectionHealth}%</span> collection health
          {notAssessed > 0 && <span className="text-[#78716c]"> · {notAssessed} collection gap{notAssessed === 1 ? '' : 's'}</span>}
        </span>
        {lowCoverage && (
          <span className="inline-flex items-center gap-1.5 text-[#9f403d] font-medium">
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
            Score is computed on incomplete data — some automated checks failed to collect.
          </span>
        )}
      </div>
    </div>
  )
}
