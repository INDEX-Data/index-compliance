'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { X, Database, CheckCircle2, AlertCircle, Clock, Lightbulb, FileSearch,
         ExternalLink, Upload, Trash2, FileIcon, Loader2, Paperclip } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { getPortalLinks } from '@/lib/portal-links'
import { getEvidenceFiles, uploadEvidenceFile, deleteEvidenceFile, downloadEvidenceFile } from '@/lib/api'
import type { EvidenceFileMeta } from '@/lib/api'
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function EvidenceTable({ data }: { data: unknown[] }) {
  if (data.length === 0)
    return <p className="text-xs text-[#6f7988] italic py-2">No records returned.</p>

  const first = data[0]
  if (typeof first !== 'object' || first === null)
    return <pre className="text-[11px] font-mono text-[#505967] bg-[#fafafa] p-3 rounded-lg overflow-auto max-h-32">{String(first)}</pre>

  const allKeys = Object.keys(first as object).filter(k => !k.startsWith('@'))
  const cols    = allKeys.slice(0, 7)
  const rows    = data.slice(0, 15)

  if (cols.length === 0)
    return <p className="text-xs text-[#6f7988] italic py-2">Metadata-only response.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e4e7ec]">
      <table className="w-full text-[11px] font-mono min-w-max">
        <thead>
          <tr className="bg-[#eeeff1]">
            {cols.map(c => (
              <th key={c} className="px-3 py-2 text-left text-[#505967] font-semibold whitespace-nowrap border-r border-[#e4e7ec] last:border-r-0">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
              {cols.map(col => (
                <td
                  key={col}
                  className="px-3 py-1.5 text-[#1c1d1f] border-r border-[#e4e7ec] last:border-r-0 max-w-[220px] truncate"
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
        <div className="px-3 py-1.5 bg-[#fafafa] border-t border-[#e4e7ec] text-[11px] text-[#6f7988]">
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
      <div className="flex items-start gap-2 flex-wrap">
        <span className={`mt-0.5 shrink-0 ${ev.success ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
          {ev.success
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <AlertCircle  className="w-3.5 h-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#1c1d1f] leading-snug">{ev.queryDescription}</p>
          <p className="text-[10px] font-mono text-[#505967] mt-0.5 break-all">{ev.endpoint}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full font-medium">
          {ev.recordCount} {ev.recordCount === 1 ? 'record' : 'records'}
        </span>
        {ts && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#6f7988]">
            <Clock className="w-2.5 h-2.5" />
            {ts}
          </span>
        )}
      </div>

      {ev.success
        ? <EvidenceTable data={ev.rawData ?? []} />
        : <p className="text-xs text-[#DC2626] italic bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {ev.errorMessage ?? 'Query failed'}
          </p>
      }
    </div>
  )
}

// ── File upload section ───────────────────────────────────────────────────────

function FileUploadSection({ reportId, objectiveId }: { reportId: string; objectiveId: string }) {
  const [files,     setFiles]     = useState<EvidenceFileMeta[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [dragOver,  setDragOver]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    getEvidenceFiles(reportId, objectiveId)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [reportId, objectiveId])

  useEffect(() => { load() }, [load])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        if (file.size > 5 * 1024 * 1024) { setError(`${file.name} exceeds 5 MB limit`); continue }
        await uploadEvidenceFile(reportId, objectiveId, file)
      }
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await deleteEvidenceFile(reportId, objectiveId, fileId)
      setFiles(f => f.filter(x => x.id !== fileId))
    } catch {
      setError('Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
          dragOver
            ? 'border-[#C4A96D] bg-[#C4A96D]/5'
            : 'border-[#e4e7ec] hover:border-[#cad0d9] bg-[#fafafa] hover:bg-white',
        ].join(' ')}
      >
        {uploading
          ? <Loader2 className="w-4 h-4 text-[#6f7988] animate-spin" />
          : <Upload className="w-4 h-4 text-[#a4adba]" />
        }
        <p className="text-[11px] text-[#6f7988]">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
        </p>
        <p className="text-[10px] text-[#a4adba]">PDF, DOCX, PNG, JPG — max 5 MB each</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {error && (
        <p className="text-[11px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-[#a4adba]" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-[11px] text-[#a4adba] italic text-center py-1">No files uploaded yet</p>
      ) : (
        <ul className="space-y-1.5">
          {files.map(f => (
            <li
              key={f.id}
              className="flex items-center gap-2 bg-white border border-[#e4e7ec] rounded-lg px-3 py-2 group"
            >
              <FileIcon className="w-3.5 h-3.5 text-[#6f7988] shrink-0" />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => downloadEvidenceFile(reportId, objectiveId, f.id, f.originalName)}
                  className="text-[12px] font-medium text-[#1c1d1f] hover:text-[#266df0] truncate block max-w-full text-left"
                  title={f.originalName}
                >
                  {f.originalName}
                </button>
                <p className="text-[10px] text-[#a4adba]">
                  {formatBytes(f.fileSize)} · {new Date(f.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                className="p-1 rounded hover:bg-[#FEF2F2] text-[#a4adba] hover:text-[#DC2626] opacity-0 group-hover:opacity-100 transition"
                title="Delete file"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[#6f7988]">{icon}</span>
        <h3 className="text-[11px] font-semibold text-[#505967] uppercase tracking-wider">{label}</h3>
      </div>
      {children}
    </div>
  )
}

// ── EvidenceDrawer ───────────────────────────────────────────────────────────

interface Props {
  assessment: ControlAssessment | null
  onClose:    () => void
  reportId?:  string
}

export function EvidenceDrawer({ assessment, onClose, reportId }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (assessment) document.body.style.overflow = 'hidden'
    else            document.body.style.overflow  = ''
    return ()       => { document.body.style.overflow = '' }
  }, [assessment])

  if (!assessment) return null

  const queries         = assessment.evidenceCollected ?? []
  const totalRecords    = queries.reduce((sum, e) => sum + (e.recordCount ?? 0), 0)
  const collected       = assessment.assessedAt
    ? new Date(assessment.assessedAt).toLocaleString()
    : null

  const portalLinks     = getPortalLinks(assessment.controlId)
  const showRemediation = portalLinks.length > 0 && (assessment.status === 'fail' || assessment.status === 'partial')
  const hasData         = queries.some(e => e.success && (e.rawData?.length ?? 0) > 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[560px] z-50 bg-white border-l border-[#e4e7ec] flex flex-col animate-slide-in-right"
        style={{ boxShadow: '-8px 0 40px rgba(28,29,31,0.10)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[#e4e7ec] bg-[#fafafa] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-2 py-0.5 rounded">
                {assessment.controlId}
              </span>
              <StatusBadge status={assessment.status} size="sm" />
            </div>
            <p className="text-[13px] font-semibold text-[#1c1d1f] leading-snug">{assessment.controlTitle}</p>
            {assessment.family && (
              <p className="text-[11px] text-[#6f7988] mt-0.5">{assessment.family}</p>
            )}
            {collected && (
              <p className="text-[10px] text-[#a4adba] mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Collected {collected}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#eeeff1] text-[#6f7988] hover:text-[#1c1d1f] shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* 1. Remediate in Azure */}
          {showRemediation && (
            <Section icon={<ExternalLink className="w-3.5 h-3.5" />} label="Remediate in Azure">
              <div className="flex flex-wrap gap-2">
                {portalLinks.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6D28D9] bg-[#F5F3FF] border border-[#DDD6FE] hover:bg-[#EDE9FE] hover:border-[#C4B5FD] px-3 py-1.5 rounded-lg transition-colors"
                    title={link.hint}
                  >
                    {link.label}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* 2. Findings */}
          {assessment.findings.length > 0 && (
            <Section icon={<AlertCircle className="w-3.5 h-3.5" />} label="Findings">
              <ul className="space-y-2">
                {assessment.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {assessment.status === 'pass'
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                        : <AlertCircle  className="w-3.5 h-3.5 text-[#D97706]" />}
                    </span>
                    <p className="text-[12px] text-[#1c1d1f] leading-relaxed">{f}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 3. Recommendations */}
          {assessment.recommendations.length > 0 && (
            <Section icon={<Lightbulb className="w-3.5 h-3.5" />} label="Recommendations">
              <ul className="space-y-2">
                {assessment.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 text-[#6f7988] text-[12px] leading-relaxed">→</span>
                    <p className="text-[12px] text-[#1c1d1f] leading-relaxed">{r}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 4. Evidence file upload */}
          {reportId && (
            <Section icon={<Paperclip className="w-3.5 h-3.5" />} label="Uploaded Evidence Files">
              <FileUploadSection reportId={reportId} objectiveId={assessment.controlId} />
            </Section>
          )}

          {/* 5. Automated evidence */}
          <Section
            icon={<FileSearch className="w-3.5 h-3.5" />}
            label={`Graph Evidence — ${queries.length} ${queries.length === 1 ? 'query' : 'queries'}, ${totalRecords} ${totalRecords === 1 ? 'record' : 'records'}`}
          >
            {queries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 gap-3 text-center">
                <Database className="w-7 h-7 text-[#e4e7ec]" />
                <p className="text-sm text-[#a4adba]">No automated evidence for this control.</p>
              </div>
            ) : !hasData ? (
              <div className="space-y-4">
                <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2 rounded-lg">
                  Queries ran but returned no data. May indicate insufficient permissions or no matching records.
                </p>
                {queries.map(ev => (
                  <div key={ev.queryId} className="border-b border-[#eeeff1] pb-4 last:border-0 last:pb-0">
                    <EvidenceBlock ev={ev} />
                  </div>
                ))}
              </div>
            ) : (
              queries.map(ev => (
                <div key={ev.queryId} className="border-b border-[#eeeff1] pb-6 last:border-0 last:pb-0">
                  <EvidenceBlock ev={ev} />
                </div>
              ))
            )}
          </Section>

        </div>
      </div>
    </>
  )
}
