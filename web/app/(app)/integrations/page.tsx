'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plug, CheckCircle2, AlertCircle, ExternalLink,
  RefreshCw, Settings, Globe, Lock, Activity, Loader2,
  ChevronDown, Building2,
} from 'lucide-react'
import { getConfigStatus, testConfig, getClients, getClientIntegrations } from '@/lib/api'
import type { Client, ClientIntegration } from '@/lib/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'connected' | 'error' | 'pending' | 'not_connected' }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
        Connected
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" />
        Error
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
        Credentials saved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF] bg-[#F7F5F1] border border-[#E9E5DD] px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" />
      Not connected
    </span>
  )
}

// ─── Platform definitions (for the grid) ─────────────────────────────────────

const PLATFORM_META: Record<string, { name: string; color: string; description: string; category: string }> = {
  servicenow: { name: 'ServiceNow',       color: '#81B5A1', description: 'GRC ticketing and change management',       category: 'GRC' },
  splunk:     { name: 'Splunk',           color: '#FF6A00', description: 'SIEM log forwarding and correlation',        category: 'SIEM' },
  jira:       { name: 'Jira',             color: '#0052CC', description: 'Auto-create issues for failed controls',     category: 'Ticketing' },
  slack:      { name: 'Slack',            color: '#4A154B', description: 'Post assessment summaries to channels',      category: 'Notifications' },
  teams:      { name: 'Microsoft Teams',  color: '#464EB8', description: 'Send compliance score updates to Teams',     category: 'Notifications' },
  workday:    { name: 'Workday',          color: '#F5820E', description: 'HR and workforce identity integration',       category: 'HR' },
  monday:     { name: 'Monday.com',       color: '#F2484B', description: 'Track compliance tasks and milestones',      category: 'Project Mgmt' },
  box:        { name: 'Box',              color: '#0061D5', description: 'Document evidence collection from Box',       category: 'Storage' },
  dropbox:    { name: 'Dropbox',          color: '#0061FE', description: 'Evidence documents from Dropbox Business',   category: 'Storage' },
}

