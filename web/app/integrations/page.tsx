'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plug, CheckCircle2, AlertCircle, ExternalLink,
  RefreshCw, Settings, ChevronRight, Building2,
  Globe, Lock, Database, Activity, Loader2
} from 'lucide-react'
import { getConfigStatus, testConfig } from '@/lib/api'

interface Integration {
  id:          string
  name:        string
  description: string
  logo:        React.ReactNode
  category:    string
  status:      'connected' | 'not_configured' | 'testing'
  detail?:     string
  meta?:       Record<string, string>
  actions:     { label: string; href?: string; onClick?: () => void; primary?: boolean }[]
}

export default function IntegrationsPage() {
  const router = useRouter()

  const [configStatus, setConfigStatus]   = useState<any>(null)
  const [testing, setTesting]             = useState(false)
  const [testResult, setTestResult]       = useState<{ ok: boolean; msg: string } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    getConfigStatus()
      .then(s => setConfigStatus(s))
      .catch(() => setConfigStatus(null))
      .finally(() => setLoadingStatus(false))
  }, [])

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

  const azureConnected    = !!configStatus?.configured
  const tenantName        = configStatus?.tenantName ?? '—'
  const tenantId          = configStatus?.tenantId   ?? '—'

  // ── Integrations definition ─────────────────────────────────────────────
  const integrations: Integration[] = [
    {
      id:          'azure-entra',
      name:        'Microsoft Entra ID',
      description: 'Identity and access management for your Microsoft 365 tenant. Provides authentication via OAuth 2.0 client credentials.',
      category:    'Identity',
      logo: (
        <svg viewBox="0 0 96 96" className="w-7 h-7" fill="none">
          <path d="M48 4L4 20v56l44 16 44-16V20L48 4z" fill="#0078D4"/>
          <path d="M48 4v88l44-16V20L48 4z" fill="#0050B3" opacity=".6"/>
          <path d="M27 34h14l20 28H47L27 34zm28 0h14L49 62H35L55 34z" fill="#fff"/>
        </svg>
      ),
      status:  azureConnected ? 'connected' : 'not_configured',
      detail:  azureConnected ? `Tenant: ${tenantName}` : 'Not configured',
      meta: azureConnected ? {
        'Tenant Name': tenantName,
        'Tenant ID':   tenantId,
        'Auth Method': 'OAuth 2.0 Client Credentials',
        'Scope':       'https://graph.microsoft.com/.default',
      } : {},
      actions: [
        {
          label:   azureConnected ? 'Reconfigure' : 'Connect',
          onClick: () => router.push('/setup'),
          primary: !azureConnected,
        },
        ...(azureConnected ? [{
          label:    'Test Connection',
          onClick:  handleTestConnection,
        }] : []),
      ],
    },
    {
      id:          'm365-graph',
      name:        'Microsoft Graph API',
      description: 'Unified endpoint for Microsoft 365 data — users, devices, security events, compliance policies, and audit logs used for all control assessments.',
      category:    'Data',
      logo: (
        <svg viewBox="0 0 96 96" className="w-7 h-7" fill="none">
          <circle cx="48" cy="48" r="44" fill="#00BCF2"/>
          <path d="M24 48c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 24-24 24-24-10.7-24-24z" fill="#fff" opacity=".25"/>
          <path d="M36 36l24 12-24 12V36z" fill="#fff"/>
        </svg>
      ),
      status:  azureConnected ? 'connected' : 'not_configured',
      detail:  azureConnected ? 'Querying via Microsoft Graph v1.0 + beta' : 'Requires Azure Entra ID',
      meta: azureConnected ? {
        'Endpoint':        'https://graph.microsoft.com/v1.0',
        'Beta Endpoint':   'https://graph.microsoft.com/beta',
        'Auth':            'Bearer token (Entra ID app)',
        'Key Permissions': 'SecurityEvents.Read, AuditLog.Read, Policy.Read, Directory.Read',
      } : {},
      actions: [
        {
          label: 'View Required Permissions',
          href:  '/assess',
        },
        {
          label: 'Graph Explorer',
          href:  'https://developer.microsoft.com/en-us/graph/graph-explorer',
        },
      ],
    },
  ]

  // Future placeholder integrations
  const comingSoon = [
    { name: 'ServiceNow',    description: 'Sync compliance findings to ServiceNow GRC tickets',         category: 'GRC' },
    { name: 'Splunk',        description: 'Forward assessment results to Splunk SIEM for correlation',   category: 'SIEM' },
    { name: 'Jira',          description: 'Auto-create Jira issues for failed compliance controls',      category: 'Ticketing' },
    { name: 'Slack',         description: 'Post assessment summaries and alerts to Slack channels',      category: 'Notifications' },
    { name: 'Microsoft Teams', description: 'Send compliance score updates and alerts to Teams channels', category: 'Notifications' },
    { name: 'Okta',          description: 'Extend identity assessments to Okta-managed users and apps',  category: 'Identity' },
  ]

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

      {/* Active integrations */}
      <h2 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Active Integrations</h2>
      <div className="space-y-4 mb-10">
        {loadingStatus ? (
          <div className="bg-white rounded-xl border border-[#E9E5DD] p-8 flex items-center justify-center shadow-card">
            <Loader2 className="w-5 h-5 animate-spin text-[#C4BFB5]" />
          </div>
        ) : integrations.map(intg => (
          <div key={intg.id} className="bg-white rounded-xl border border-[#E9E5DD] overflow-hidden shadow-card">

            {/* Card header */}
            <div className="flex items-start gap-4 p-5 border-b border-[#F0EDE6]">
              <div className="w-11 h-11 rounded-xl bg-[#F7F5F1] border border-[#E9E5DD] flex items-center justify-center shrink-0">
                {intg.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-[15px] font-semibold text-[#18181B]">{intg.name}</h3>
                  <span className="text-[10px] font-medium text-[#9CA3AF] bg-[#F7F5F1] border border-[#E9E5DD] px-2 py-0.5 rounded-full">
                    {intg.category}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed">{intg.description}</p>
              </div>
              <div className="shrink-0">
                {intg.status === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF] bg-[#F7F5F1] border border-[#E9E5DD] px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" />
                    Not configured
                  </span>
                )}
              </div>
            </div>

            {/* Metadata grid */}
            {intg.meta && Object.keys(intg.meta).length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 px-5 py-4 bg-[#FAFAF8] border-b border-[#F0EDE6]">
                {Object.entries(intg.meta).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-semibold text-[#C4BFB5] uppercase tracking-widest">{k}</p>
                    <p className="text-[12px] text-[#374151] font-mono mt-0.5 truncate">{v}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 px-5 py-3">
              {intg.actions.map((action, i) => (
                action.href?.startsWith('http') ? (
                  <a
                    key={i}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#18181B] bg-white border border-[#E9E5DD] hover:bg-[#F7F5F1] px-3 py-1.5 rounded-lg transition"
                  >
                    {action.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <button
                    key={i}
                    onClick={action.onClick ?? (() => action.href && router.push(action.href))}
                    disabled={testing && action.label === 'Test Connection'}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-60 disabled:cursor-wait ${
                      action.primary
                        ? 'text-white bg-[#18181B] hover:bg-[#27272A]'
                        : 'text-[#6B7280] hover:text-[#18181B] bg-white border border-[#E9E5DD] hover:bg-[#F7F5F1]'
                    }`}
                  >
                    {testing && action.label === 'Test Connection'
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Testing…</>
                      : <>
                          {action.label === 'Test Connection'    && <Activity  className="w-3 h-3" />}
                          {action.label === 'Reconfigure'        && <Settings  className="w-3 h-3" />}
                          {action.label === 'Connect'            && <Plug      className="w-3 h-3" />}
                          {action.label.includes('Permissions')  && <Lock      className="w-3 h-3" />}
                          {action.label === 'Graph Explorer'     && <Globe     className="w-3 h-3" />}
                          {action.label}
                        </>
                    }
                  </button>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <h2 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Coming Soon</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {comingSoon.map(intg => (
          <div key={intg.name} className="bg-white rounded-xl border border-[#E9E5DD] p-4 opacity-60 shadow-card">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#D4CFC5]" />
                <span className="text-[13px] font-semibold text-[#9CA3AF]">{intg.name}</span>
              </div>
              <span className="text-[10px] font-medium text-[#C4BFB5] bg-[#F7F5F1] border border-[#E9E5DD] px-2 py-0.5 rounded-full">
                {intg.category}
              </span>
            </div>
            <p className="text-[11px] text-[#C4BFB5] leading-relaxed">{intg.description}</p>
          </div>
        ))}
      </div>

    </div>
  )
}
