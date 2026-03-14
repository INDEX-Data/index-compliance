'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, ExternalLink, X,
  Activity, Loader2, Building2, Settings,
  Globe, Lock, Zap, Bell, Database, FolderOpen,
  ChevronDown, Eye, EyeOff,
} from 'lucide-react'
import {
  getConfigStatus, testConfig, getClients, getClientIntegrations,
  saveClientIntegration, testClientIntegration,
} from '@/lib/api'
import type { Client, ClientIntegration } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = 'connected' | 'error' | 'pending' | 'not_connected'
type FilterTab  = 'all' | 'connected' | 'available'

interface PlatformField {
  key: string
  label: string
  placeholder?: string
  type?: 'password' | 'text'
}

// ─── Platform meta ────────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, {
  name: string; color: string; description: string
  category: string; categoryIcon: React.ElementType; soon?: boolean
  fields: PlatformField[]
}> = {
  servicenow: {
    name: 'ServiceNow', color: '#81B5A1',
    description: 'GRC ticketing and change management',
    category: 'GRC', categoryIcon: Zap,
    fields: [
      { key: 'instanceUrl', label: 'Instance URL',  placeholder: 'https://company.service-now.com' },
      { key: 'username',    label: 'Username',       placeholder: 'admin' },
      { key: 'password',    label: 'Password',       type: 'password' },
    ],
  },
  splunk: {
    name: 'Splunk', color: '#FF6A00',
    description: 'SIEM log forwarding and event correlation',
    category: 'SIEM', categoryIcon: Activity,
    fields: [
      { key: 'baseUrl',  label: 'Splunk URL', placeholder: 'https://splunk.company.com:8089' },
      { key: 'apiToken', label: 'API Token',  type: 'password' },
    ],
  },
  jira: {
    name: 'Jira', color: '#0052CC',
    description: 'Auto-create issues for failed controls',
    category: 'Ticketing', categoryIcon: Zap,
    fields: [
      { key: 'domain',   label: 'Jira Domain', placeholder: 'company.atlassian.net' },
      { key: 'email',    label: 'Email',        placeholder: 'admin@company.com' },
      { key: 'apiToken', label: 'API Token',    type: 'password' },
    ],
  },
  slack: {
    name: 'Slack', color: '#4A154B',
    description: 'Post assessment summaries to channels',
    category: 'Notifications', categoryIcon: Bell,
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
    ],
  },
  teams: {
    name: 'Microsoft Teams', color: '#464EB8',
    description: 'Send compliance updates to Teams channels',
    category: 'Notifications', categoryIcon: Bell,
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', placeholder: 'https://outlook.office.com/webhook/...' },
    ],
  },
  workday: {
    name: 'Workday', color: '#F5820E',
    description: 'HR and workforce identity integration',
    category: 'HR', categoryIcon: Building2,
    fields: [
      { key: 'baseUrl',    label: 'Base URL',    placeholder: 'https://wd2.myworkday.com/...' },
      { key: 'tenantName', label: 'Tenant Name', placeholder: 'company' },
      { key: 'username',   label: 'Username' },
      { key: 'password',   label: 'Password', type: 'password' },
    ],
  },
  monday: {
    name: 'Monday.com', color: '#F2484B',
    description: 'Track compliance tasks and milestones',
    category: 'Project Mgmt', categoryIcon: Zap,
    fields: [
      { key: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  box: {
    name: 'Box', color: '#0061D5',
    description: 'Evidence collection from Box storage',
    category: 'Storage', categoryIcon: FolderOpen,
    fields: [
      { key: 'clientId',     label: 'Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'enterpriseId', label: 'Enterprise ID' },
    ],
  },
  dropbox: {
    name: 'Dropbox', color: '#0061FE',
    description: 'Evidence documents from Dropbox Business',
    category: 'Storage', categoryIcon: FolderOpen,
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  sentinel: {
    name: 'Azure Sentinel', color: '#0078D4',
    description: 'Security event ingestion from Sentinel',
    category: 'SIEM', categoryIcon: Activity, soon: true, fields: [],
  },
  defender: {
    name: 'MS Defender', color: '#00BCF2',
    description: 'Endpoint compliance and threat signals',
    category: 'Security', categoryIcon: Database, soon: true, fields: [],
  },
  aws: {
    name: 'AWS Security Hub', color: '#FF9900',
    description: 'Multi-cloud compliance posture data',
    category: 'Cloud', categoryIcon: Database, soon: true, fields: [],
  },
}

// ─── Configure Integration Modal ─────────────────────────────────────────────

function ConfigureModal({
  clientId,
  platformId,
  existing,
  onClose,
  onSaved,
}: {
  clientId: string
  platformId: string
  existing?: ClientIntegration
  onClose: () => void
  onSaved: () => void
}) {
  const meta = PLATFORM_META[platformId]
  const [values, setValues]     = useState<Record<string, string>>({})
  const [showPwd, setShowPwd]   = useState<Record<string, boolean>>({})
  const [testing, setTesting]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (!meta) return null

  function setVal(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
    setTestResult(null)
  }

  function allFilled() {
    return meta.fields.every(f => (values[f.key] ?? '').trim() !== '')
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      const result = await testClientIntegration(clientId, platformId, values)
      setTestResult({
        ok: result.ok,
        msg: result.ok ? 'Connection successful — credentials verified' : (result.error ?? 'Connection failed'),
      })
      if (result.ok) onSaved() // refresh status in parent
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveClientIntegration(clientId, platformId, values)
      onSaved()
      onClose()
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#F3F3F3]">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-bold"
            style={{ background: meta.color + '18', color: meta.color }}
          >
            {meta.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-[#0A0A0A]">
              {existing?.status === 'connected' ? 'Reconfigure' : 'Connect'} {meta.name}
            </h2>
            <p className="text-[11px] text-[#999999] truncate">{meta.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#999999] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          {meta.fields.map(field => {
            const isPwd  = field.type === 'password'
            const isShow = showPwd[field.key]
            return (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-[#444444] uppercase tracking-widest mb-1.5">
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    type={isPwd && !isShow ? 'password' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={e => setVal(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 text-[13px] rounded-lg border border-[#E8E8E8] bg-white text-[#0A0A0A] placeholder-[#D4D4D4] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 focus:border-[#999999] transition pr-9"
                  />
                  {isPwd && (
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => ({ ...s, [field.key]: !s[field.key] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#555555]"
                    >
                      {isShow ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Test result */}
          {testResult && (
            <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[12px] border ${
              testResult.ok
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
                : <AlertCircle  className="w-4 h-4 shrink-0 mt-px" />}
              <span className="leading-snug">{testResult.msg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#F3F3F3] bg-[#FAFAFA]">
          <button
            onClick={handleTest}
            disabled={!allFilled() || testing || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg border border-[#E8E8E8] bg-white text-[#1A1A1A] hover:bg-[#F3F3F3] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-[#E8E8E8] bg-white text-[#555555] hover:bg-[#F3F3F3] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!allFilled() || saving || testing}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg bg-[#0A0A0A] text-white hover:bg-[#111111] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ConnStatus }) {
  const styles: Record<ConnStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
    connected:     { label: 'Connected',         dot: 'bg-[#16A34A] animate-pulse', text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
    error:         { label: 'Error',             dot: 'bg-[#DC2626]',               text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
    pending:       { label: 'Credentials saved', dot: 'bg-[#D97706]',               text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
    not_connected: { label: 'Not connected',     dot: 'bg-[#D4D4D4]',               text: 'text-[#999999]', bg: 'bg-[#FAFAFA]', border: 'border-[#E8E8E8]' },
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
  const meta   = PLATFORM_META[id]
  const status = (intg?.status ?? 'not_connected') as ConnStatus

  if (!meta) return null

  return (
    <div className={[
      'bg-white rounded-xl border overflow-hidden shadow-card transition-all duration-150',
      'hover:shadow-card-hover hover:-translate-y-px',
      meta.soon ? 'opacity-60' : '',
      status === 'connected' ? 'border-[#BBF7D0]' :
      status === 'error'     ? 'border-[#FECACA]' :
      'border-[#E8E8E8]',
    ].join(' ')}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <PlatformLogo color={meta.color} name={meta.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold text-[#0A0A0A] leading-tight">{meta.name}</h3>
              {meta.soon && (
                <span className="text-[10px] font-semibold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#999999] mt-0.5">
              <meta.categoryIcon className="w-2.5 h-2.5" />
              {meta.category}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#555555] leading-relaxed flex-1">{meta.description}</p>

        {intg?.connectedAt && (
          <p className="text-[10px] text-[#999999] mt-2">
            Connected {new Date(intg.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {intg?.errorMessage && status === 'error' && (
          <p className="text-[10px] text-[#DC2626] mt-1 truncate" title={intg.errorMessage}>{intg.errorMessage}</p>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F3F3F3]">
          <StatusPill status={status} />
          {!meta.soon && (
            <button
              onClick={() => onConnect(id)}
              className="text-[11px] font-semibold text-[#1A1A1A] hover:text-[#0A0A0A] transition px-2.5 py-1 rounded-lg hover:bg-[#FAFAFA] border border-transparent hover:border-[#E8E8E8]"
            >
              {status === 'connected' ? 'Reconfigure' : 'Connect →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Microsoft Entra card ─────────────────────────────────────────────────────

function MicrosoftEntraCard({ connected, tenantName, tenantId, onReconfigure, onTest, testing }: {
  connected: boolean; tenantName: string; tenantId: string
  onReconfigure: () => void; onTest: () => void; testing: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border overflow-hidden shadow-card ${connected ? 'border-[#BBF7D0]' : 'border-[#E8E8E8]'}`}>
      <div className="flex items-start gap-4 p-5 border-b border-[#F3F3F3]">
        <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 96 96" className="w-6 h-6" fill="none">
            <path d="M48 4L4 20v56l44 16 44-16V20L48 4z" fill="#0078D4"/>
            <path d="M48 4v88l44-16V20L48 4z" fill="#0050B3" opacity=".6"/>
            <path d="M27 34h14l20 28H47L27 34zm28 0h14L49 62H35L55 34z" fill="#fff"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Microsoft Entra ID</h3>
            <span className="text-[10px] font-medium text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full">Identity</span>
          </div>
          <p className="text-[12px] text-[#555555] leading-relaxed">
            OAuth 2.0 client credentials for Microsoft Graph API access across all connected tenants.
          </p>
        </div>
        <StatusPill status={connected ? 'connected' : 'not_connected'} />
      </div>

      {connected && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-5 py-4 bg-[#FAFAFA] border-b border-[#F3F3F3]">
          {[
            ['Tenant Name', tenantName],
            ['Tenant ID',   tenantId],
            ['Auth Method', 'OAuth 2.0 Client Credentials'],
            ['Scope',       'https://graph.microsoft.com/.default'],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-semibold text-[#BBBBBB] uppercase tracking-widest">{k}</p>
              <p className="text-[12px] text-[#1A1A1A] font-mono mt-0.5 truncate">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-5 py-3">
        <button
          onClick={onReconfigure}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] text-[#1A1A1A] transition"
        >
          <Settings className="w-3 h-3" />
          {connected ? 'Reconfigure' : 'Connect'}
        </button>
        {connected && (
          <button
            onClick={onTest}
            disabled={testing}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] text-[#1A1A1A] transition disabled:opacity-60 disabled:cursor-wait"
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

  const [filter,           setFilter]           = useState<FilterTab>('all')
  const [configuringPlatform, setConfiguringPlatform] = useState<string | null>(null)

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

  const refreshIntegrations = useCallback(() => {
    if (!selectedClient) return
    setLoadingIntgs(true)
    getClientIntegrations(selectedClient.id)
      .then(setIntegrations)
      .catch(() => setIntegrations([]))
      .finally(() => setLoadingIntgs(false))
  }, [selectedClient])

  useEffect(() => {
    if (!selectedClient) { setIntegrations([]); return }
    refreshIntegrations()
  }, [selectedClient, refreshIntegrations])

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

  const platformIds  = Object.keys(PLATFORM_META)
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
          <h1 className="text-[22px] font-bold text-[#0A0A0A] tracking-tight">Integrations</h1>
          <p className="text-[13px] text-[#999999] mt-1">Connect INDEX to your clients' security and productivity tools</p>
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
          <h2 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest">Microsoft Platform</h2>
          <div className="flex-1 h-px bg-[#F3F3F3]" />
        </div>
        {loadingStatus ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 flex justify-center shadow-card">
            <Loader2 className="w-5 h-5 animate-spin text-[#BBBBBB]" />
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
            <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden shadow-card">
              <div className="flex items-start gap-4 p-5 border-b border-[#F3F3F3]">
                <div className="w-11 h-11 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 96 96" className="w-6 h-6" fill="none">
                    <circle cx="48" cy="48" r="44" fill="#00BCF2"/>
                    <path d="M24 48c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 24-24 24-24-10.7-24-24z" fill="#fff" opacity=".25"/>
                    <path d="M36 36l24 12-24 12V36z" fill="#fff"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Microsoft Graph API</h3>
                    <span className="text-[10px] font-medium text-[#0369A1] bg-[#F0F9FF] border border-[#BAE6FD] px-2 py-0.5 rounded-full">Data</span>
                  </div>
                  <p className="text-[12px] text-[#555555] leading-relaxed">
                    Unified endpoint for users, devices, security events, compliance policies, and audit logs.
                  </p>
                </div>
                <StatusPill status={azureConnected ? 'connected' : 'not_connected'} />
              </div>
              <div className="flex items-center gap-2 px-5 py-3">
                <a
                  href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] text-[#1A1A1A] transition"
                >
                  <Globe className="w-3 h-3" /> Graph Explorer <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => router.push('/assess')}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] text-[#1A1A1A] transition"
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
            <h2 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest">Client Integrations</h2>
            <div className="h-px bg-[#F3F3F3] w-8" />
          </div>

          {/* Client selector */}
          {!loadingClients && clients.length > 0 && (
            <div className="relative ml-auto">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#FAFAFA] text-[12px] font-medium text-[#1A1A1A] transition"
              >
                <Building2 className="w-3 h-3 text-[#999999]" />
                {selectedClient?.name ?? 'Select client'}
                <ChevronDown className="w-3 h-3 text-[#999999]" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-xl z-10 min-w-[180px] overflow-hidden">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedClient(c); setDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-[12px] font-medium transition ${
                        selectedClient?.id === c.id ? 'bg-[#FAFAFA] text-[#0A0A0A]' : 'text-[#1A1A1A] hover:bg-[#FAFAFA]'
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
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 flex justify-center shadow-card">
            <Loader2 className="w-5 h-5 animate-spin text-[#BBBBBB]" />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 text-center shadow-card">
            <Building2 className="w-8 h-8 text-[#D4D4D4] mx-auto mb-3" />
            <p className="text-[13px] font-medium text-[#999999] mb-1">No clients yet</p>
            <p className="text-[12px] text-[#BBBBBB]">
              Add a client on the{' '}
              <button onClick={() => router.push('/clients')} className="text-[#C4A96D] hover:underline">Clients page</button>
              {' '}to configure integrations.
            </p>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-[#FAFAFA] rounded-lg p-1 w-fit mb-5 border border-[#E8E8E8]">
              {(['all', 'connected', 'available'] as FilterTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={[
                    'px-3.5 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-colors',
                    filter === tab
                      ? 'bg-white text-[#0A0A0A] shadow-sm border border-[#E8E8E8]'
                      : 'text-[#999999] hover:text-[#1A1A1A]',
                  ].join(' ')}
                >
                  {tab}
                  <span className={`ml-1.5 text-[10px] ${filter === tab ? 'text-[#999999]' : 'text-[#BBBBBB]'}`}>
                    {filterCounts[tab]}
                  </span>
                </button>
              ))}
            </div>

            {loadingIntgs ? (
              <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 flex justify-center shadow-card">
                <Loader2 className="w-5 h-5 animate-spin text-[#BBBBBB]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredIds.map(id => (
                  <IntegrationTile
                    key={id}
                    id={id}
                    intg={getIntegration(id)}
                    onConnect={setConfiguringPlatform}
                  />
                ))}
              </div>
            )}

            {filteredIds.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 text-center shadow-card">
                <p className="text-[13px] text-[#999999]">
                  {filter === 'connected' ? 'No integrations connected yet.' : 'No integrations available.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Configure Modal */}
      {configuringPlatform && selectedClient && (
        <ConfigureModal
          clientId={selectedClient.id}
          platformId={configuringPlatform}
          existing={getIntegration(configuringPlatform)}
          onClose={() => setConfiguringPlatform(null)}
          onSaved={() => {
            refreshIntegrations()
            // Don't auto-close — let user see the success test result first
          }}
        />
      )}
    </div>
  )
}
