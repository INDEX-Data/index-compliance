'use client'

import { useEffect } from 'react'
import { X, Database, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { ControlAssessment, EvidenceResult } from '@/lib/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function cellVal(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') {
    const s = JSON.stringify(val)
    return s.length > 72 ? s.slice(0, 72) + '…' : s
  }
  const s = String(val)
  return s.length > 90 ? s.slice(0, 90) + '…' : s
}

function EvidenceTable({ data }: { data: unknown[] }) {
  if (data.length === 0)
    return <p className="text-xs text-[#A1A1AA] italic py-2">No records returned.</p>

  const first = data[0]
  if (typeof first !== 'object' || first === null)
    return <pre className="text-[11px] font-mono text-[#4B5563] bg-[#F8F8F6] p-3 rounded-lg overflow-auto max-h-32">{String(first)}</pre>

  const allKeys = Object.keys(first as object).filter(k => !k.startsWith('@'))
  const cols    = allKeys.slice(0, 7)
  const rows    = data.slice(0, 15)

  if (cols.length === 0)
    return <p className="text-xs text-[#A1A1AA] italic py-2">Metadata-only response.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-[#E9E5DD]">
      <table className="w-full text-[11px] font-mono min-w-max">
        <thead>
          <tr className="bg-[#F0EDE6]">
            {cols.map(c => (
              <th key={c} className="px-3 py-2 text-left text-[#6B7280] font-semibold whitespace-nowrap border-r border-[#E9E5DD] last:border-r-0">
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
                  className="px-3 py-1.5 text-[#374151] border-r border-[#E9E5DD] last:border-r-0 max-w-[220px] truncate"
                  title={String((row as Record<string, unknown>)[col] ?? '')}
                >
                  {cellVal((row as Record<string, unknown>)[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 15 && (
        <div className="px-3 py-1.5 bg-[#F8F8F6] border-t border-[#E9E5DD] text-[11px] text-[#A1A1AA]">
          Showing 15 of {data.length} records
        </div>
      )}
    </div>
  )
}

function EvidenceBlock({ ev }: { ev: EvidenceResult }) {
  const ts = ev.collectedAt ? new Date(ev.collectedAt).toLocaleTimeString() : null

  return (
    <div className="space-y-2.5">
      {/* Query header */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className={`mt-0.5 shrink-0 ${ev.success ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
          {ev.success
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <AlertCircle  className="w-3.5 h-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#18181B] leading-snug">{ev.queryDescription}</p>
          <p className="text-[10px] font-mono text-[#6B7280] mt-0.5 break-all">{ev.endpoint}</p>
        </div>
      </div>

      {/* Metadata chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full font-medium">
          {ev.recordCount} {ev.recordCount === 1 ? 'record' : 'records'}
        </span>
        {ts && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#9CA3AF]">
            <Clock className="w-2.5 h-2.5" />
            {ts}
          </span>
        )}
      </div>

      {/* Data table or error */}
      {ev.success
        ? <EvidenceTable data={ev.rawData ?? []} />
        : <p className="text-xs text-[#DC2626] italic bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {ev.errorMessage ?? 'Query failed'}
          </p>
      }
    </div>
  )
}

// ── EvidenceDrawer ───────────────────────────────────────────────────────────

interface Props {
  assessment: ControlAssessment | null
  onClose:    () => void
}

export function EvidenceDrawer({ assessment, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent background scroll while open
  useEffect(() => {
    if (assessment) document.body.style.overflow = 'hidden'
    else            document.body.style.overflow  = ''
    return ()       => { document.body.style.overflow = '' }
  }, [assessment])

  if (!assessment) return null

  const queries   = assessment.evidenceCollected ?? []
  const hasData   = queries.some(e => e.success && e.rawData?.length > 0)
  const collected = assessment.assessedAt
    ? new Date(assessment.assessedAt).toLocaleString()
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[540px] z-50 bg-white border-l border-[#E9E5DD] flex flex-col animate-slide-in-right"
           style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.12)' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[#E9E5DD] bg-[#FAFAF8] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center shrink-0 mt-0.5">
            <Database className="w-4 h-4 text-[#6366F1]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-2 py-0.5 rounded">
                {assessment.controlId}
              </span>
              <StatusBadge status={assessment.status} size="sm" />
            </div>
            <p className="text-[13px] font-semibold text-[#18181B] leading-snug">{assessment.controlTitle}</p>
            {assessment.family && (
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{assessment.family}</p>
            )}
            {collected && (
              <p className="text-[10px] text-[#C4BFB5] mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Collected {collected}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F0EDE6] text-[#9CA3AF] hover:text-[#18181B] shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Stats bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#F0EDE6] bg-white shrink-0">
          <span className="text-[11px] text-[#6B7280]">
            <span className="font-semibold text-[#18181B]">{queries.length}</span> {queries.length === 1 ? 'query' : 'queries'} run
          </span>
          <span className="text-[11px] text-[#6B7280]">
            <span className="font-semibold text-[#18181B]">
              {queries.reduce((sum, e) => sum + (e.recordCount ?? 0), 0)}
            </span> total records
          </span>
          {!hasData && (
            <span className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-full">
              No data returned
            </span>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {queries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
              <Database className="w-8 h-8 text-[#E9E5DD]" />
              <p className="text-sm text-[#C4BFB5]">No evidence collected for this control.</p>
              <p className="text-xs text-[#D4CFC5]">Run a fresh assessment to capture evidence.</p>
            </div>
          ) : (
            queries.map(ev => (
              <div key={ev.queryId} className="border-b border-[#F0EDE6] pb-6 last:border-0 last:pb-0">
                <EvidenceBlock ev={ev} />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
