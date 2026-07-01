'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Loader2,
  BarChart2,
  Shield,
  Plug,
  Layers,
  FileText,
  Calendar,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  getClients,
  testClient,
  getReports,
  getCAExclusions,
  justifyCAExclusion,
  getAccessReviews,
  getClientIntegrations,
  getClientScoping,
  saveClientScoping,
  saveClientNotes,
} from '@/lib/api'
import type { CAPolicy, CAExclusionsResult, AccessReviewsResult } from '@/lib/api'
import type { Client, ReportMeta, ClientIntegration } from '@/lib/types'

type Tab = 'overview' | 'insights' | 'integrations' | 'scoping' | 'notes' | 'maturity'

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all ${
        active
          ? 'border-[#1c1d1f] text-ink'
          : 'border-transparent text-faint hover:text-muted hover:border-border'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ client, reports }: { client: Client; reports: ReportMeta[] }) {
  const byFramework: Record<string, ReportMeta[]> = {}
  for (const r of reports) {
    if (!byFramework[r.frameworkId]) byFramework[r.frameworkId] = []
    byFramework[r.frameworkId].push(r)
  }

  const scoreColor = (pct: number) => (pct >= 80 ? '#0eb472' : pct >= 50 ? '#f59e0b' : '#f25757')

  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border px-5 py-10 text-center">
          <Shield className="w-8 h-8 text-[#e7e5e4] mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-ink mb-1">No assessments yet</p>
          <p className="text-[12px] text-faint">
            Run an assessment from the Assess page to see results here.
          </p>
        </div>
      ) : (
        Object.entries(byFramework).map(([fwId, fwReports]) => {
          const sorted = [...fwReports].sort(
            (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
          )
          const latest = sorted[0]
          const pct = latest.summary.compliancePercentage
          return (
            <div key={fwId} className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div>
                  <p className="text-[13px] font-semibold text-ink">{latest.frameworkName}</p>
                  <p className="text-[11px] text-faint mt-0.5">
                    {sorted.length} assessment{sorted.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-[24px] font-bold tabular-nums"
                    style={{ color: scoreColor(pct), letterSpacing: '-0.02em' }}
                  >
                    {pct}%
                  </p>
                  <p className="text-[10px] text-faint font-medium uppercase tracking-wide">
                    Compliance
                  </p>
                </div>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {sorted.slice(0, 5).map((r) => (
                  <Link
                    key={r.reportId}
                    href={`/assess/${r.reportId}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-canvas transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-ink font-medium">
                        {new Date(r.generatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex gap-2 text-[11px]">
                        <span className="text-[#0eb472]">✓ {r.summary.passed}</span>
                        <span className="text-[#f25757]">✗ {r.summary.failed}</span>
                        <span className="text-[#f59e0b]">~ {r.summary.partial}</span>
                      </div>
                      <span
                        className="text-[13px] font-bold tabular-nums"
                        style={{ color: scoreColor(r.summary.compliancePercentage) }}
                      >
                        {r.summary.compliancePercentage}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────
function InsightsTab({ clientId }: { clientId: string }) {
  const [caData, setCAData] = useState<CAExclusionsResult | null>(null)
  const [arData, setARData] = useState<AccessReviewsResult | null>(null)
  const [caLoading, setCALoading] = useState(false)
  const [arLoading, setARLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [justText, setJustText] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [arExpanded, setARExpanded] = useState(false)

  const loadCA = useCallback(() => {
    setCALoading(true)
    getCAExclusions(clientId)
      .then(setCAData)
      .catch(console.error)
      .finally(() => setCALoading(false))
  }, [clientId])

  const loadAR = useCallback(() => {
    setARLoading(true)
    getAccessReviews(clientId)
      .then(setARData)
      .catch(console.error)
      .finally(() => setARLoading(false))
  }, [clientId])

  useEffect(() => {
    loadCA()
    loadAR()
  }, [loadCA, loadAR])

  async function saveJust(policyId: string) {
    setSaving(policyId)
    await justifyCAExclusion(clientId, policyId, justText[policyId] ?? '')
    setSaving(null)
    loadCA()
  }

  return (
    <div className="space-y-4">
      {/* CA Exclusions */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(242,87,87,0.10)] flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-[#f25757]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink">Conditional Access Exclusions</p>
              <p className="text-[11px] text-faint">
                {caData
                  ? `${caData.total} policies with exclusions · ${caData.withChanges} changed`
                  : '—'}
              </p>
            </div>
          </div>
          <button
            onClick={loadCA}
            disabled={caLoading}
            className="p-1.5 rounded-lg hover:bg-surface-sunken transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-faint ${caLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {caLoading && !caData && (
          <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-faint">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying Graph API…
          </div>
        )}
        {caData?.policies.length === 0 && (
          <div className="flex items-center gap-3 px-5 py-4">
            <CheckCircle2 className="w-4 h-4 text-[#0eb472] shrink-0" />
            <p className="text-[12px] text-muted">No CA policies have exclusion lists.</p>
          </div>
        )}
        {caData &&
          caData.policies.map((p: CAPolicy) => (
            <div key={p.policyId} className="border-t border-[#f3f4f6]">
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-canvas transition-colors"
                onClick={() => setExpanded((e) => (e === p.policyId ? null : p.policyId))}
              >
                {p.changed ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-ink truncate">{p.policyName}</p>
                  <p className="text-[11px] text-faint">
                    {p.excludedUsers.length} users · {p.excludedGroups.length} groups excluded
                    {p.changed && (
                      <span className="ml-2 text-[#f59e0b] font-semibold">Changed</span>
                    )}
                  </p>
                </div>
                {p.justification ? (
                  <span className="text-[10px] text-[#0eb472] bg-[rgba(14,180,114,0.08)] px-2 py-0.5 rounded-full shrink-0 font-medium">
                    Justified
                  </span>
                ) : (
                  <span className="text-[10px] text-[#f59e0b] bg-[rgba(245,158,11,0.08)] px-2 py-0.5 rounded-full shrink-0 font-medium">
                    Needs review
                  </span>
                )}
                {expanded === p.policyId ? (
                  <ChevronUp className="w-3.5 h-3.5 text-faint shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-faint shrink-0" />
                )}
              </div>
              {expanded === p.policyId && (
                <div className="px-5 pb-4 bg-canvas border-t border-[#f3f4f6]">
                  {p.justification && (
                    <div className="mt-3 mb-3 p-3 bg-[rgba(14,180,114,0.05)] border border-[rgba(14,180,114,0.2)] rounded-lg">
                      <p className="text-[11px] font-semibold text-[#0eb472] mb-1">
                        Current Justification
                      </p>
                      <p className="text-[12px] text-muted">{p.justification}</p>
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-faint uppercase tracking-wide mt-3 mb-2">
                    Justification
                  </p>
                  <textarea
                    rows={3}
                    className="w-full text-[12px] text-ink bg-surface border border-border rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-[#1c1d1f] transition-colors"
                    placeholder="e.g. Break-glass accounts excluded per IR-3 policy. Reviewed quarterly by CISO."
                    value={justText[p.policyId] ?? p.justification ?? ''}
                    onChange={(e) =>
                      setJustText((prev) => ({ ...prev, [p.policyId]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => saveJust(p.policyId)}
                    disabled={saving === p.policyId}
                    className="mt-2 text-[12px] font-medium text-white px-4 py-2 rounded-lg transition-colors"
                    style={{ background: '#1c1917' }}
                  >
                    {saving === p.policyId ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Access Reviews */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(79,140,255,0.10)] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-faint" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink">Access Reviews</p>
              <p className="text-[11px] text-faint">
                {arData?.supported === false
                  ? 'Requires Entra ID P2'
                  : arData
                    ? `${arData.configured} configured · ${arData.overdue} overdue`
                    : '—'}
              </p>
            </div>
          </div>
          <button
            onClick={loadAR}
            disabled={arLoading}
            className="p-1.5 rounded-lg hover:bg-surface-sunken transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-faint ${arLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {arData?.supported && arData.definitions.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-px bg-surface-sunken border-b border-border">
              {[
                { label: 'Configured', value: arData.configured, color: '#1c1d1f' },
                { label: 'On Schedule', value: arData.onSchedule, color: '#0eb472' },
                { label: 'Overdue', value: arData.overdue, color: '#f25757' },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-4 py-3 text-center">
                  <p
                    className="text-[18px] font-bold tabular-nums"
                    style={{ color: s.color, letterSpacing: '-0.02em' }}
                  >
                    {s.value}
                  </p>
                  <p className="text-[10px] text-faint font-medium uppercase tracking-wide">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-canvas transition-colors border-t border-[#f3f4f6]"
              onClick={() => setARExpanded((v) => !v)}
            >
              <span className="text-[12px] font-medium text-muted">View reviews</span>
              {arExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-faint" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-faint" />
              )}
            </div>
            {arExpanded &&
              arData.definitions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-5 py-3 border-t border-[#f3f4f6]"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${d.overdue ? 'bg-[#f25757]' : d.onSchedule ? 'bg-[#0eb472]' : 'bg-[#a8a29e]'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-ink truncate">{d.displayName}</p>
                    <p className="text-[11px] text-faint">
                      {d.recurrenceType}
                      {d.daysSinceLast !== null && ` · last run ${d.daysSinceLast}d ago`}
                    </p>
                  </div>
                  {d.overdue ? (
                    <span className="text-[10px] font-semibold text-[#f25757]">Overdue</span>
                  ) : d.onSchedule ? (
                    <span className="text-[10px] font-semibold text-[#0eb472]">On track</span>
                  ) : (
                    <span className="text-[10px] text-faint">—</span>
                  )}
                </div>
              ))}
          </>
        )}
        {arData?.supported === false && (
          <div className="px-5 py-4 text-[12px] text-faint">{arData.message}</div>
        )}
        {arLoading && !arData && (
          <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-faint">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying Identity Governance…
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────
function IntegrationsTab({ clientId }: { clientId: string }) {
  const [integrations, setIntegrations] = useState<ClientIntegration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClientIntegrations(clientId)
      .then(setIntegrations)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading)
    return (
      <div className="flex items-center gap-2 py-8 text-[12px] text-faint justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    )

  const connected = integrations.filter((i) => i.status === 'connected')
  if (connected.length === 0)
    return (
      <div className="bg-surface rounded-xl border border-border px-5 py-10 text-center">
        <Plug className="w-7 h-7 text-[#e7e5e4] mx-auto mb-3" />
        <p className="text-[13px] font-semibold text-ink mb-1">No integrations connected</p>
        <p className="text-[12px] text-faint">
          Connect Jira, ServiceNow, or other tools from the Integrations page.
        </p>
      </div>
    )

  return (
    <div className="bg-surface rounded-xl border border-border divide-y divide-[#f3f4f6]">
      {connected.map((i) => (
        <div key={i.id} className="flex items-center gap-3 px-5 py-3.5">
          <div className="w-2 h-2 rounded-full bg-[#0eb472] shrink-0" />
          <p className="text-[13px] font-medium text-ink capitalize">{i.platform}</p>
          <span className="ml-auto text-[11px] text-faint">
            {i.connectedAt
              ? `Connected ${new Date(i.connectedAt).toLocaleDateString()}`
              : 'Connected'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Scoping Tab ──────────────────────────────────────────────────────────────
const ASSET_CLASSES = [
  {
    id: 'cui',
    label: 'CUI / M365',
    desc: 'Systems processing Controlled Unclassified Information',
    required: true,
  },
  {
    id: 'spa',
    label: 'Security Protection Assets',
    desc: 'Entra ID, Intune, Defender, MFA infrastructure',
    required: true,
  },
  {
    id: 'iot',
    label: 'IoT / Connected Devices',
    desc: 'Network-connected sensors, cameras, building automation',
    required: false,
  },
  {
    id: 'ot_scada',
    label: 'OT / SCADA',
    desc: 'Industrial control systems, PLCs, SCADA networks',
    required: false,
  },
]

function ScopingTab({ clientId }: { clientId: string }) {
  const [scoping, setScoping] = useState<Record<string, boolean>>({
    cui: true,
    spa: true,
    iot: false,
    ot_scada: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getClientScoping(clientId)
      .then(setScoping)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleSave() {
    setSaving(true)
    await saveClientScoping(clientId, scoping)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <p className="text-[13px] font-semibold text-ink">Asset Scoping</p>
        <p className="text-[11px] text-faint mt-0.5">
          Controls related to out-of-scope asset classes are suppressed.
        </p>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-surface-sunken rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="p-5 space-y-2.5">
          {ASSET_CLASSES.map((cls) => {
            const checked = scoping[cls.id] ?? false
            return (
              <div
                key={cls.id}
                onClick={() =>
                  !cls.required && setScoping((prev) => ({ ...prev, [cls.id]: !prev[cls.id] }))
                }
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${cls.required ? 'cursor-default opacity-75' : 'cursor-pointer'} ${checked ? 'border-[#1c1917] bg-[rgba(37,93,173,0.02)]' : 'border-border hover:border-border-strong'}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-ink' : 'bg-surface-sunken'}`}
                >
                  <Layers className={`w-4 h-4 ${checked ? 'text-white' : 'text-faint'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-ink">{cls.label}</p>
                    {cls.required && (
                      <span className="text-[10px] text-faint bg-surface-sunken px-1.5 py-0.5 rounded font-medium">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-faint mt-0.5">{cls.desc}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${checked ? 'bg-ink border-[#1c1917]' : 'border-border-strong'}`}
                >
                  {checked && (
                    <div className="w-1.5 h-1 border-b-2 border-l-2 border-white transform -rotate-45 -translate-y-[1px]" />
                  )}
                </div>
              </div>
            )
          })}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-2 py-2.5 rounded-xl text-[13px] font-medium text-white transition-colors"
            style={{ background: saved ? '#0eb472' : '#1c1917' }}
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Scoping'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({ clientId, initialNotes }: { clientId: string; initialNotes?: string }) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveClientNotes(clientId, notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <p className="text-[13px] font-semibold text-ink">Client Notes</p>
        <p className="text-[11px] text-faint mt-0.5">
          Internal notes about this client — assessment due dates, open items, context.
        </p>
      </div>
      <div className="p-5">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={10}
          placeholder="e.g. Assessment due Q2. MFA rollout in progress — expect AC.2.005 to pass next scan. POC: jane@client.com"
          className="w-full text-[13px] text-ink bg-canvas border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-[#1c1d1f] transition-colors placeholder-[#a8a29e]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 px-5 py-2.5 rounded-xl text-[13px] font-medium text-white transition-colors"
          style={{ background: saved ? '#0eb472' : '#1c1917' }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

// ─── Maturity Tab ─────────────────────────────────────────────────────────────
interface MaturityPoint {
  compliancePercentage: number
  snapshottedAt: string
  frameworkId: string
  riskScore: string
  passed: number
  failed: number
}

interface DriftEvent {
  id: string
  control_id: string
  control_title: string
  prior_status: string
  new_status: string
  direction: string
  framework_id: string
  acknowledged_at: string | null
  created_at: string
}

function MaturityTab({ clientId }: { clientId: string }) {
  const [seriesMap, setSeriesMap] = useState<Record<string, MaturityPoint[]>>({})
  const [driftEvents, setDrift] = useState<DriftEvent[]>([])
  const [activeFramework, setFw] = useState<string | null>(null)
  const [loadingData, setLoading] = useState(true)
  const [schedule, setSchedule] = useState<{
    cron_expression?: string
    enabled?: boolean
    next_run_at?: string
  } | null>(null)
  const [savingSched, setSavingSched] = useState(false)
  const [schedCron, setSchedCron] = useState('0 2 * * 1')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [summaryRes, driftRes, schedRes] = await Promise.all([
        fetch(`/api/maturity?clientId=${clientId}`),
        fetch(`/api/drift?clientId=${clientId}&limit=20`),
        fetch(`/api/schedules?clientId=${clientId}`),
      ])
      if (cancelled) return

      if (summaryRes.ok) {
        const summary: Record<string, MaturityPoint> = await summaryRes.json()
        const frameworks = Object.keys(summary)
        if (frameworks.length > 0) {
          // Load full time series for each framework
          const seriesEntries = await Promise.all(
            frameworks.map(async (fw) => {
              const res = await fetch(`/api/maturity?clientId=${clientId}&frameworkId=${fw}`)
              if (!res.ok) return [fw, []] as [string, MaturityPoint[]]
              return [fw, await res.json()] as [string, MaturityPoint[]]
            })
          )
          const newMap: Record<string, MaturityPoint[]> = {}
          for (const [fw, points] of seriesEntries) newMap[fw] = points
          if (!cancelled) {
            setSeriesMap(newMap)
            setFw((prev) => prev ?? frameworks[0])
          }
        }
      }

      if (driftRes.ok && !cancelled) setDrift(await driftRes.json())

      if (schedRes.ok && !cancelled) {
        const scheds: Record<string, unknown>[] = await schedRes.json()
        if (scheds.length > 0) {
          setSchedule(
            scheds[0] as { cron_expression?: string; enabled?: boolean; next_run_at?: string }
          )
          setSchedCron((scheds[0].cron_expression as string) ?? '0 2 * * 1')
        }
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  const handleSaveSchedule = async () => {
    if (!activeFramework) return
    setSavingSched(true)
    await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, frameworkId: activeFramework, cronExpression: schedCron }),
    })
    setSavingSched(false)
  }

  const handleAcknowledge = async (id: string) => {
    await fetch('/api/drift', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDrift((prev) =>
      prev.map((e) => (e.id === id ? { ...e, acknowledged_at: new Date().toISOString() } : e))
    )
  }

  const frameworks = Object.keys(seriesMap)
  const series = activeFramework ? (seriesMap[activeFramework] ?? []) : []
  const chartData = series.map((p) => ({
    date: new Date(p.snapshottedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: p.compliancePercentage,
  }))

  const latestScore = series.length > 0 ? series[series.length - 1].compliancePercentage : null
  const prevScore = series.length > 1 ? series[series.length - 2].compliancePercentage : null
  const delta = latestScore !== null && prevScore !== null ? latestScore - prevScore : null

  const regressions = driftEvents.filter((e) => e.direction === 'regression' && !e.acknowledged_at)
  const improvements = driftEvents.filter((e) => e.direction === 'improvement')

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-faint" />
      </div>
    )
  }

  if (frameworks.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border px-5 py-12 text-center">
        <TrendingUp className="w-8 h-8 text-[#e7e5e4] mx-auto mb-3" />
        <p className="text-[13px] font-semibold text-ink mb-1">No maturity data yet</p>
        <p className="text-[12px] text-faint">
          Run at least two assessments to see your compliance trend.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Framework selector + score summary */}
      <div className="bg-surface rounded-xl border border-border px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {frameworks.map((fw) => (
              <button
                key={fw}
                onClick={() => setFw(fw)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  activeFramework === fw
                    ? 'bg-ink text-on-accent'
                    : 'bg-canvas border border-border text-muted hover:bg-surface-sunken'
                }`}
              >
                {fw.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {latestScore !== null && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p
                  className="text-[28px] font-bold tabular-nums"
                  style={{
                    color:
                      latestScore >= 80 ? '#0eb472' : latestScore >= 50 ? '#f59e0b' : '#f25757',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {latestScore}%
                </p>
                <p className="text-[10px] text-faint uppercase tracking-wide">Current</p>
              </div>
              {delta !== null && (
                <div
                  className={`flex items-center gap-1 text-[13px] font-semibold ${delta > 0 ? 'text-[#0eb472]' : delta < 0 ? 'text-[#f25757]' : 'text-faint'}`}
                >
                  {delta > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : delta < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                  {delta > 0 ? '+' : ''}
                  {delta}pp
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line chart */}
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#a8a29e' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#a8a29e' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e7e5e4',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, 'Compliance']}
              />
              <ReferenceLine y={80} stroke="#0eb472" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#1c1917"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1c1917' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[12px] text-faint text-center py-8">
            Run another assessment to see the trend line.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Drift events */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-ink">Control Drift</p>
              <p className="text-[11px] text-faint mt-0.5">Status changes between runs</p>
            </div>
            {regressions.length > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-[rgba(242,87,87,0.08)] text-[#f25757]">
                {regressions.length} regression{regressions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="divide-y divide-[#f5f5f4] max-h-64 overflow-y-auto">
            {driftEvents.length === 0 ? (
              <p className="text-[12px] text-faint px-5 py-6 text-center">No drift detected yet.</p>
            ) : (
              driftEvents.slice(0, 10).map((e) => (
                <div
                  key={e.id}
                  className={`px-5 py-3 flex items-start justify-between gap-3 ${e.acknowledged_at ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {e.direction === 'regression' ? (
                      <TrendingDown className="w-3.5 h-3.5 text-[#f25757] mt-0.5 shrink-0" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-[#0eb472] mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink truncate">{e.control_title}</p>
                      <p className="text-[11px] text-faint">
                        {e.prior_status} → {e.new_status} ·{' '}
                        {new Date(e.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!e.acknowledged_at && (
                    <button
                      onClick={() => handleAcknowledge(e.id)}
                      className="shrink-0 text-[11px] text-faint hover:text-ink transition-colors"
                    >
                      Ack
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <p className="text-[13px] font-semibold text-ink">Assessment Schedule</p>
            <p className="text-[11px] text-faint mt-0.5">Automated recurring assessment</p>
          </div>
          <div className="p-5 space-y-4">
            {schedule?.next_run_at && (
              <div className="flex items-center gap-2 text-[12px] text-faint">
                <Clock className="w-3.5 h-3.5" />
                Next run: {new Date(schedule.next_run_at).toLocaleString()}
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium text-faint uppercase tracking-wide block mb-1.5">
                Cron expression
              </label>
              <div className="flex gap-2">
                <select
                  value={schedCron}
                  onChange={(e) => setSchedCron(e.target.value)}
                  className="flex-1 text-[12px] bg-canvas border border-border rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-border-strong"
                >
                  <option value="0 2 * * 1">Weekly — Monday 2am UTC</option>
                  <option value="0 2 * * *">Daily — 2am UTC</option>
                  <option value="0 2 1 * *">Monthly — 1st 2am UTC</option>
                </select>
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSched || !activeFramework}
                  className="px-4 py-2 rounded-lg text-[12px] font-medium bg-ink text-on-accent hover:bg-[#2c2a28] disabled:opacity-50 transition-colors"
                >
                  {savingSched ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>
              {!activeFramework && (
                <p className="text-[11px] text-faint mt-1.5">
                  Select a framework above to schedule.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    Promise.all([getClients(), getReports()])
      .then(([clients, allReports]) => {
        const found = clients.find((c) => c.id === id)
        if (!found) {
          router.replace('/clients')
          return
        }
        setClient(found)
        setReports(allReports.filter((r) => r.clientId === id))
      })
      .catch(() => router.replace('/clients'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleTest() {
    if (!client) return
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await testClient(client.id))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Test failed'
      setTestResult({ ok: false, error: msg })
    } finally {
      setTesting(false)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-[#e7e5e4] animate-spin" />
      </div>
    )
  if (!client) return null

  const lastReport = reports.sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )[0]
  const lastScore = lastReport?.summary.compliancePercentage
  const scoreColor = !lastScore
    ? '#a8a29e'
    : lastScore >= 80
      ? '#0eb472'
      : lastScore >= 50
        ? '#f59e0b'
        : '#f25757'

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'maturity', label: 'Maturity', icon: TrendingUp },
    { id: 'insights', label: 'Insights', icon: Activity },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'scoping', label: 'Scoping', icon: Layers },
    { id: 'notes', label: 'Notes', icon: FileText },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-faint hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Connect
      </Link>

      {/* Header */}
      <div className="bg-surface rounded-xl border border-border px-6 py-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-canvas border border-border flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-muted" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>
                {client.name}
              </h1>
              <p className="text-[12px] font-mono text-faint mt-0.5">{client.tenantId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastScore !== undefined && (
              <div className="text-right">
                <p
                  className="text-[22px] font-bold tabular-nums"
                  style={{ color: scoreColor, letterSpacing: '-0.02em' }}
                >
                  {lastScore}%
                </p>
                <p className="text-[10px] text-faint uppercase tracking-wide">Last score</p>
              </div>
            )}
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-medium text-muted hover:bg-canvas transition-colors"
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Test
            </button>
            {testResult && (
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${testResult.ok ? 'text-[#0eb472] bg-[rgba(14,180,114,0.08)]' : 'text-[#f25757] bg-[rgba(242,87,87,0.08)]'}`}
              >
                {testResult.ok ? '● Connected' : '● Failed'}
              </span>
            )}
          </div>
        </div>
        {lastReport && (
          <div className="flex items-center gap-1.5 mt-4 text-[11px] text-faint">
            <Clock className="w-3 h-3" />
            Last assessment:{' '}
            {new Date(lastReport.generatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            · {lastReport.frameworkName}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5 -mx-1 px-1 overflow-x-auto">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            active={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            icon={t.icon}
            label={t.label}
          />
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab client={client} reports={reports} />}
      {activeTab === 'maturity' && <MaturityTab clientId={client.id} />}
      {activeTab === 'insights' && <InsightsTab clientId={client.id} />}
      {activeTab === 'integrations' && <IntegrationsTab clientId={client.id} />}
      {activeTab === 'scoping' && <ScopingTab clientId={client.id} />}
      {activeTab === 'notes' && <NotesTab clientId={client.id} initialNotes={client.notes} />}
    </div>
  )
}