export default function IntegrationsPage() {
  const router = useRouter()

  // ── Global M365 status (default / own-tenant) ─────────────────────────
  const [configStatus, setConfigStatus]   = useState<any>(null)
  const [testing, setTesting]             = useState(false)
  const [testResult, setTestResult]       = useState<{ ok: boolean; msg: string } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // ── Multi-client ──────────────────────────────────────────────────────
  const [clients,         setClients]         = useState<Client[]>([])
  const [selectedClient,  setSelectedClient]  = useState<Client | null>(null)
  const [integrations,    setIntegrations]    = useState<ClientIntegration[]>([])
  const [loadingClients,  setLoadingClients]  = useState(true)
  const [loadingIntgs,    setLoadingIntgs]    = useState(false)
  const [dropdownOpen,    setDropdownOpen]    = useState(false)

  useEffect(() => {
    getConfigStatus()
      .then(s => setConfigStatus(s))
      .catch(() => setConfigStatus(null))
      .finally(() => setLoadingStatus(false))

    getClients()
      .then(list => {
        setClients(list)
        if (list.length > 0) setSelectedClient(list[0])
      })
      .catch(() => {})
      .finally(() => setLoadingClients(false))
  }, [])

  // Load integrations when client changes
  useEffect(() => {
    if (!selectedClient) { setIntegrations([]); return }
    setLoadingIntgs(true)
    getClientIntegrations(selectedClient.id)
      .then(setIntegrations)
      .catch(() => setIntegrations([]))
      .finally(() => setLoadingIntgs(false))
  }, [selectedClient])

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testConfig()
      setTestResult({ ok: !!res.ok, msg: res.tenantName ? `Connected — ${res.tenantName}` : 'Connection successful' })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  // Helper: find a saved integration for a platform
  function getIntegration(platformId: string): ClientIntegration | undefined {
    return integrations.find(i => i.platform === platformId)
  }

  const azureConnected = !!configStatus?.configured
  const tenantName     = configStatus?.tenantName ?? '—'
  const tenantId       = configStatus?.tenantId   ?? '—'

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-lg bg-white border border-[#E9E5DD] flex items-center justify-center shadow-card">
          <Plug className="w-4 h-4 text-[#6B7280]" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#18181B] tracking-tight">Integrations</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Connect INDEX to your cloud and security tools</p>
        </div>
      </div>

      {/* Test connection result */}
      {testResult && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-6 border ${
          testResult.ok
            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
            : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
        }`}>
          {testResult.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle  className="w-4 h-4 shrink-0" />
          }
          <span className="text-xs font-medium">{testResult.msg}</span>
          <button onClick={() => setTestResult(null)} className="ml-auto text-sm opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Active integrations (M365) ── */}
      <h2 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Microsoft Platform</h2>
      <div className="space-y-4 mb-10">
        {loadingStatus ? (
          <div className="bg-white rounded-xl border border-[#E9E5DD] p-8 flex items-center justify-center shadow-card">
            <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
          </div>
        ) : (
          <>
            {/* Entra ID card */}
            <div className="bg-white rounded-xl border border-[#E9E5DD] overflow-hidden shadow-card">
              <div className="flex items-start gap-4 p-5 border-b border-[#F0EDE6]">
                <div className="w-11 h-11 rounded-xl bg-[#F7F5F1] border border-[#E9E5DD] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 96 96" className="w-7 h-7" fill="none">
                    <path d="M48 4L4 20v56l44 16 44-16V20L48 4z" fill="#0078D4"/>
                    <path d="M48 4v88l44-16V20L48 4z" fill="#0050B3" opacity=".6"/>
                    <path d="M27 34h14l20 28H47L27 34zm28 0h14L49 62H35L55 34z" fill="#fff"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[15px] font-semibold text-[#18181B]">Microsoft Entra ID</h3>
                    <span className="text-[10px] font-medium text-[#9CA3AF] bg-[#F7F5F1] border border-[#E9E5DD] px-2 py-0.5 rounded-full">Identity</span>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">Identity and access management. Provides authentication via OAuth 2.0 client credentials.</p>
                </div>
                <StatusBadge status={azureConnected ? 'connected' : 'not_connected'} />
              </div>
              {azureConnected && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 px-5 py-4 bg-[#FAFAF8] border-b border-[#F0EDE6]">
                  {[
                    ['Tenant Name', tenantName],
                    ['Tenant ID',   tenantId],
                    ['Auth Method', 'OAuth 2.0 Client Credentials'],
                    ['Scope',       'https://graph.microsoft.com/.default'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] font-semibold text-[#C4BFB5] uppercase tracking-widest">{k}</p>
                      <p className="text-[12px] text-[#374151] font-mono mt-0.5 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 px-5 py-3">
                <button
                  onClick={() => router.push('/setup')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition text-[#6B7280] hover:text-[#18181B] bg-white border border-[#E9E5DD] hover:bg-[#F7F5F1]"
                >
                  <Settings className="w-3 h-3" />
                  {azureConnected ? 'Reconfigure' : 'Connect'}
                </button>
                {azureConnected && (
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition text-[#6B7280] hover:text-[#18181B] bg-white border border-[#E9E5DD] hover:bg-[#F7F5F1] disabled:opacity-60 disabled:cursor-wait"
                  >
                    {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Test Connection
                  </button>
                )}
              </div>
            </div>

            {/* Graph API card */}
            <div className="bg-white rounded-xl border border-[#E9E5DD] overflow-hidden shadow-card">
              <div className="flex items-start gap-4 p-5 border-b border-[#F0EDE6]">
                <div className="w-11 h-11 rounded-xl bg-[#F7F5F1] border border-[#E9E5DD] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 96 96" className="w-7 h-7" fill="none">
                    <circle cx="48" cy="48" r="44" fill="#00BCF2"/>
                    <path d="M24 48c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 24-24 24-24-10.7-24-24z" fill="#fff" opacity=".25"/>
                    <path d="M36 36l24 12-24 12V36z" fill="#fff"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[15px] font-semibold text-[#18181B]">Microsoft Graph API</h3>
                    <span className="text-[10px] font-medium text-[#9CA3AF] bg-[#F7F5F1] border border-[#E9E5DD] px-2 py-0.5 rounded-full">Data</span>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">Unified endpoint for Microsoft 365 — users, devices, security events, compliance policies and audit logs.</p>
                </div>
                <StatusBadge status={azureConnected ? 'connected' : 'not_connected'} />
              </div>
              <div className="flex items-center gap-2 px-5 py-3">
                <a
                  href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition text-[#6B7280] hover:text-[#18181B] bg-white border border-[#E9E5DD] hover:bg-[#F7F5F1]"
                >
                  <Globe className="w-3 h-3" />
                  Graph Explorer
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => router.push('/assess')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition text-[#6B7280] hover:text-[#18181B] bg-white border border-[#E9E5DD] hover:bg-[#F7F5F1]"
                >
                  <Lock className="w-3 h-3" />
                  View Required Permissions
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Per-client integrations ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Client Integrations</h2>

        {/* Client selector */}
        {!loadingClients && clients.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E9E5DD] bg-white
                         hover:bg-[#F7F5F1] text-xs font-medium text-[#374151] transition"
            >
              <Building2 className="w-3 h-3 text-[#9CA3AF]" />
              {selectedClient?.name ?? 'Select client'}
              <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E9E5DD] rounded-xl shadow-xl z-10 min-w-[180px] overflow-hidden">
                {clients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c); setDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-medium transition ${
                      selectedClient?.id === c.id
                        ? 'bg-[#F7F5F1] text-[#18181B]'
                        : 'text-[#374151] hover:bg-[#F7F5F1]'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loadingClients ? (
        <div className="bg-white rounded-xl border border-[#E9E5DD] p-8 flex items-center justify-center shadow-card">
          <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E9E5DD] p-8 text-center shadow-card">
          <Building2 className="w-8 h-8 text-[#D4CFC5] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#9CA3AF] mb-1">No clients yet</p>
          <p className="text-xs text-[#C4BFB5]">
            Add a client on the{' '}
            <button onClick={() => router.push('/clients')} className="text-[#C4A96D] hover:underline">
              Clients page
            </button>{' '}
            to view their integrations.
          </p>
        </div>
      ) : (
        <>
          {selectedClient && (
            <p className="text-xs text-[#9CA3AF] mb-4">
              Showing integrations for <span className="font-semibold text-[#374151]">{selectedClient.name}</span>
            </p>
          )}

          {loadingIntgs ? (
            <div className="bg-white rounded-xl border border-[#E9E5DD] p-8 flex items-center justify-center shadow-card">
              <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(PLATFORM_META).map(([id, meta]) => {
                const intg = getIntegration(id)
                const status = intg?.status ?? 'not_connected' as const

                return (
                  <div
                    key={id}
                    className={`bg-white rounded-xl border overflow-hidden shadow-card transition ${
                      status === 'connected' ? 'border-[#BBF7D0]' :
                      status === 'error'     ? 'border-[#FECACA]' :
                      'border-[#E9E5DD]'
                    }`}
                  >
                    <div className="flex items-start gap-3 p-4">
                      {/* Color dot */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: meta.color + '22' }}
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h3 className="text-[13px] font-semibold text-[#18181B]">{meta.name}</h3>
                          <span className="text-[10px] font-medium text-[#9CA3AF] bg-[#F7F5F1] border border-[#E9E5DD] px-1.5 py-0.5 rounded-full">
                            {meta.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7280] leading-relaxed">{meta.description}</p>
                        {intg?.connectedAt && (
                          <p className="text-[10px] text-[#9CA3AF] mt-1">
                            Connected {new Date(intg.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        {intg?.errorMessage && status === 'error' && (
                          <p className="text-[10px] text-[#B91C1C] mt-1 truncate">{intg.errorMessage}</p>
                        )}
                      </div>

                      <div className="shrink-0 mt-0.5">
                        <StatusBadge status={status as any} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

    </div>
  )
}
