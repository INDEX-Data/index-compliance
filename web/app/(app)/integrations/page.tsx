'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, ExternalLink,
  Activity, Loader2, Building2, Settings,
  Globe, Lock, Zap, Bell, Database, FolderOpen,
  ChevronDown,
} from 'lucide-react'
import { getConfigStatus, testConfig, getClients, getClientIntegrations } from '@/lib/api'
import type { Client, ClientIntegration } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = 'connected' | 'error' | 'pending' | 'not_connected'
type FilterTab  = 'all' | 'connected' | 'available'

// ─── Platform meta ────────────────────────────────────────────────────────────

const PLATFORMS: Record<string, {
  name: string; color: string; description: string
  category: string; categoryIcon: React.ElementType; soon?: boolean
}> = {
  servicenow: { name: 'ServiceNow',      color: '#81B5A1', description: 'GRC ticketing and change management',      category: 'GRC',           categoryIcon: Zap },
  splunk:     { name: 'Splunk',          color: '#FF6A00', description: 'SIEM log forwarding and event correlation', category: 'SIEM',          categoryIcon: Activity },
  jira:       { name: 'Jira',            color: '#0052CC', description: 'Auto-create issues for failed controls',    category: 'Ticketing',     categoryIcon: Zap },
  slack:      { name: 'Slack',           color: '#4A154B', description: 'Post assessment summaries to channels',     category: 'Notifications', categoryIcon: Bell },
  teams:      { name: 'Microsoft Teams', color: '#464EB8', description: 'Send compliance updates to Teams',          category: 'Notifications', categoryIcon: Bell },
  workday:    { name: 'Workday',         color: '#F5820E', description: 'HR and workforce identity integration',      category: 'HR',            categoryIcon: Building2 },
  monday:     { name: 'Monday.com',      color: '#F2484B', description: 'Track compliance tasks and milestones',     category: 'Project Mgmt',  categoryIcon: Zap },
  box:        { name: 'Box',             color: '#0061D5', description: 'Evidence collection from Box storage',      category: 'Storage',       categoryIcon: FolderOpen },
  dropbox:    { name: 'Dropbox',         color: '#0061FE', description: 'Evidence documents from Dropbox Business',  category: 'Storage',       categoryIcon: FolderOpen },
  sentinel:   { name: 'Azure Sentinel',  color: '#0078D4', description: 'Security event ingestion from Sentinel',    category: 'SIEM',          categoryIcon: Activity, soon: true },
  defender:   { name: 'MS Defender',     color: '#00BCF2', description: 'Endpoint compliance and threat signals',    category: 'Security',      categoryIcon: Database, soon: true },
  aws:        { name: 'AWS Security Hub',color: '#FF9900', description: 'Multi-cloud compliance posture data',       category: 'Cloud',         categoryIcon: Database, soon: true },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ConnStatus }) {
  const styles: Record<ConnStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
    connected:     { label: 'Connected',         dot: 'bg-[#16A34A] animate-pulse', text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
    error:         { label: 'Error',             dot: 'bg-[#DC2626]',               text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
    pending:       { label: 'Credentials saved', dot: 'bg-[#D97706]',               text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
    not_connected: { label: 'Not connected',     dot: 'bg-[#D1D5DB]',               text: 'text-[#9CA3AF]', bg: 'bg-[#F7F5F1]', border: 'border-[#E9E5DD]' },
  }
  const s = styles[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.text} ${s.bg} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function PlatformLogo({ color, name }: { color: string; name: string }) {
  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-[14px] font-bold"
      style={{ background: color + '18', color }}
    >
      {name.charAt(0)}
    </div>
  )
}

interface IntegrationTileProps {
  id: string
  intg?: ClientIntegration
  onConnect: (id: string) => void
}

function IntegrationTile({ id, intg, onConnect }: IntegrationTileProps) {
  const meta   = PLATFORMS[id]
  const status = (intg?.status ?? 'not_connected') as ConnStatus

  if (!meta) return null

  return (
    <div className={[
      'bg-white rounded-xl border overflow-hidden shadow-card transition-all duration-150',
      'hover:shadow-card-hover hover:-translate-y-px',
      meta.soon ? 'opacity-60' : '',
      status === 'connected' ? 'border-[#BBF7D0]' :
      status === 'error'     ? 'border-[#FECACA]' :
      'border-[#E9E5DD]',
    ].join(' ')}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <PlatformLogo color={meta.color} name={meta.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold text-[#18181B] leading-tight">{meta.name}</h3>
              {meta.soon && (
                <span className="text-[10px] font-semibold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#9CA3AF] mt-0.5">
              <meta.categoryIcon className="w-2.5 h-2.5" />
              {meta.category}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#6B7280] leading-relaxed flex-1">{meta.description}</p>

        {intg?.connectedAt && (
          <p className="text-[10px] text-[#9CA3AF] mt-2">
            Connected {new Date(intg.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {intg?.errorMessage && status === 'error' && (
          <p className="text-[10px] text-[#DC2626] mt-1 truncate">{intg.errorMessage}</p>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0EDE6]">
          <StatusPill status={status} />
          {!meta.soon && (
            <button
              onClick={() => onConnect(id)}
              className="text-[11px] font-semibold text-[#374151] hover:text-[#18181B] transition px-2.5 py-1 rounded-lg hover:bg-[#F7F5F1] border border-transparent hover:border-[#E9E5DD]"
            >
              {status === 'connected' ? 'Configure' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Microsoft card ───────────────────────────────────────────────────────────

function MicrosoftEntraCard({ connected, tenantName, tenantId, onReconfigure, onTest, testing }: {
  connected: boolean; tenantName: string; tenantId: string
  onReconfigure: () => void; onTest: () => void; testing: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border overflow-hidden shadow-card ${connected ? 'border-[#BBF7D0]' : 'border-[#E9E5DD]'}`}>
      <div className="flex items-start gap-4 p-5 border-b border-[#F0EDE6]">
        <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 96 96" className="w-6 h-6" fill="none">
            <path d="M48 4L4 20v56l44 16 44-16V20L48 4z" fill="#0078D4"/>
            <path d="M48 4v88l44-16V20L48 4z" fill="#0050B3" opacity=".6"/>
            <path d="M27 34h14l20 28H47L27 34zm28 0h14L49 62H35L55 34z" fill="#fff"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-[#18181B]">Microsoft Entra ID</h3>
            <span className="text-[10px] font-medium text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full">Identity</span>
          </div>
          <p className="text-[12px] text-[#6B7280] leading-relaxed">
            OAuth 2.0 client credentials for Microsoft Graph API access across all connected tenants.
          </p>
        </div>
        <StatusPill status={connected ? 'connected' : 'not_connected'} />
      </div>

      {connected && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-5 py-4 bg-[#FAFAF8] border-b border-[#F0EDE6]">
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
          onClick={onReconfigure}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E9E5DD] bg-white hover:bg-[#F7F5F1] text-[#374151] transition"
        >
          <Settings className="w-3 h-3" />
          {connected ? 'Reconfigure' : 'Connect'}
        </button>
        {connected && (
          <button
            onClick={onTest}
            disabled={testing}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E9E5DD] bg-white hover:bg-[#F7F5F1] text-[#374151] transition disabled:opacity-60 disabled:cursor-wait"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            Test Connection
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const router = useRouter()

  const [configStatus, setConfigStatus]   = useState<any>(null)
  const [testing, setTesting]             = useState(false)
  const [testResult, setTestResult]       = useState<{ ok: boolean; msg: string } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const [clients,        setClients]        = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [integrations,   setIntegrations]   = useState<ClientIntegration[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingIntgs,   setLoadingIntgs]   = useState(false)
  const [dropdownOpen,   setDropdownOpen]   = useState(false)

  const [filter, setFilter] = useState<FilterTab>('all')

  useEffect(() => {
    getConfigStatus()
      .then(s => setConfigStatus(s))
      .catch(() => setConfigStatus(null))
      .finally(() => setLoadingStatus(false))

    getClients()
      .then(list => { setClients(list); if (list.length > 0) setSelectedClient(list[0]) })
      .catch(() => {})
      .finally(() => setLoadingClients(false))
  }, [])

  useEffect(() => {
    if (!selectedClient) { setIntegrations([]); return }
    setLoadingIntgs(true)
    getClientIntegrations(selectedClient.id)
      .then(setIntegrations)
      .catch(() => setIntegrations([]))
      .finally(() => setLoadingIntgs(false))
  }, [selectedClient])

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      const res = await testConfig()
      setTestResult({ ok: !!res.ok, msg: res.tenantName ? `Connected — ${res.tenantName}` : 'Connection successful' })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  function getIntegration(id: string) {
    return integrations.find(i => i.platform === id)
  }

  const azureConnected = !!configStatus?.configured
  const tenantName     = configStatus?.tenantName ?? '—'
  const tenantId       = configStatus?.tenantId   ?? '—'

  const platformIds = Object.keys(PLATFORMS)
  const connectedIds = platformIds.filter(id => getIntegration(id)?.status === 'connected')
  const availableIds = platformIds.filter(id => getIntegration(id)?.status !== 'connected')

  const filteredIds = filter === 'connected' ? connectedIds
    : filter === 'available' ? availableIds
    : platformIds

  const filterCounts = {
    all:       platformIds.length,
    connected: connectedIds.length,
    available: availableIds.length,
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-bold text-[#18181B] tracking-tight">Integrations</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Connect INDEX to your security and productivity tools</p>
        </div>
      </div>

      {/* Test result banner */}
      {testResult && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-6 border ${
          testResult.ok
            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
            : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
        }`}>
          {testResult.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle  className="w-4 h-4 shrink-0" />}
          <span className="text-[12px] font-medium flex-1">{testResult.msg}</span>
          <button onClick={() => setTestResult(null)} className="text-sm opacity-40 hover:opacity-80 transition">✕</button>
        </div>
      )}

      {/* ── Microsoft Platform ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Microsoft Platform</h2>
          <div className="flex-1 h-px bg-[#F0EDE6]" />
        </div>
        {loadingStatus ? (
          <div className="bg-white rounded-xl border border-[#E9E5DD] p-10 flex justify-center shadow-card">
            <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MicrosoftEntraCard
              connected={azureConnected}
              tenantName={tenantName}
              tenantId={tenantId}
              onReconfigure={() => router.push('/setup')}
              onTest={handleTest}
              testing={testing}
            />
            {/* Graph API tile */}
            <div className="bg-white rounded-xl border border-[#E9E5DD] overflow-hidden shadow-card">
              <div className="flex items-start gap-4 p-5 border-b border-[#F0EDE6]">
                <div className="w-11 h-11 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 96 96" className="w-6 h-6" fill="none">
                    <circle cx="48" cy="48" r="44" fill="#00BCF2"/>
                    <path d="M24 48c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 24-24 24-24-10.7-24-24z" fill="#fff" opacity=".25"/>
                    <path d="M36 36l24 12-24 12V36z" fill="#fff"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold text-[#18181B]">Microsoft Graph API</h3>
                    <span className="text-[10px] font-medium text-[#0369A1] bg-[#F0F9FF] border border-[#BAE6FD] px-2 py-0.5 rounded-full">Data</span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] leading-relaxed">
                    Unified endpoint for users, devices, security events, compliance policies, and audit logs.
                  </p>
                </div>
                <StatusPill status={azureConnected ? 'connected' : 'not_connected'} />
              </div>
              <div className="flex items-center gap-2 px-5 py-3">
                <a
                  href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E9E5DD] bg-white hover:bg-[#F7F5F1] text-[#374151] transition"
                >
                  <Globe className="w-3 h-3" /> Graph Explorer <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => router.push('/assess')}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E9E5DD] bg-white hover:bg-[#F7F5F1] text-[#374151] transition"
                >
                  <Lock className="w-3 h-3" /> View Permissions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Per-client integrations ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Client Integrations</h2>
            <div className="flex-1 h-px bg-[#F0EDE6] w-8" />
          </div>

          {/* Client selector */}
          {!loadingClients && clients.length > 1 && (
            <div className="relative ml-auto">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E9E5DD] bg-white hover:bg-[#F7F5F1] text-[12px] font-medium text-[#374151] transition"
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
                      className={`w-full text-left px-4 py-2.5 text-[12px] font-medium transition ${
                        selectedClient?.id === c.id ? 'bg-[#F7F5F1] text-[#18181B]' : 'text-[#374151] hover:bg-[#F7F5F1]'
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
          <div className="bg-white rounded-xl border border-[#E9E5DD] p-10 flex justify-center shadow-card">
            <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E9E5DD] p-10 text-center shadow-card">
            <Building2 className="w-8 h-8 text-[#D4CFC5] mx-auto mb-3" />
            <p className="text-[13px] font-medium text-[#9CA3AF] mb-1">No clients yet</p>
            <p className="text-[12px] text-[#C4BFB5]">
              Add a client on the{' '}
              <button onClick={() => router.push('/clients')} className="text-[#C4A96D] hover:underline">Clients page</button>
              {' '}to configure integrations.
            </p>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-[#F7F5F1] rounded-lg p-1 w-fit mb-5 border border-[#E9E5DD]">
              {(['all', 'connected', 'available'] as FilterTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={[
                    'px-3.5 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-colors',
                    filter === tab
                      ? 'bg-white text-[#18181B] shadow-sm border border-[#E9E5DD]'
                      : 'text-[#9CA3AF] hover:text-[#374151]',
                  ].join(' ')}
                >
                  {tab}
                  <span className={`ml-1.5 text-[10px] ${filter === tab ? 'text-[#9CA3AF]' : 'text-[#C4BFB5]'}`}>
                    {filterCounts[tab]}
                  </span>
                </button>
              ))}
            </div>

            {loadingIntgs ? (
              <div className="bg-white rounded-xl border border-[#E9E5DD] p-10 flex justify-center shadow-card">
                <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredIds.map(id => (
                  <IntegrationTile
                    key={id}
                    id={id}
                    intg={getIntegration(id)}
                    onConnect={() => router.push(`/integrations/${id}`)}
                  />
                ))}
              </div>
            )}

            {filteredIds.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E9E5DD] p-10 text-center shadow-card">
                <p className="text-[13px] text-[#9CA3AF]">
                  {filter === 'connected' ? 'No integrations connected yet.' : 'No integrations available.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
