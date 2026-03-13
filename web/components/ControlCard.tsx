'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Lightbulb, FileSearch, ExternalLink, Database } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { getPortalLinks } from '@/lib/portal-links'
import type { ControlAssessment, EvidenceResult } from '@/lib/types'

// ── Evidence table ─────────────────────────────────────────────────────────

function cellVal(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') {
    const s = JSON.stringify(val)
    return s.length > 60 ? s.slice(0, 60) + '…' : s
  }
  const s = String(val)
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

function EvidenceTable({ data }: { data: unknown[] }) {
  if (data.length === 0) {
    return <span className="text-[10px] text-[#A1A1AA] italic">No records returned</span>
  }

  const first = data[0]
  if (typeof first !== 'object' || first === null) {
    return <pre className="text-[10px] font-mono text-[#4B5563] bg-[#F8F8F6] p-2 rounded overflow-auto max-h-20">{String(first)}</pre>
  }

  const allKeys = Object.keys(first as object).filter(k => !k.startsWith('@'))
  const cols = allKeys.slice(0, 6)
  const rows = data.slice(0, 10)

  if (cols.length === 0) {
    return <span className="text-[10px] text-[#A1A1AA] italic">Metadata-only response</span>
  }

  return (
    <div className="overflow-x-auto rounded border border-[#E9E5DD]">
      <table className="w-full text-[10px] font-mono min-w-max">
        <thead>
          <tr className="bg-[#F0EDE6]">
            {cols.map(c => (
              <th key={c} className="px-2 py-1.5 text-left text-[#6B7280] font-semibold whitespace-nowrap border-r border-[#E9E5DD] last:border-r-0">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'}>
              {cols.map(col => (
                <td
                  key={col}
                  className="px-2 py-1 text-[#374151] border-r border-[#E9E5DD] last:border-r-0 max-w-[180px] truncate"
                  title={String((row as Record<string, unknown>)[col] ?? '')}
                >
                  {cellVal((row as Record<string, unknown>)[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <div className="px-2 py-1 bg-[#F8F8F6] border-t border-[#E9E5DD] text-[10px] text-[#A1A1AA]">
          Showing 10 of {data.length} records
        </div>
      )}
    </div>
  )
}

function EvidenceItem({ ev }: { ev: EvidenceResult }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-[#374151]">{ev.queryDescription}</span>
        <span className="text-[10px] text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-1.5 py-0.5 rounded font-mono">
          {ev.recordCount} records
        </span>
        <span className="text-[9px] font-mono text-[#A1A1AA] break-all">{ev.endpoint}</span>
      </div>
      {ev.success
        ? <EvidenceTable data={ev.rawData ?? []} />
        : <span className="text-[10px] text-[#DC2626] italic">{ev.errorMessage ?? 'Query failed'}</span>
      }
    </div>
  )
}

// ── ControlCard ────────────────────────────────────────────────────────────

interface Props {
  assessment:   ControlAssessment
  defaultOpen?: boolean
}

export function ControlCard({ assessment, defaultOpen = false }: Props) {
  const [open, setOpen]             = useState(defaultOpen)
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  const { controlId, controlTitle, family, status, findings, recommendations, evidenceCollected } = assessment

  const portalLinks     = getPortalLinks(controlId)
  const showRemediation = portalLinks.length > 0 && (status === 'fail' || status === 'partial')
  const evidenceQueries = evidenceCollected?.filter(e => e.success && (e.rawData?.length ?? 0) > 0) ?? []

  return (
    <div className="bg-white rounded-lg border border-[#E9E5DD] overflow-hidden hover:border-[#D4CFC5] transition-colors">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        <span className="shrink-0 text-[10px] font-mono font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-2 py-0.5 rounded">
          {controlId}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#18181B] truncate">{controlTitle}</p>
          {family && <p className="text-[11px] text-[#A1A1AA] mt-0.5">{family}</p>}
        </div>

        {showRemediation && !open && (
          <span className="shrink-0 text-[10px] text-[#6D28D9] bg-[#F5F3FF] border border-[#DDD6FE] px-2 py-0.5 rounded font-medium hidden sm:inline">
            Fix in Azure
          </span>
        )}

        <StatusBadge status={status} size="sm" />

        <span className="text-[#D1D5DB] ml-1 shrink-0">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* ── Expanded detail ─────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-[#F0EDE6] px-4 py-4 space-y-4 bg-[#FAFAF8]">

          {/* Remediation links */}
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

          {/* Raw Evidence */}
          {evidenceQueries.length > 0 && (
            <div>
              <button
                onClick={() => setEvidenceOpen(o => !o)}
                className="flex items-center gap-1.5 w-full text-left"
              >
                <Database className="w-3 h-3 text-[#6366F1]" />
                <span className="text-[10px] font-bold text-[#6366F1] uppercase tracking-widest">Raw Evidence</span>
                <span className="text-[10px] text-[#A1A1AA] ml-1">
                  ({evidenceQueries.length} {evidenceQueries.length === 1 ? 'query' : 'queries'})
                </span>
                <span className="text-[#D1D5DB] ml-auto">
                  {evidenceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
              </button>

              {evidenceOpen && (
                <div className="mt-2.5 space-y-4">
                  {evidenceQueries.map(ev => (
                    <EvidenceItem key={ev.queryId} ev={ev} />
                  ))}
                </div>
              )}
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
