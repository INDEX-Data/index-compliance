'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Lightbulb, FileSearch, ExternalLink } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { getPortalLinks } from '@/lib/portal-links'
import type { ControlAssessment } from '@/lib/types'

interface Props {
  assessment:   ControlAssessment
  defaultOpen?: boolean
}

export function ControlCard({ assessment, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const { controlId, controlTitle, family, status, findings, recommendations } = assessment

  const portalLinks = getPortalLinks(controlId)
  const showRemediation = portalLinks.length > 0 && (status === 'fail' || status === 'partial')

  return (
    <div className="bg-white rounded-lg border border-[#E9E5DD] overflow-hidden hover:border-[#D4CFC5] transition-colors">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        {/* Control ID */}
        <span className="shrink-0 text-[10px] font-mono font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-2 py-0.5 rounded">
          {controlId}
        </span>

        {/* Title + Family */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#18181B] truncate">{controlTitle}</p>
          {family && <p className="text-[11px] text-[#A1A1AA] mt-0.5">{family}</p>}
        </div>

        {/* Portal links pill (shown in header when collapsed and remediation available) */}
        {showRemediation && !open && (
          <span className="shrink-0 text-[10px] text-[#6D28D9] bg-[#F5F3FF] border border-[#DDD6FE] px-2 py-0.5 rounded font-medium hidden sm:inline">
            Fix in Azure
          </span>
        )}

        {/* Status badge */}
        <StatusBadge status={status} size="sm" />

        {/* Chevron */}
        <span className="text-[#D1D5DB] ml-1 shrink-0">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-[#F0EDE6] px-4 py-4 space-y-4 bg-[#FAFAF8]">

          {/* Azure portal remediation links */}
          {showRemediation && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <ExternalLink className="w-3 h-3 text-[#7C3AED]" />
                <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-widest">Remediate in Azure</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {portalLinks.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.hint}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6D28D9] bg-white border border-[#DDD6FE] hover:bg-[#F5F3FF] hover:border-[#C4B5FD] px-3 py-1.5 rounded-lg transition"
                    onClick={e => e.stopPropagation()}
                  >
                    {link.label}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <FileSearch className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Findings</span>
              </div>
              <ul className="space-y-1.5">
                {findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {status === 'pass'
                      ? <CheckCircle2 className="w-3 h-3 text-[#15803D] mt-0.5 shrink-0" />
                      : <AlertCircle  className="w-3 h-3 text-[#B45309] mt-0.5 shrink-0" />
                    }
                    <span className="text-xs text-[#4B5563] leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Lightbulb className="w-3 h-3 text-[#B45309]" />
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Recommendations</span>
              </div>
              <ul className="space-y-1.5">
                {recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#B45309] mt-0.5 shrink-0 text-xs font-bold">→</span>
                    <span className="text-xs text-[#4B5563] leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty state */}
          {findings.length === 0 && recommendations.length === 0 && (
            <p className="text-xs text-[#A1A1AA] italic">No detailed findings available.</p>
          )}
        </div>
      )}
    </div>
  )
}
