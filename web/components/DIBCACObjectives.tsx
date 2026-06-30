'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronDown, ChevronRight, ClipboardCheck, Download,
  FileText, Monitor, Package, Building, Zap, RotateCcw,
  CheckCircle2, XCircle, AlertCircle, MinusCircle, Clock,
  HelpCircle, Loader2,
} from 'lucide-react'
import {
  getReportObjectives, attestObjective,
  resetObjectives, exportDIBCACWorksheet,
} from '@/lib/api'
import type {
  EnrichedObjective, ObjectivesResponse, DIBCACObjectiveSummary,
  ObjectiveStatusValue, ObjectiveStandard,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  reportId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<ObjectiveStatusValue, string> = {
  met:               'Met',
  partially_met:     'Partially Met',
  not_met:           'Not Met',
  not_assessed:      'Not Assessed',
  requires_manual:   'Requires Action',
  requires_physical: 'Physical Review',
}

const STATUS_COLOR: Record<ObjectiveStatusValue, string> = {
  met:               'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_met:     'bg-amber-50 text-amber-700 border-amber-200',
  not_met:           'bg-red-50 text-red-700 border-red-200',
  not_assessed:      'bg-slate-50 text-slate-500 border-slate-200',
  requires_manual:   'bg-stone-100 text-stone-700 border-stone-300',
  requires_physical: 'bg-orange-50 text-orange-600 border-orange-200',
}

const STATUS_ICON: Record<ObjectiveStatusValue, React.ReactNode> = {
  met:               <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  partially_met:     <AlertCircle  className="w-3.5 h-3.5 text-amber-500" />,
  not_met:           <XCircle      className="w-3.5 h-3.5 text-red-500" />,
  not_assessed:      <HelpCircle   className="w-3.5 h-3.5 text-slate-400" />,
  requires_manual:   <FileText     className="w-3.5 h-3.5 text-stone-500" />,
  requires_physical: <Building     className="w-3.5 h-3.5 text-orange-500" />,
}

const STANDARD_STYLE: Record<ObjectiveStandard, { cls: string; icon: React.ReactNode; label: string }> = {
  'Document':                { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',  icon: <FileText className="w-3 h-3" />,  label: 'Document'      },
  'Screen Share':            { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Monitor className="w-3 h-3" />, label: 'Screen Share'  },
  'Artifact':                { cls: 'bg-amber-50 text-amber-700 border-amber-200',     icon: <Package className="w-3 h-3" />,   label: 'Artifact'      },
  'Physical Review':         { cls: 'bg-orange-50 text-orange-700 border-orange-200',  icon: <Building className="w-3 h-3" />,  label: 'Physical'      },
  'Artifact and Screen Share': { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Zap className="w-3 h-3" />,     label: 'Hybrid'        },
}

const AUTOMATION_STYLE: Record<string, { cls: string; label: string }> = {
  automated:      { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Auto' },
  'semi-automated': { cls: 'bg-amber-50  text-amber-600  border-amber-200',   label: 'Semi' },
  manual:         { cls: 'bg-slate-50  text-slate-500  border-slate-200',     label: 'Manual' },
  physical:       { cls: 'bg-orange-50 text-orange-600 border-orange-200',    label: 'Physical' },
}

function StatusBadge({ status }: { status: ObjectiveStatusValue }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLOR[status]}`}>
      {STATUS_ICON[status]}
      {STATUS_LABEL[status]}
    </span>
  )
}

function StandardBadge({ standard }: { standard: ObjectiveStandard }) {
  const s = STANDARD_STYLE[standard]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------

function SummaryBar({ s }: { s: DIBCACObjectiveSummary }) {
  const segments = [
    { label: 'Met',            value: s.met,             color: '#059669' },
    { label: 'Partial',        value: s.partiallyMet,    color: '#D97706' },
    { label: 'Not Met',        value: s.notMet,          color: '#DC2626' },
    { label: 'Needs Action',   value: s.requiresManual,  color: '#2563EB' },
    { label: 'Physical',       value: s.requiresPhysical, color: '#EA580C' },
    { label: 'Not Assessed',   value: s.notAssessed,     color: '#d6d3d1' },
  ]

  const pct = s.coveragePercentage
  const pctColor = pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626'

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold text-faint uppercase tracking-widest">
            DIBCAC 320 Assessment Objectives
          </p>
          <p className="text-xs text-muted mt-0.5">NIST SP 800-171A · {s.total} total objectives</p>
        </div>
        <div className="text-right">
          <span className="font-bold tabular-nums" style={{ fontSize: 28, color: pctColor }}>
            {pct}<span className="text-base text-faint font-medium">%</span>
          </span>
          <p className="text-[10px] text-faint">Coverage</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden mb-4 bg-[#F3F4F6]">
        {segments.filter(seg => seg.value > 0).map(seg => (
          <div
            key={seg.label}
            style={{ width: `${(seg.value / s.total) * 100}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {segments.map(seg => (
          <div key={seg.label} className="text-center">
            <div className="text-base font-bold tabular-nums" style={{ color: seg.color }}>{seg.value}</div>
            <div className="text-[9px] text-faint leading-tight">{seg.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Attestation Modal
// ---------------------------------------------------------------------------

interface AttestModalProps {
  objective: EnrichedObjective
  onClose: () => void
  onSave: (text: string, status: ObjectiveStatusValue) => Promise<void>
}

function AttestModal({ objective, onClose, onSave }: AttestModalProps) {
  const [text, setText]     = useState(objective.status.attestationText ?? '')
  const [docName, setDocName] = useState(objective.status.documentName ?? '')
  const [status, setStatus] = useState<ObjectiveStatusValue>(
    objective.status.status === 'requires_manual' || objective.status.status === 'not_assessed'
      ? 'met'
      : objective.status.status
  )
  const [saving, setSaving] = useState(false)

  const statusOptions: { value: ObjectiveStatusValue; label: string }[] = [
    { value: 'met',          label: 'Met — objective is fully satisfied' },
    { value: 'partially_met', label: 'Partially Met — some gaps remain' },
    { value: 'not_met',      label: 'Not Met — objective is not satisfied' },
    { value: 'not_applicable', label: 'N/A — not applicable to this system' } as any,
  ]

  async function handleSave() {
    setSaving(true)
    await onSave(text, status)
    setSaving(false)
    onClose()
  }

  const isPhysical = objective.automation === 'physical'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-5 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-300 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4 text-stone-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-mono font-bold text-ink">{objective.objectiveId}</span>
                <StandardBadge standard={objective.standard} />
              </div>
              <p className="text-xs text-muted leading-relaxed">{objective.text}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {isPhysical ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-xs text-orange-700 leading-relaxed">
              <p className="font-semibold mb-1">⚠ Physical Review Required</p>
              <p>This objective requires an on-site DIBCAC physical inspection. You can add notes about your physical controls below, but this objective must be verified in person by a DIBCAC assessor.</p>
            </div>
          ) : null}

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-2">Objective Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ObjectiveStatusValue)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 bg-surface text-ink"
            >
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Attestation text */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-2">
              {objective.standard === 'Document' ? 'Policy / Document Description' : 'Attestation / Evidence Notes'}
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder={
                objective.standard === 'Document'
                  ? 'Describe the policy or document that satisfies this objective…'
                  : 'Describe the evidence or configuration that satisfies this objective…'
              }
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 resize-none bg-surface text-ink placeholder-[#d6d3d1]"
            />
          </div>

          {/* Document reference */}
          {(objective.standard === 'Document' || objective.standard === 'Artifact') && (
            <div>
              <label className="block text-xs font-semibold text-ink mb-2">Document Reference (optional)</label>
              <input
                type="text"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="e.g. System Security Plan v2.1, IR Plan Rev 3…"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 bg-surface text-ink placeholder-[#d6d3d1]"
              />
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-muted bg-canvas hover:bg-surface-sunken rounded-lg transition border border-border"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-ink hover:bg-ink disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Attestation
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Objective Row
// ---------------------------------------------------------------------------

function ObjectiveRow({
  obj,
  onAttest,
}: {
  obj: EnrichedObjective
  onAttest: (o: EnrichedObjective) => void
}) {
  const st = AUTOMATION_STYLE[obj.automation] ?? AUTOMATION_STYLE.manual
  const canAttest = obj.automation !== 'automated'
  const isPhy     = obj.automation === 'physical'

  return (
    <div className={`flex items-start gap-3 py-2.5 px-3 rounded-lg border transition ${
      isPhy
        ? 'bg-orange-50/40 border-orange-100'
        : obj.status.status === 'requires_manual' || obj.status.status === 'not_assessed'
          ? 'bg-stone-100/30 border-stone-200 hover:bg-stone-100/60'
          : obj.status.status === 'met'
            ? 'bg-emerald-50/30 border-emerald-100'
            : 'bg-surface border-border-subtle hover:bg-canvas'
    }`}>
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">{STATUS_ICON[obj.status.status]}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] font-mono font-bold text-muted">{obj.objectiveId}</span>
          <StandardBadge standard={obj.standard} />
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <p className="text-[12px] text-ink leading-snug">{obj.text}</p>

        {/* Attestation text / doc ref */}
        {obj.status.attestationText && (
          <p className="text-[11px] text-muted italic mt-1.5 bg-surface/60 rounded px-2 py-1 border border-border">
            "{obj.status.attestationText.slice(0, 120)}{obj.status.attestationText.length > 120 ? '…' : ''}"
          </p>
        )}
        {obj.status.documentName && !obj.status.attestationText && (
          <p className="text-[11px] text-muted mt-1">
            📄 {obj.status.documentName}
          </p>
        )}
      </div>

      {/* Attest button */}
      {canAttest && (
        <button
          onClick={() => onAttest(obj)}
          className={`shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition ${
            obj.status.status === 'met'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : isPhy
                ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                : 'bg-surface text-ink border-border hover:bg-canvas'
          }`}
        >
          {obj.status.status === 'met' ? 'Edit' : isPhy ? 'Notes' : 'Attest'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Domain Section
// ---------------------------------------------------------------------------

function DomainSection({
  domain,
  domainName,
  objectives,
  defaultOpen,
  onAttest,
}: {
  domain: string
  domainName: string
  objectives: EnrichedObjective[]
  defaultOpen: boolean
  onAttest: (o: EnrichedObjective) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  const met      = objectives.filter(o => o.status.status === 'met').length
  const partial  = objectives.filter(o => o.status.status === 'partially_met').length
  const needsAction = objectives.filter(o =>
    o.status.status === 'requires_manual' || o.status.status === 'not_met' || o.status.status === 'not_assessed'
  ).length
  const physical = objectives.filter(o => o.status.status === 'requires_physical').length

  return (
    <div className="bg-surface rounded-xl border border-border shadow-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-canvas transition text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-faint shrink-0" /> : <ChevronRight className="w-4 h-4 text-faint shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-faint">{domain}</span>
            <span className="text-[13px] font-semibold text-ink">{domainName}</span>
            <span className="text-[11px] text-faint">({objectives.length} objectives)</span>
          </div>
        </div>
        {/* mini stats */}
        <div className="flex items-center gap-2 shrink-0">
          {met > 0      && <span className="text-[10px] font-bold text-emerald-600">{met} met</span>}
          {partial > 0  && <span className="text-[10px] font-bold text-amber-500">{partial} partial</span>}
          {needsAction > 0 && <span className="text-[10px] font-bold text-stone-600">{needsAction} needs action</span>}
          {physical > 0 && <span className="text-[10px] font-bold text-orange-500">{physical} physical</span>}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 space-y-1.5">
          {objectives.map(obj => (
            <ObjectiveRow key={obj.objectiveId} obj={obj} onAttest={onAttest} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type ObjectiveFilter = 'all' | 'needs_action' | 'met' | 'physical' | 'not_met'

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DIBCACObjectives({ reportId }: Props) {
  const [data, setData]             = useState<ObjectivesResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [attesting, setAttesting]   = useState<EnrichedObjective | null>(null)
  const [resetting, setResetting]   = useState(false)
  const [filter, setFilter]         = useState<ObjectiveFilter>('all')

  const loadObjectives = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const d = await getReportObjectives(reportId)
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load objectives')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => { loadObjectives() }, [loadObjectives])

  async function handleAttest(text: string, status: ObjectiveStatusValue) {
    if (!attesting) return
    await attestObjective(reportId, attesting.objectiveId, {
      attestationText: text || undefined,
      status,
    })
    await loadObjectives()
  }

  async function handleReset() {
    if (!confirm('Reset all objective statuses back to auto-initialized state? Manual attestations will be lost.')) return
    setResetting(true)
    try {
      await resetObjectives(reportId)
      await loadObjectives()
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-faint" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-700">Failed to load DIBCAC objectives</p>
          <p className="text-xs text-red-600 mt-0.5">{error}</p>
          <button onClick={loadObjectives} className="text-xs text-red-700 underline mt-1">Retry</button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Apply filter
  const filterFn = (obj: EnrichedObjective): boolean => {
    if (filter === 'all') return true
    if (filter === 'needs_action')
      return obj.status.status === 'requires_manual' || obj.status.status === 'not_met' || obj.status.status === 'not_assessed'
    if (filter === 'met')    return obj.status.status === 'met' || obj.status.status === 'partially_met'
    if (filter === 'physical') return obj.status.status === 'requires_physical'
    if (filter === 'not_met') return obj.status.status === 'not_met'
    return true
  }

  // Group by domain
  const byDomain: Record<string, EnrichedObjective[]> = {}
  for (const obj of data.objectives.filter(filterFn)) {
    (byDomain[obj.domain] ??= []).push(obj)
  }
  const domains = Object.keys(byDomain).sort()

  const filterOptions = ([
    { value: 'all'          as ObjectiveFilter, label: 'All',          count: data.objectives.length,                                                                                         color: 'text-ink' },
    { value: 'needs_action' as ObjectiveFilter, label: 'Needs Action', count: data.summary.requiresManual + data.summary.notAssessed + data.summary.notMet,                                  color: 'text-stone-600' },
    { value: 'met'          as ObjectiveFilter, label: 'Met',          count: data.summary.met + data.summary.partiallyMet,                                                                  color: 'text-emerald-600' },
    { value: 'not_met'      as ObjectiveFilter, label: 'Not Met',      count: data.summary.notMet,                                                                                           color: 'text-red-600' },
    { value: 'physical'     as ObjectiveFilter, label: 'Physical',     count: data.summary.requiresPhysical,                                                                                 color: 'text-orange-500' },
  ] as { value: ObjectiveFilter; label: string; count: number; color: string }[]).filter(f => f.count > 0 || f.value === 'all')

  return (
    <div>
      {/* Attestation modal */}
      {attesting && (
        <AttestModal
          objective={attesting}
          onClose={() => setAttesting(null)}
          onSave={handleAttest}
        />
      )}

      {/* Summary bar */}
      <SummaryBar s={data.summary} />

      {/* Action bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-card flex-wrap">
          {filterOptions.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition ${
                filter === f.value
                  ? 'bg-ink text-on-accent shadow-sm'
                  : `${f.color} hover:text-ink`
              }`}
            >
              {f.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                filter === f.value ? 'bg-surface/20 text-white' : 'bg-surface-sunken text-faint'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Export + Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportDIBCACWorksheet(reportId)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted bg-surface hover:bg-canvas border border-border px-3 py-2 rounded-lg transition shadow-card"
          >
            <Download className="w-3.5 h-3.5" />
            Export DIBCAC CSV
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-faint hover:text-muted bg-surface hover:bg-canvas border border-border px-3 py-2 rounded-lg transition shadow-card disabled:opacity-50"
          >
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reset
          </button>
        </div>
      </div>

      {/* Physical Review notice */}
      {data.summary.requiresPhysical > 0 && (filter === 'all' || filter === 'physical') && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
          <Building className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-700">
              {data.summary.requiresPhysical} objectives require on-site DIBCAC physical inspection
            </p>
            <p className="text-xs text-orange-600 mt-0.5 leading-relaxed">
              Physical Review objectives (PE, MA, MP domains) cannot be assessed remotely.
              These are verified in-person by DIBCAC assessors during the on-site assessment.
              You can add notes about your physical controls using the "Notes" button on each objective.
            </p>
          </div>
        </div>
      )}

      {/* Document objectives notice */}
      {data.summary.requiresManual > 0 && (filter === 'all' || filter === 'needs_action') && (
        <div className="flex items-start gap-3 bg-stone-100 border border-stone-300 rounded-xl px-4 py-3 mb-4">
          <FileText className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-stone-700">
              {data.summary.requiresManual} objectives require manual attestation or document upload
            </p>
            <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
              Document and Artifact objectives need policy descriptions, SSP content, training records,
              IR plans, or other documentation. Use the "Attest" button on each objective to provide evidence.
            </p>
          </div>
        </div>
      )}

      {/* Domain sections */}
      {domains.length === 0 ? (
        <div className="text-center py-12 text-faint text-sm bg-surface rounded-xl border border-border shadow-card">
          No objectives match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain, i) => {
            const objs = byDomain[domain]!
            const domainName = objs[0]?.domainName ?? domain
            // Open domains that have items needing action, or the first domain
            const hasNeedsAction = objs.some(o =>
              o.status.status === 'requires_manual' || o.status.status === 'not_met' || o.status.status === 'not_assessed'
            )
            return (
              <DomainSection
                key={domain}
                domain={domain}
                domainName={domainName}
                objectives={objs}
                defaultOpen={i === 0 || hasNeedsAction || filter !== 'all'}
                onAttest={setAttesting}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
