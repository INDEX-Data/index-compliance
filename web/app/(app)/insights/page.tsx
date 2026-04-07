'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Loader2, Calendar } from 'lucide-react'
import { getClients, getCAExclusions, justifyCAExclusion, getAccessReviews } from '@/lib/api'
import type { CAExclusionsResult, CAPolicy, AccessReviewsResult } from '@/lib/api'
import type { Client } from '@/lib/types'

// ─── CA Exclusion Panel ───────────────────────────────────────────────────────
function CAExclusionPanel({ clientId }: { clientId: string }) {
  const [data,     setData]     = useState<CAExclusionsResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [justText, setJustText] = useState<Record<string, string>>({})
  const [saving,   setSaving]   = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getCAExclusions(clientId)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function saveJustification(policyId: string) {
    setSaving(policyId)
    await justifyCAExclusion(clientId, policyId, justText[policyId] ?? '')
    setSaving(null)
    load()
  }

  return (
    <div className="bg-white rounded-xl border border-[#e7e5e4] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f5f5f4]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(242,87,87,0.10)] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#f25757]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1c1d1f]">Conditional Access Exclusions</p>
            <p className="text-[11px] text-[#78716c]">
              {data ? `${data.total} policies with exclusions · ${data.withChanges} changed since last scan` : 'Scanning…'}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-[#a8a29e] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-[#a8a29e]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying Graph API…
        </div>
      )}

      {data && data.policies.length === 0 && (
        <div className="flex items-center gap-3 px-5 py-4">
          <CheckCircle2 className="w-4 h-4 text-[#0eb472] shrink-0" />
          <p className="text-[12px] text-[#505967]">No Conditional Access policies have exclusion lists.</p>
        </div>
      )}

      {data && data.policies.length > 0 && (
        <div className="divide-y divide-[#f3f4f6]">
          {data.policies.map((p: CAPolicy) => (
            <div key={p.policyId}>
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors"
                onClick={() => setExpanded(e => e === p.policyId ? null : p.policyId)}
              >
                {p.changed ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-[#e7e5e4] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#1c1d1f] truncate">{p.policyName}</p>
                  <p className="text-[11px] text-[#78716c]">
                    {p.excludedUsers.length} user{p.excludedUsers.length !== 1 ? 's' : ''} · {p.excludedGroups.length} group{p.excludedGroups.length !== 1 ? 's' : ''} excluded
                    {p.changed && <span className="ml-2 text-[#f59e0b] font-semibold">Changed</span>}
                  </p>
                </div>
                {p.justification
                  ? <span className="text-[10px] text-[#0eb472] font-medium bg-[rgba(14,180,114,0.08)] px-2 py-0.5 rounded-full shrink-0">Justified</span>
                  : <span className="text-[10px] text-[#f59e0b] font-medium bg-[rgba(245,158,11,0.08)] px-2 py-0.5 rounded-full shrink-0">Needs review</span>
                }
                {expanded === p.policyId ? <ChevronUp className="w-3.5 h-3.5 text-[#a8a29e] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[#a8a29e] shrink-0" />}
              </div>

              {expanded === p.policyId && (
                <div className="px-5 pb-4 bg-[#fafafa] border-t border-[#f3f4f6]">
                  {p.justification && (
                    <div className="mt-3 mb-3 p-3 bg-[rgba(14,180,114,0.05)] border border-[rgba(14,180,114,0.2)] rounded-lg">
                      <p className="text-[11px] font-semibold text-[#0eb472] mb-1">Current Justification</p>
                      <p className="text-[12px] text-[#505967]">{p.justification}</p>
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-[#78716c] uppercase tracking-wide mt-3 mb-2">Add / Update Justification</p>
                  <textarea
                    className="w-full text-[12px] text-[#1c1d1f] bg-white border border-[#e7e5e4] rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-[#1c1d1f] transition-colors"
                    rows={3}
                    placeholder="e.g. Break-glass accounts excluded per IR-3 policy. Reviewed quarterly by CISO."
                    value={justText[p.policyId] ?? p.justification ?? ''}
                    onChange={e => setJustText(prev => ({ ...prev, [p.policyId]: e.target.value }))}
                  />
                  <button
                    onClick={() => saveJustification(p.policyId)}
                    disabled={saving === p.policyId}
                    className="mt-2 text-[12px] font-medium text-white px-4 py-2 rounded-lg transition-colors hover:bg-[#0c0a09]"
                    style={{ background: '#1c1917' }}
                  >
                    {saving === p.policyId ? 'Saving…' : 'Save Justification'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Access Review Panel ──────────────────────────────────────────────────────
function AccessReviewPanel({ clientId }: { clientId: string }) {
  const [data,    setData]    = useState<AccessReviewsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getAccessReviews(clientId)
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-white rounded-xl border border-[#e7e5e4] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f5f5f4]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(79,140,255,0.10)] flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#78716c]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1c1d1f]">Access Reviews</p>
            <p className="text-[11px] text-[#78716c]">
              {data?.supported === false ? 'Requires Entra ID P2 licensing'
               : data ? `${data.configured} configured · ${data.overdue} overdue` : 'Loading…'}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-[#a8a29e] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-[#a8a29e]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying Identity Governance…
        </div>
      )}

      {data?.supported === false && (
        <div className="px-5 py-4 text-[12px] text-[#78716c]">{data.message}</div>
      )}

      {data?.supported && data.definitions.length === 0 && (
        <div className="flex items-center gap-3 px-5 py-4">
          <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0" />
          <p className="text-[12px] text-[#505967]">No access reviews are configured. CMMC AC.3.012 requires periodic access reviews.</p>
        </div>
      )}

      {data?.supported && data.definitions.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-px bg-[#f3f4f6] border-b border-[#e7e5e4]">
            {[
              { label: 'Configured', value: data.configured, color: '#1c1d1f' },
              { label: 'On Schedule', value: data.onSchedule, color: '#0eb472' },
              { label: 'Overdue',     value: data.overdue,    color: '#f25757' },
            ].map(s => (
              <div key={s.label} className="bg-white px-4 py-3 text-center">
                <p className="text-[20px] font-bold tabular-nums" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                <p className="text-[10px] text-[#a8a29e] font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#fafafa] transition-colors"
            onClick={() => setExpanded(v => !v)}
          >
            <span className="text-[12px] font-medium text-[#505967]">View all reviews</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[#a8a29e]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#a8a29e]" />}
          </div>

          {expanded && (
            <div className="border-t border-[#f3f4f6] divide-y divide-[#f3f4f6]">
              {data.definitions.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${d.overdue ? 'bg-[#f25757]' : d.onSchedule ? 'bg-[#0eb472]' : 'bg-[#a8a29e]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1c1d1f] truncate">{d.displayName}</p>
                    <p className="text-[11px] text-[#78716c]">
                      {d.recurrenceType !== 'none' ? d.recurrenceType : 'one-time'}
                      {d.daysSinceLast !== null && ` · last run ${d.daysSinceLast}d ago`}
                    </p>
                  </div>
                  {d.overdue
                    ? <span className="text-[10px] font-semibold text-[#f25757]">Overdue</span>
                    : d.onSchedule
                    ? <span className="text-[10px] font-semibold text-[#0eb472]">On track</span>
                    : <span className="text-[10px] text-[#a8a29e]">—</span>
                  }
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [clients,    setClients]    = useState<Client[]>([])
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    getClients()
      .then(c => { setClients(c); if (c.length > 0) setActiveId(c[0].id) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="w-6 h-6 text-[#e7e5e4] animate-spin" />
    </div>
  )

  if (clients.length === 0) return (
    <div className="p-8 max-w-3xl text-center mt-12">
      <div className="w-12 h-12 rounded-xl bg-[#f3f4f6] flex items-center justify-center mx-auto mb-4">
        <Shield className="w-5 h-5 text-[#a8a29e]" />
      </div>
      <p className="text-[14px] font-semibold text-[#1c1d1f] mb-1">No clients yet</p>
      <p className="text-[12px] text-[#78716c]">Add a client to start viewing security insights.</p>
    </div>
  )

  const activeClient = clients.find(c => c.id === activeId)

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-[#1c1d1f]" style={{ letterSpacing: '-0.02em' }}>
          Security Insights
        </h1>
        <p className="text-[14px] text-[#78716c] mt-1.5">Live compliance signals pulled from Microsoft Graph.</p>
      </div>

      {/* Client selector */}
      {clients.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all"
              style={activeId === c.id
                ? { background: '#1c1917', color: '#fff', borderColor: '#1c1917' }
                : { background: '#fff', color: '#505967', borderColor: '#e7e5e4' }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {activeClient && (
        <div className="space-y-4">
          <CAExclusionPanel  key={`ca-${activeId}`}   clientId={activeClient.id} />
          <AccessReviewPanel key={`ar-${activeId}`}   clientId={activeClient.id} />
        </div>
      )}
    </div>
  )
}
