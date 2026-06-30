'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertCircle, Clock, Lightbulb, Search,
         ExternalLink, Upload, Trash2, FileIcon, Loader2, Paperclip,
         CloudUpload, Shield, Database } from 'lucide-react'
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

// ── Status badge config ─────────────────────────────────────────────────────

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pass:           { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Pass' },
  fail:           { bg: 'bg-red-100',     text: 'text-[#9f403d]',  label: 'Fail' },
  partial:        { bg: 'bg-amber-100',   text: 'text-amber-800',  label: 'Partial' },
  not_assessed:   { bg: 'bg-surface-sunken',   text: 'text-faint',  label: 'N/A' },
  not_applicable: { bg: 'bg-surface-sunken',   text: 'text-faint',  label: 'N/A' },
}

// ── Evidence table for Graph query data ─────────────────────────────────────

function EvidenceTable({ data, title }: { data: unknown[]; title?: string }) {
  if (data.length === 0)
    return <p className="text-xs text-muted italic py-2">No records returned.</p>

  const first = data[0]
  if (typeof first !== 'object' || first === null)
    return <pre className="text-[11px] font-mono text-ink bg-canvas p-3 rounded-lg overflow-auto max-h-32">{String(first)}</pre>

  const allKeys = Object.keys(first as object).filter(k => !k.startsWith('@'))
  const cols    = allKeys.slice(0, 7)
  const rows    = data.slice(0, 15)

  if (cols.length === 0)
    return <p className="text-xs text-muted italic py-2">Metadata-only response.</p>

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {title && (
        <div className="bg-surface-sunken p-3 border-b border-border">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-muted">{title}</h4>
        </div>
      )}
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-canvas">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-4 py-2 font-bold text-muted border-b border-[#a8a29e]/10 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#a8a29e]/10">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-canvas/50 transition-colors">
              {cols.map((col, ci) => (
                <td
                  key={col}
                  className={`px-4 py-3 max-w-[220px] truncate ${ci === 0 ? 'font-mono text-[10px] text-ink' : 'text-ink'}`}
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
        <div className="px-4 py-2 bg-canvas border-t border-[#a8a29e]/10 text-[11px] text-muted">
          Showing 15 of {data.length} records
        </div>
      )}
    </div>
  )
}

// ── File upload section ───────────────────────────────────────────────────────

