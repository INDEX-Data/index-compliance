'use client'

import { ChevronRight } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { getPortalLinks } from '@/lib/portal-links'
import type { ControlAssessment } from '@/lib/types'

export type { ControlAssessment }

interface Props {
  assessment:     ControlAssessment
  onViewEvidence: (assessment: ControlAssessment) => void
}

export function ControlCard({ assessment, onViewEvidence }: Props) {
  const { controlId, controlTitle, family, status } = assessment

  const portalLinks     = getPortalLinks(controlId)
  const showRemediation = portalLinks.length > 0 && (status === 'fail' || status === 'partial')

  return (
    <button
      type="button"
      onClick={() => onViewEvidence(assessment)}
      className="w-full bg-white rounded-lg border border-border hover:border-border-strong hover:bg-[#fafafa] active:bg-surface-sunken transition-colors text-left"
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="shrink-0 text-[10px] font-mono font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-2 py-0.5 rounded">
          {controlId}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{controlTitle}</p>
          {family && <p className="text-[11px] text-faint mt-0.5">{family}</p>}
        </div>

        {showRemediation && (
          <span className="shrink-0 text-[10px] text-[#6D28D9] bg-[#F5F3FF] border border-[#DDD6FE] px-2 py-0.5 rounded font-medium hidden sm:inline">
            Fix in Azure
          </span>
        )}

        <StatusBadge status={status} size="sm" />

        <ChevronRight className="w-3.5 h-3.5 text-[#d6d3d1] shrink-0 ml-1" />
      </div>
    </button>
  )
}
