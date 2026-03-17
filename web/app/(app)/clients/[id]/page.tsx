'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, RefreshCw, CheckCircle2,
  Loader2, BarChart2, Shield, Plug, Layers, FileText,
  Calendar, Activity, ChevronDown, ChevronUp, AlertTriangle,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import {
  getClients, testClient, getReports,
  getCAExclusions, justifyCAExclusion, getAccessReviews,
  getClientIntegrations, getClientScoping, saveClientScoping,
  saveClientNotes,
} from '@/lib/api'
import type { CAPolicy, CAExclusionsResult, AccessReviewsResult } from '@/lib/api'
import type { Client, ReportMeta, ClientIntegration } from '@/lib/types'

type Tab = 'overview' | 'insights' | 'integrations' | 'scoping' | 'notes'

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all ${
        active
          ? 'border-[#1c1d1f] text-[#1c1d1f]'
          : 'border-transparent text-[#6f7988] hover:text-[#505967] hover:border-[#e4e7ec]'
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

  const scoreColor = (pct: number) =>
    pct >= 80 ? '#0eb472' : pct >= 50 ? '#f59e0b' : '#f25757'

  return (
    <div className="space-y-4">
      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e4e7ec] px-5 py-10 text-center">
          <Shield className="w-8 h-8 text-[#e4e7ec] mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No assessments yet</p>
          <p className="text-[12px] text-[#6f7988]">Run an assessment from the Assess page to see results here.</p>
        </div>
      ) : (
        Object.entries(byFramework).map(([fwId, fwReports]) => {
          const sorted = [...fwReports].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
          const latest = sorted[0]
          const pct = latest.summary.compliancePercentage
          return (
            <div key={fwId} className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#eeeff1]">
                <div>
                  <p className="text-[13px] font-semibold text-[#1c1d1f]">{latest.frameworkName}</p>
                  <p className="text-[11px] text-[#6f7988] mt-0.5">{sorted.length} assessment{sorted.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-[24px] font-bold tabular-nums" style={{ color: scoreColor(pct), letterSpacing: '-0.02em' }}>
                    {pct}%
                  </p>
                  <p className="text-[10px] text-[#a4adba] font-medium uppercase tracking-wide">Compliance</p>
                </div>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {sorted.slice(0, 5).map(r => (
                  <Link
                    key={r.reportId}
                    href={`/assess/${r.reportId}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#1c1d1f] font-medium">
                        {new Date(r.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex gap-2 text-[11px]">
                        <span className="text-[#0eb472]">✓ {r.summary.passed}</span>
                        <span className="text-[#f25757]">✗ {r.summary.failed}</span>
                        <span className="text-[#f59e0b]">~ {r.summary.partial}</span>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: scoreColor(r.summary.compliancePercentage) }}>
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
  const [caData,    setCAData]    = useState<CAExclusionsResult | null>(null)
  const [arData,    setARData]    = useState<AccessReviewsResult | null>(null)
  const [caLoading, setCALoading] = useState(false)
  const [arLoading, setARLoading] = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [justText,  setJustText]  = useState<Record<string, string>>({})
  const [saving,    setSaving]    = useState<string | null>(null)
  const [arExpanded, setARExpanded] = useState(false)

  const loadCA = useCallback(() => {
    setCALoading(true)
    getCAExclusions(clientId).then(setCAData).catch(console.error).finally(() => setCALoading(false))
  }, [clientId])

  const loadAR = useCallback(() => {
    setARLoading(true)
    getAccessReviews(clientId).then(setARData).catch(console.error).finally(() => setARLoading(false))
  }, [clientId])

  useEffect(() => { loadCA(); loadAR() }, [loadCA, loadAR])

  async function saveJust(policyId: string) {
    setSaving(policyId)
    await justifyCAExclusion(clientId, policyId, justText[policyId] ?? '')
    setSaving(null)
    loadCA()
  }

  return (
    <div className="space-y-4">
      {/* CA Exclusions */}
      <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eeeff1]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(242,87,87,0.10)] flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-[#f25757]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1c1d1f]">Conditional Access Exclusions</p>
              <p className="text-[11px] text-[#6f7988]">
                {caData ? `${caData.total} policies with exclusions · ${caData.withChanges} changed` : '—'}
              </p>
            </div>
          </div>
          <button onClick={loadCA} disabled={caLoading} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#a4adba] ${caLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {caLoading && !caData && (
          <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-[#a4adba]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying Graph API…
          </div>
        )}
        {caData?.policies.length === 0 && (
          <div className="flex items-center gap-3 px-5 py-4">
            <CheckCircle2 className="w-4 h-4 text-[#0eb472] shrink-0" />
            <p className="text-[12px] text-[#505967]">No CA policies have exclusion lists.</p>
          </div>
        )}
        {caData && caData.policies.map((p: CAPolicy) => (
          <div key={p.policyId} className="border-t border-[#f3f4f6]">
            <div
              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors"
              onClick={() => setExpanded(e => e === p.policyId ? null : p.policyId)}
            >
              {p.changed
                ? <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-full border border-[#e4e7ec] shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#1c1d1f] truncate">{p.policyName}</p>
                <p className="text-[11px] text-[#6f7988]">
                  {p.excludedUsers.length} users · {p.excludedGroups.length} groups excluded
                  {p.changed && <span className="ml-2 text-[#f59e0b] font-semibold">Changed</span>}
                </p>
              </div>
              {p.justification
                ? <span className="text-[10px] text-[#0eb472] bg-[rgba(14,180,114,0.08)] px-2 py-0.5 rounded-full shrink-0 font-medium">Justified</span>
                : <span className="text-[10px] text-[#f59e0b] bg-[rgba(245,158,11,0.08)] px-2 py-0.5 rounded-full shrink-0 font-medium">Needs review</span>}
              {expanded === p.policyId ? <ChevronUp className="w-3.5 h-3.5 text-[#a4adba] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[#a4adba] shrink-0" />}
            </div>
            {expanded === p.policyId && (
              <div className="px-5 pb-4 bg-[#fafafa] border-t border-[#f3f4f6]">
                {p.justification && (
                  <div className="mt-3 mb-3 p-3 bg-[rgba(14,180,114,0.05)] border border-[rgba(14,180,114,0.2)] rounded-lg">
                    <p className="text-[11px] font-semibold text-[#0eb472] mb-1">Current Justification</p>
                    <p className="text-[12px] text-[#505967]">{p.justification}</p>
                  </div>
                )}
                <p className="text-[11px] font-semibold text-[#6f7988] uppercase tracking-wide mt-3 mb-2">Justification</p>
                <textarea
                  rows={3}
                  className="w-full text-[12px] text-[#1c1d1f] bg-white border border-[#e4e7ec] rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-[#1c1d1f] transition-colors"
                  placeholder="e.g. Break-glass accounts excluded per IR-3 policy. Reviewed quarterly by CISO."
                  value={justText[p.policyId] ?? p.justification ?? ''}
                  onChange={e => setJustText(prev => ({ ...prev, [p.policyId]: e.target.value }))}
                />
                <button
                  onClick={() => saveJust(p.policyId)}
                  disabled={saving === p.policyId}
                  className="mt-2 text-[12px] font-medium text-white px-4 py-2 rounded-lg transition-colors"
                  style={{ background: '#202124' }}
                >
                  {saving === p.policyId ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Access Reviews */}
      <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eeeff1]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[rgba(79,140,255,0.10)] flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-[#4f8cff]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1c1d1f]">Access Reviews</p>
              <p className="text-[11px] text-[#6f7988]">
                {arData?.supported === false ? 'Requires Entra ID P2'
                 : arData ? `${arData.configured} configured · ${arData.overdue} overdue` : '—'}
              </p>
            </div>
          </div>
          <button onClick={loadAR} disabled={arLoading} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#a4adba] ${arLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {arData?.supported && arData.definitions.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-px bg-[#f3f4f6] border-b border-[#e4e7ec]">
              {[
                { label: 'Configured', value: arData.configured, color: '#1c1d1f' },
                { label: 'On Schedule', value: arData.onSchedule, color: '#0eb472' },
                { label: 'Overdue', value: arData.overdue, color: '#f25757' },
              ].map(s => (
                <div key={s.label} className="bg-white px-4 py-3 text-center">
                  <p className="text-[18px] font-bold tabular-nums" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                  <p className="text-[10px] text-[#a4adba] font-medium uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#fafafa] transition-colors border-t border-[#f3f4f6]" onClick={() => setARExpanded(v => !v)}>
              <span className="text-[12px] font-medium text-[#505967]">View reviews</span>
              {arExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#a4adba]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#a4adba]" />}
            </div>
            {arExpanded && arData.definitions.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 border-t border-[#f3f4f6]">
                <div className={`w-2 h-2 rounded-full shrink-0 ${d.overdue ? 'bg-[#f25757]' : d.onSchedule ? 'bg-[#0eb472]' : 'bg-[#a4adba]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#1c1d1f] truncate">{d.displayName}</p>
                  <p className="text-[11px] text-[#6f7988]">{d.recurrenceType}{d.daysSinceLast !== null && ` · last run ${d.daysSinceLast}d ago`}</p>
                </div>
                {d.overdue ? <span className="text-[10px] font-semibold text-[#f25757]">Overdue</span>
                  : d.onSchedule ? <span className="text-[10px] font-semibold text-[#0eb472]">On track</span>
                  : <span className="text-[10px] text-[#a4adba]">—</span>}
              </div>
            ))}
          </>
        )}
        {arData?.supported === false && <div className="px-5 py-4 text-[12px] text-[#6f7988]">{arData.message}</div>}
        {arLoading && !arData && <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-[#a4adba]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying Identity Governance…</div>}
      </div>
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────
function IntegrationsTab({ clientId }: { clientId: string }) {
  const [integrations, setIntegrations] = useState<ClientIntegration[]>([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    getClientIntegrations(clientId)
      .then(setIntegrations).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <div className="flex items-center gap-2 py-8 text-[12px] text-[#a4adba] justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>

  const connected = integrations.filter(i => i.status === 'connected')
  if (connected.length === 0) return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] px-5 py-10 text-center">
      <Plug className="w-7 h-7 text-[#e4e7ec] mx-auto mb-3" />
      <p className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No integrations connected</p>
      <p className="text-[12px] text-[#6f7988]">Connect Jira, ServiceNow, or other tools from the Integrations page.</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] divide-y divide-[#f3f4f6]">
      {connected.map(i => (
        <div key={i.id} className="flex items-center gap-3 px-5 py-3.5">
          <div className="w-2 h-2 rounded-full bg-[#0eb472] shrink-0" />
          <p className="text-[13px] font-medium text-[#1c1d1f] capitalize">{i.platform}</p>
          <span className="ml-auto text-[11px] text-[#6f7988]">
            {i.connectedAt ? `Connected ${new Date(i.connectedAt).toLocaleDateString()}` : 'Connected'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Scoping Tab ──────────────────────────────────────────────────────────────
const ASSET_CLASSES = [
  { id: 'cui',      label: 'CUI / M365',              desc: 'Systems processing Controlled Unclassified Information', required: true },
  { id: 'spa',      label: 'Security Protection Assets', desc: 'Entra ID, Intune, Defender, MFA infrastructure',  required: true },
  { id: 'iot',      label: 'IoT / Connected Devices',  desc: 'Network-connected sensors, cameras, building automation', required: false },
  { id: 'ot_scada', label: 'OT / SCADA',               desc: 'Industrial control systems, PLCs, SCADA networks',  required: false },
]

function ScopingTab({ clientId }: { clientId: string }) {
  const [scoping,  setScoping]  = useState<Record<string, boolean>>({ cui: true, spa: true, iot: false, ot_scada: false })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    getClientScoping(clientId).then(setScoping).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  async function handleSave() {
    setSaving(true)
    await saveClientScoping(clientId, scoping)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#eeeff1]">
        <p className="text-[13px] font-semibold text-[#1c1d1f]">Asset Scoping</p>
        <p className="text-[11px] text-[#6f7988] mt-0.5">Controls related to out-of-scope asset classes are suppressed.</p>
      </div>
      {loading ? <div className="p-5 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-[#f3f4f6] rounded-xl animate-pulse" />)}</div> : (
        <div className="p-5 space-y-2.5">
          {ASSET_CLASSES.map(cls => {
            const checked = scoping[cls.id] ?? false
            return (
              <div
                key={cls.id}
                onClick={() => !cls.required && setScoping(prev => ({ ...prev, [cls.id]: !prev[cls.id] }))}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${cls.required ? 'cursor-default opacity-75' : 'cursor-pointer'} ${checked ? 'border-[#1c1d1f] bg-[rgba(28,29,31,0.02)]' : 'border-[#e4e7ec] hover:border-[#c8ccd4]'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-[#1c1d1f]' : 'bg-[#f3f4f6]'}`}>
                  <Layers className={`w-4 h-4 ${checked ? 'text-white' : 'text-[#a4adba]'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#1c1d1f]">{cls.label}</p>
                    {cls.required && <span className="text-[10px] text-[#6f7988] bg-[#f3f4f6] px-1.5 py-0.5 rounded font-medium">Required</span>}
                  </div>
                  <p className="text-[11px] text-[#6f7988] mt-0.5">{cls.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${checked ? 'bg-[#1c1d1f] border-[#1c1d1f]' : 'border-[#c8ccd4]'}`}>
                  {checked && <div className="w-1.5 h-1 border-b-2 border-l-2 border-white transform -rotate-45 -translate-y-[1px]" />}
                </div>
              </div>
            )
          })}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-2 py-2.5 rounded-xl text-[13px] font-medium text-white transition-colors"
            style={{ background: saved ? '#0eb472' : '#202124' }}
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
  const [notes,  setNotes]  = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveClientNotes(clientId, notes)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#eeeff1]">
        <p className="text-[13px] font-semibold text-[#1c1d1f]">Client Notes</p>
        <p className="text-[11px] text-[#6f7988] mt-0.5">Internal notes about this client — assessment due dates, open items, context.</p>
      </div>
      <div className="p-5">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={10}
          placeholder="e.g. Assessment due Q2. MFA rollout in progress — expect AC.2.005 to pass next scan. POC: jane@client.com"
          className="w-full text-[13px] text-[#1c1d1f] bg-[#fafafa] border border-[#e4e7ec] rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-[#1c1d1f] transition-colors placeholder-[#a4adba]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 px-5 py-2.5 rounded-xl text-[13px] font-medium text-white transition-colors"
          style={{ background: saved ? '#0eb472' : '#202124' }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [client,  setClient]  = useState<Client | null>(null)
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    Promise.all([getClients(), getReports()])
      .then(([clients, allReports]) => {
        const found = clients.find(c => c.id === id)
        if (!found) { router.replace('/clients'); return }
        setClient(found)
        setReports(allReports.filter(r => r.clientId === id))
      })
      .catch(() => router.replace('/clients'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleTest() {
    if (!client) return
    setTesting(true); setTestResult(null)
    try { setTestResult(await testClient(client.id)) }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Test failed'
      setTestResult({ ok: false, error: msg })
    }
    finally { setTesting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="w-6 h-6 text-[#e4e7ec] animate-spin" />
    </div>
  )
  if (!client) return null

  const lastReport  = reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0]
  const lastScore   = lastReport?.summary.compliancePercentage
  const scoreColor  = !lastScore ? '#a4adba' : lastScore >= 80 ? '#0eb472' : lastScore >= 50 ? '#f59e0b' : '#f25757'

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',     label: 'Overview',     icon: BarChart2  },
    { id: 'insights',     label: 'Insights',     icon: Activity   },
    { id: 'integrations', label: 'Integrations', icon: Plug       },
    { id: 'scoping',      label: 'Scoping',      icon: Layers     },
    { id: 'notes',        label: 'Notes',        icon: FileText   },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6f7988] hover:text-[#1c1d1f] transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> All Clients
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#e4e7ec] px-6 py-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#fafafa] border border-[#e4e7ec] flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-[#505967]" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#1c1d1f]" style={{ letterSpacing: '-0.02em' }}>{client.name}</h1>
              <p className="text-[12px] font-mono text-[#a4adba] mt-0.5">{client.tenantId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastScore !== undefined && (
              <div className="text-right">
                <p className="text-[22px] font-bold tabular-nums" style={{ color: scoreColor, letterSpacing: '-0.02em' }}>{lastScore}%</p>
                <p className="text-[10px] text-[#a4adba] uppercase tracking-wide">Last score</p>
              </div>
            )}
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e4e7ec] text-[12px] font-medium text-[#505967] hover:bg-[#fafafa] transition-colors"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Test
            </button>
            {testResult && (
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${testResult.ok ? 'text-[#0eb472] bg-[rgba(14,180,114,0.08)]' : 'text-[#f25757] bg-[rgba(242,87,87,0.08)]'}`}>
                {testResult.ok ? '● Connected' : '● Failed'}
              </span>
            )}
          </div>
        </div>
        {lastReport && (
          <div className="flex items-center gap-1.5 mt-4 text-[11px] text-[#a4adba]">
            <Clock className="w-3 h-3" />
            Last assessment: {new Date(lastReport.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {lastReport.frameworkName}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e4e7ec] mb-5 -mx-1 px-1 overflow-x-auto">
        {TABS.map(t => (
          <TabButton key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} icon={t.icon} label={t.label} />
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'     && <OverviewTab client={client} reports={reports} />}
      {activeTab === 'insights'     && <InsightsTab clientId={client.id} />}
      {activeTab === 'integrations' && <IntegrationsTab clientId={client.id} />}
      {activeTab === 'scoping'      && <ScopingTab clientId={client.id} />}
      {activeTab === 'notes'        && <NotesTab clientId={client.id} initialNotes={client.notes} />}
    </div>
  )
}