function FileUploadSection({ reportId, objectiveId }: { reportId: string; objectiveId: string }) {
  const [files,     setFiles]     = useState<EvidenceFileMeta[]>([])
  const [loading,   setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [dragOver,  setDragOver]  = useState(false)
  const [ready,     setReady]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load existing evidence files when the section mounts
  useEffect(() => {
    setReady(true)
    let cancelled = false
    getEvidenceFiles(reportId, objectiveId).then(result => {
      if (!cancelled) setFiles(result)
    })
    return () => { cancelled = true }
  }, [reportId, objectiveId])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const uploaded: EvidenceFileMeta[] = []
      for (const file of Array.from(fileList)) {
        if (file.size > 5 * 1024 * 1024) { setError(`${file.name} exceeds 5 MB limit`); continue }
        const meta = await uploadEvidenceFile(reportId, objectiveId, file)
        uploaded.push(meta)
      }
      // Add newly uploaded files to the list immediately
      if (uploaded.length > 0) {
        setFiles(prev => [...uploaded, ...prev])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed — the evidence_files table may not exist in Supabase')
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
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group',
          dragOver
            ? 'border-[#1c1917] bg-ink/5'
            : 'border-border bg-surface hover:bg-canvas',
        ].join(' ')}
      >
        {uploading
          ? <Loader2 className="w-10 h-10 text-faint animate-spin mb-2" />
          : <CloudUpload className="w-10 h-10 text-faint group-hover:text-ink mb-2 transition-colors" />
        }
        <p className="text-sm font-semibold text-ink">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
        </p>
        <p className="text-xs text-muted mt-1">
          {files.length === 0 ? 'No files uploaded yet' : `${files.length} file${files.length !== 1 ? 's' : ''} uploaded`}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {error && (
        <p className="text-[11px] text-[#9f403d] bg-[#fe8983]/10 border border-[#fe8983]/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-faint" />
        </div>
      ) : files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map(f => (
            <li
              key={f.id}
              className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 group"
            >
              <FileIcon className="w-3.5 h-3.5 text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => downloadEvidenceFile(reportId, objectiveId, f.id, f.originalName)}
                  className="text-[12px] font-medium text-ink hover:text-ink truncate block max-w-full text-left"
                  title={f.originalName}
                >
                  {f.originalName}
                </button>
                <p className="text-[10px] text-faint">
                  {formatBytes(f.fileSize)} · {new Date(f.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                className="p-1 rounded hover:bg-[#fe8983]/10 text-faint hover:text-[#9f403d] opacity-0 group-hover:opacity-100 transition"
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
    <section>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
        <span className="text-faint">{icon}</span> {label}
      </h3>
      {children}
    </section>
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
    ? new Date(assessment.assessedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    : null

  const portalLinks     = getPortalLinks(assessment.controlId)
  const showRemediation = portalLinks.length > 0 && (assessment.status === 'fail' || assessment.status === 'partial')
  const hasData         = queries.some(e => e.success && (e.rawData?.length ?? 0) > 0)

  const badge = statusConfig[assessment.status] ?? statusConfig.not_assessed

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 bottom-0 right-0 w-full max-w-[600px] h-screen z-[9999] bg-surface shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* ── Glass Header ── */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border" style={{ backdropFilter: 'blur(20px)', backgroundColor: 'rgba(255,255,255,0.85)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono tracking-wider text-ink bg-[#e7e5e4]/30 px-2 py-0.5 rounded">
                {assessment.controlId}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${badge.bg} ${badge.text} px-2 py-0.5 rounded-full flex items-center gap-1`}>
                {badge.label === 'Pass' && <CheckCircle2 className="w-3 h-3" style={{ fill: 'currentColor', strokeWidth: 0 }} />}
                {badge.label === 'Fail' && <AlertCircle className="w-3 h-3" />}
                {badge.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-2xl font-bold text-ink leading-tight">{assessment.controlTitle}</h2>
          <div className="mt-1 flex items-center gap-4">
            {assessment.family && (
              <span className="text-sm font-medium text-muted">{assessment.family}</span>
            )}
            {assessment.family && collected && (
              <span className="h-1 w-1 bg-[#a8a29e] rounded-full" />
            )}
            {collected && (
              <span className="text-sm font-medium text-muted">
                Collection Date: <span className="text-ink">{collected}</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-10">

          {/* 1. Findings */}
          {assessment.findings.length > 0 && (
            <Section icon={<Search className="w-4 h-4" />} label="Findings">
              <div className="p-4 bg-canvas rounded-lg border-l-2 border-[#1c1917]">
                {assessment.findings.map((f, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink">
                    {f}{i < assessment.findings.length - 1 ? ' ' : ''}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* 2. Recommendations */}
          {assessment.recommendations.length > 0 && (
            <Section icon={<Lightbulb className="w-4 h-4" />} label="Recommendations">
              <div className="p-4 bg-canvas rounded-lg">
                {assessment.recommendations.map((r, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink">
                    {r}{i < assessment.recommendations.length - 1 ? ' ' : ''}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* 3. Remediate in Azure */}
          {showRemediation && (
            <Section icon={<ExternalLink className="w-4 h-4" />} label="Remediation Actions">
              <div className="flex flex-wrap gap-2">
                {portalLinks.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-b from-[#1c1917] to-[#0c0a09] px-4 py-2 rounded shadow-md hover:shadow-lg transition"
                    title={link.hint}
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* 4. Evidence file upload */}
          {reportId && (
            <Section icon={<Paperclip className="w-4 h-4" />} label="Uploaded Evidence Files">
              <FileUploadSection reportId={reportId} objectiveId={assessment.controlId} />
            </Section>
          )}

          {/* 5. Graph Evidence */}
          <Section
            icon={<Database className="w-4 h-4" />}
            label="Graph Evidence"
          >
            <div className="space-y-6">
              {/* Query / Record count badges */}
              <div className="flex gap-4">
                <span className="text-[10px] font-bold text-ink px-2 py-0.5 bg-[#e7e5e4] rounded">
                  {queries.length} {queries.length === 1 ? 'Query' : 'Queries'}
                </span>
                <span className="text-[10px] font-bold text-faint px-2 py-0.5 bg-[#e7e5e4] rounded">
                  {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
                </span>
              </div>

              {queries.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center">
                  <Database className="w-10 h-10 text-faint mb-2" />
                  <p className="text-sm font-semibold text-ink">No automated evidence</p>
                  <p className="text-xs text-muted mt-1">No Graph API queries were executed for this control.</p>
                </div>
              ) : !hasData ? (
                <div className="space-y-4">
                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#B45309]">
                    Queries ran but returned no data. May indicate insufficient permissions or no matching records.
                  </div>
                  {queries.map(ev => (
                    <div key={ev.queryId} className="space-y-2">
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="bg-surface-sunken p-3 border-b border-border">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-muted">{ev.queryDescription}</h4>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {ev.success
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              : <AlertCircle className="w-3.5 h-3.5 text-[#9f403d]" />
                            }
                            <p className="text-[10px] font-mono text-muted break-all">{ev.endpoint}</p>
                          </div>
                          <span className="text-[10px] text-ink bg-[#e7e5e4] px-2 py-0.5 rounded font-bold">
                            {ev.recordCount} {ev.recordCount === 1 ? 'record' : 'records'}
                          </span>
                          {!ev.success && (
                            <p className="text-xs text-[#9f403d] italic mt-2">{ev.errorMessage ?? 'Query failed'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                queries.map(ev => (
                  <div key={ev.queryId} className="space-y-2">
                    {ev.success && (ev.rawData?.length ?? 0) > 0 ? (
                      <EvidenceTable data={ev.rawData ?? []} title={ev.queryDescription} />
                    ) : (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="bg-surface-sunken p-3 border-b border-border">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-muted">{ev.queryDescription}</h4>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-2">
                            {ev.success
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              : <AlertCircle className="w-3.5 h-3.5 text-[#9f403d]" />
                            }
                            <p className="text-xs text-muted">
                              {ev.success ? `${ev.recordCount} records returned` : (ev.errorMessage ?? 'Query failed')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Section>

        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 p-4 border-t border-border bg-surface flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted hover:bg-surface-sunken rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-white rounded shadow-md"
            style={{ background: 'linear-gradient(180deg, #1c1917 0%, #0c0a09 100%)' }}
          >
            Save
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
