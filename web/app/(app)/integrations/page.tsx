'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Activity,
  Loader2,
  Building2,
  Settings,
  Globe,
  Lock,
  Zap,
  Bell,
  Database,
  FolderOpen,
  ChevronDown,
  Eye,
  EyeOff,
  Blocks,
  Cable,
  Search,
  AlertTriangle,
  Filter,
} from 'lucide-react'
import type { TicketNomination } from '@/lib/api'
import {
  getConfigStatus,
  testConfig,
  getClients,
  getClientIntegrations,
  saveClientIntegration,
  testClientIntegration,
  getM365GrantStatus,
} from '@/lib/api'
import type { Client, ClientIntegration } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnStatus = 'connected' | 'error' | 'pending' | 'not_connected'
type FilterTab = 'all' | 'connected' | 'available'

interface PlatformField {
  key: string
  label: string
  placeholder?: string
  type?: 'password' | 'text'
}

// ─── Platform meta ────────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  string,
  {
    name: string
    color: string
    description: string
    category: string
    categoryIcon: React.ElementType
    soon?: boolean
    fields: PlatformField[]
  }
> = {
  servicenow: {
    name: 'ServiceNow',
    color: '#81B5A1',
    description:
      'Synchronize compliance tasks and automate ticket generation for control failures.',
    category: 'GRC / ITSM',
    categoryIcon: Zap,
    fields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://company.service-now.com' },
      { key: 'username', label: 'Username', placeholder: 'admin' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
  splunk: {
    name: 'Splunk',
    color: '#FF6A00',
    description: 'Ingest security logs and events to populate evidence for continuous monitoring.',
    category: 'SIEM',
    categoryIcon: Activity,
    fields: [
      { key: 'baseUrl', label: 'Splunk URL', placeholder: 'https://splunk.company.com:8089' },
      { key: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  jira: {
    name: 'Atlassian Jira',
    color: '#0052CC',
    description: 'Link audit findings to Jira issues for engineering and dev teams to remediate.',
    category: 'Ticketing',
    categoryIcon: Zap,
    fields: [
      { key: 'domain', label: 'Jira Domain', placeholder: 'company.atlassian.net' },
      { key: 'email', label: 'Email', placeholder: 'admin@company.com' },
      { key: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  slack: {
    name: 'Slack',
    color: '#4A154B',
    description: 'Real-time alerts for critical compliance regressions sent to dedicated channels.',
    category: 'Productivity',
    categoryIcon: Bell,
    fields: [
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://hooks.slack.com/services/...',
      },
    ],
  },
  teams: {
    name: 'Microsoft Teams',
    color: '#464EB8',
    description: 'Integrated notification workflow and collaboration for the governance team.',
    category: 'Productivity',
    categoryIcon: Bell,
    fields: [
      {
        key: 'webhookUrl',
        label: 'Incoming Webhook URL',
        placeholder: 'https://outlook.office.com/webhook/...',
      },
    ],
  },
  workday: {
    name: 'Workday',
    color: '#F5820E',
    description:
      'Automate employee offboarding audits and verify access revocation across systems.',
    category: 'HRIS',
    categoryIcon: Building2,
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://wd2.myworkday.com/...' },
      { key: 'tenantName', label: 'Tenant Name', placeholder: 'company' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
  monday: {
    name: 'Monday.com',
    color: '#F2484B',
    description: 'Track compliance tasks and milestones',
    category: 'Project Mgmt',
    categoryIcon: Zap,
    fields: [{ key: 'apiToken', label: 'API Token', type: 'password' }],
  },
  box: {
    name: 'Box',
    color: '#0061D5',
    description: 'Evidence collection from Box storage',
    category: 'Storage',
    categoryIcon: FolderOpen,
    fields: [
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'enterpriseId', label: 'Enterprise ID' },
    ],
  },
  dropbox: {
    name: 'Dropbox',
    color: '#0061FE',
    description: 'Evidence documents from Dropbox Business',
    category: 'Storage',
    categoryIcon: FolderOpen,
    fields: [{ key: 'accessToken', label: 'Access Token', type: 'password' }],
  },
  sentinel: {
    name: 'Azure Sentinel',
    color: '#0078D4',
    description: 'Security event ingestion from Sentinel',
    category: 'SIEM',
    categoryIcon: Activity,
    soon: true,
    fields: [],
  },
  defender: {
    name: 'MS Defender',
    color: '#00BCF2',
    description: 'Endpoint compliance and threat signals',
    category: 'Security',
    categoryIcon: Database,
    soon: true,
    fields: [],
  },
  aws: {
    name: 'AWS Security Hub',
    color: '#FF9900',
    description: 'Multi-cloud compliance posture data',
    category: 'Cloud',
    categoryIcon: Database,
    soon: true,
    fields: [],
  },
}

// ─── Ticket Nominations Panel ──────────────────────────────────────────────

function TicketNominationsPanel({
  clientId,
  platform,
}: {
  clientId: string
  platform: 'jira' | 'servicenow'
}) {
  const [scanning, setScanning] = useState(false)
  const [nominations, setNominations] = useState<TicketNomination[]>([])
  const [scanResult, setScanResult] = useState<{ scanned: number; nominated: number } | null>(null)
  const [projectKey, setProjectKey] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    import('@/lib/api').then(({ getTicketNominations }) =>
      getTicketNominations(clientId).then(setNominations).catch(console.error)
    )
  }, [clientId])

  async function scan() {
    setScanning(true)
    try {
      const { scanTicketNominations, getTicketNominations } = await import('@/lib/api')
      const result = await scanTicketNominations(
        clientId,
        platform,
        'CMMC_L2',
        projectKey || undefined
      )
      setScanResult({ scanned: result.scanned, nominated: result.nominated })
      const fresh = await getTicketNominations(clientId)
      setNominations(fresh)
    } catch (err: any) {
      alert('Scan failed: ' + err.message)
    } finally {
      setScanning(false)
    }
  }

  async function updateStatus(nomId: string, status: 'accepted' | 'rejected') {
    setUpdating(nomId)
    const { updateNominationStatus } = await import('@/lib/api')
    await updateNominationStatus(clientId, nomId, status)
    setNominations((prev) => prev.map((n) => (n.id === nomId ? { ...n, status } : n)))
    setUpdating(null)
  }

  const pending = nominations.filter((n) => n.status === 'pending')
  const accepted = nominations.filter((n) => n.status === 'accepted')

  const confidenceColor = (c: number) => (c >= 60 ? '#0eb472' : c >= 35 ? '#f59e0b' : '#a8a29e')

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <p className="text-[13px] font-semibold text-ink mb-1">Ticket Nomination Engine</p>
        <p className="text-[11px] text-faint">
          Scan {platform === 'jira' ? 'Jira' : 'ServiceNow'} tickets and map them to compliance
          controls
        </p>
      </div>

      <div className="px-5 py-4 flex items-end gap-3 border-b border-[#f3f4f6]">
        {platform === 'jira' && (
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-faint mb-1.5 uppercase tracking-wide">
              Project Key (optional)
            </label>
            <input
              type="text"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              placeholder="e.g. SEC"
              className="w-full text-[13px] text-ink bg-canvas border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-[#1c1d1f] transition-colors"
            />
          </div>
        )}
        <button
          onClick={scan}
          disabled={scanning}
          className="flex items-center gap-2 text-[13px] font-medium text-white px-4 py-2 rounded-lg transition-colors shrink-0 hover:bg-ink"
          style={{ background: '#1c1917' }}
        >
          {scanning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…
            </>
          ) : (
            'Scan Tickets'
          )}
        </button>
      </div>

      {scanResult && (
        <div className="px-5 py-3 bg-[rgba(14,180,114,0.05)] border-b border-[rgba(14,180,114,0.15)] text-[12px] text-muted">
          Scanned <strong>{scanResult.scanned}</strong> tickets · found{' '}
          <strong>{scanResult.nominated}</strong> nominations
        </div>
      )}

      {nominations.length === 0 ? (
        <div className="px-5 py-6 text-[12px] text-faint text-center">
          No nominations yet — run a scan to map tickets to controls.
        </div>
      ) : (
        <div>
          {pending.length > 0 && (
            <>
              <div className="px-5 py-2.5 bg-canvas border-b border-[#f3f4f6]">
                <p className="text-[10px] font-semibold text-faint uppercase tracking-wide">
                  {pending.length} Pending Review
                </p>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {pending.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-ink truncate">{n.ticketTitle}</p>
                      <p className="text-[11px] text-faint">
                        <span className="font-mono">{n.ticketId}</span> → {n.controlId} ·{' '}
                        {n.controlTitle}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-semibold shrink-0 tabular-nums"
                      style={{ color: confidenceColor(n.confidence) }}
                    >
                      {n.confidence}%
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => updateStatus(n.id, 'accepted')}
                        disabled={updating === n.id}
                        className="text-[11px] font-medium text-[#0eb472] bg-[rgba(14,180,114,0.08)] hover:bg-[rgba(14,180,114,0.15)] px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => updateStatus(n.id, 'rejected')}
                        disabled={updating === n.id}
                        className="text-[11px] font-medium text-[#f25757] bg-[rgba(242,87,87,0.08)] hover:bg-[rgba(242,87,87,0.15)] px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {accepted.length > 0 && (
            <>
              <div className="px-5 py-2.5 bg-canvas border-y border-[#f3f4f6]">
                <p className="text-[10px] font-semibold text-faint uppercase tracking-wide">
                  {accepted.length} Accepted
                </p>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {accepted.slice(0, 5).map((n) => (
                  <div key={n.id} className="flex items-center gap-3 px-5 py-3 opacity-70">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-ink truncate">{n.ticketTitle}</p>
                      <p className="text-[11px] text-faint">
                        {n.ticketId} → {n.controlId}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#0eb472]">✓</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
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
  const [values, setValues] = useState<Record<string, string>>({})
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (!meta) return null

  function setVal(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }))
    setTestResult(null)
  }

  function allFilled() {
    return meta.fields.every((f) => (values[f.key] ?? '').trim() !== '')
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testClientIntegration(clientId, platformId, values)
      setTestResult({
        ok: result.ok,
        msg: result.ok
          ? 'Connection successful — credentials verified'
          : (result.error ?? 'Connection failed'),
      })
      if (result.ok) onSaved()
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
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-bold"
            style={{ background: meta.color + '18', color: meta.color }}
          >
            {meta.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-ink">
              {existing?.status === 'connected' ? 'Reconfigure' : 'Connect'} {meta.name}
            </h2>
            <p className="text-[11px] text-faint truncate">{meta.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-canvas transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          {meta.fields.map((field) => {
            const isPwd = field.type === 'password'
            const isShow = showPwd[field.key]
            return (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    type={isPwd && !isShow ? 'password' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setVal(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 text-[13px] rounded-lg border border-border bg-surface text-ink placeholder-[#d6d3d1] focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/10 focus:border-[#78716c] transition pr-9"
                  />
                  {isPwd && (
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => ({ ...s, [field.key]: !s[field.key] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
                    >
                      {isShow ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Test result */}
          {testResult && (
            <div
              className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[12px] border ${
                testResult.ok
                  ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              )}
              <span className="leading-snug">{testResult.msg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border-subtle bg-canvas">
          <button
            onClick={handleTest}
            disabled={!allFilled() || testing || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg border border-border bg-surface text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            Test Connection
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-border bg-surface text-muted hover:bg-surface-sunken transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!allFilled() || saving || testing}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg bg-ink text-on-accent hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed transition"
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
  const styles: Record<
    ConnStatus,
    { label: string; dot: string; text: string; bg: string; border: string }
  > = {
    connected: {
      label: 'Connected',
      dot: 'bg-[#16A34A] animate-pulse',
      text: 'text-[#16A34A]',
      bg: 'bg-[#F0FDF4]',
      border: 'border-[#BBF7D0]',
    },
    error: {
      label: 'Error',
      dot: 'bg-[#DC2626]',
      text: 'text-[#DC2626]',
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
    },
    pending: {
      label: 'Credentials saved',
      dot: 'bg-[#D97706]',
      text: 'text-[#D97706]',
      bg: 'bg-[#FFFBEB]',
      border: 'border-[#FDE68A]',
    },
    not_connected: {
      label: 'Not connected',
      dot: 'bg-[#d6d3d1]',
      text: 'text-faint',
      bg: 'bg-canvas',
      border: 'border-border',
    },
  }
  const s = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.text} ${s.bg} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function ConnectedBadge() {
  return (
    <span className="bg-[#e7e5e4] text-ink text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
      Connected
    </span>
  )
}

function PlatformLogo({ color, name }: { color: string; name: string }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-canvas"
      style={{ color }}
    >
      <span className="text-[14px] font-bold">{name.charAt(0)}</span>
    </div>
  )
}

// ─── Microsoft Entra Card (redesigned) ──────────────────────────────────────

function MicrosoftEntraCard({
  connected,
  tenantName,
  tenantId,
  clientId,
  authSource,
  onReconfigure,
  onTest,
  testing,
}: {
  connected: boolean
  tenantName: string
  tenantId: string
  clientId?: string
  authSource?: 'grant' | 'legacy'
  onReconfigure: () => void
  onTest: () => void
  testing: boolean
}) {
  // OAuth admin-consent: no secret is ever entered. These navigate the browser to
  // Microsoft's consent screen via our authorize route. Read connect always works:
  // with a selected client it reconnects that client; without one it starts a
  // "new tenant" flow and the callback creates the client from the consented
  // tenant. Write access is a separate consent round and requires an existing
  // connection (tier=write).
  const connectHref = clientId
    ? `/api/connectors/m365/authorize?clientId=${clientId}&tier=read`
    : `/api/connectors/m365/authorize?tier=read`
  const writeHref = clientId
    ? `/api/connectors/m365/authorize?clientId=${clientId}&tier=write`
    : undefined
  return (
    <div className="bg-canvas rounded-xl p-6 flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 96 96" className="w-8 h-8" fill="none">
              <path d="M48 4L4 20v56l44 16 44-16V20L48 4z" fill="#0078D4" />
              <path d="M48 4v88l44-16V20L48 4z" fill="#0050B3" opacity=".6" />
              <path d="M27 34h14l20 28H47L27 34zm28 0h14L49 62H35L55 34z" fill="#fff" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-ink">Microsoft Entra ID</h4>
            <p className="text-xs text-muted">Identity & Access Management</p>
          </div>
        </div>
        {connected ? <ConnectedBadge /> : <StatusPill status="not_connected" />}
      </div>

      {connected && (
        <div className="grid grid-cols-2 gap-y-4 gap-x-8 py-4 border-y border-[#a8a29e]/10">
          {[
            ['Tenant Name', tenantName],
            ['Auth Method', authSource === 'grant' ? 'Admin Consent (OAuth)' : 'Legacy App Secret'],
            ['Tenant ID', tenantId],
            ['Current Scope', 'Graph application (admin-consented)'],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase font-bold text-muted tracking-tighter mb-1">
                {k}
              </p>
              <p
                className={`text-sm font-medium ${k === 'Tenant ID' ? 'font-mono text-xs text-muted' : 'text-ink'}`}
              >
                {v}
              </p>
            </div>
          ))}
        </div>
      )}

      {connected && authSource === 'legacy' && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warn-border bg-status-warn-bg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-status-warn shrink-0 mt-0.5" />
          <p className="text-[12px] text-ink">
            Connected with a legacy app secret. Reconnect with Microsoft to upgrade to admin-consent
            — no secret to manage, and a prerequisite for remediation.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-auto">
        <a
          href={connectHref ?? '#'}
          aria-disabled={!connectHref}
          className={`text-xs font-semibold py-2 px-4 rounded-lg transition-colors ${
            connectHref
              ? 'bg-ink text-on-accent hover:bg-brand-hover'
              : 'bg-surface-sunken text-faint pointer-events-none'
          }`}
        >
          {connected ? 'Reconnect with Microsoft' : 'Connect with Microsoft'}
        </a>
        {connected && (
          <a
            href={writeHref ?? '#'}
            aria-disabled={!writeHref}
            className={`text-xs font-semibold py-2 px-4 rounded-lg border transition-colors ${
              writeHref
                ? 'border-border-strong text-ink hover:bg-surface-sunken'
                : 'border-border text-faint pointer-events-none'
            }`}
          >
            Enable remediation (write access)
          </a>
        )}
        {connected && (
          <button
            onClick={onTest}
            disabled={testing}
            className="text-ink text-xs font-semibold py-2 px-4 rounded-lg border border-border-strong hover:bg-surface-sunken transition-colors disabled:opacity-60"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
            Test Connection
          </button>
        )}
        <button
          onClick={onReconfigure}
          className="text-faint text-xs font-medium py-2 px-3 rounded-lg hover:text-ink transition-colors"
        >
          Legacy setup
        </button>
      </div>
    </div>
  )
}

// ─── Integration Tile (redesigned) ──────────────────────────────────────────

interface IntegrationTileProps {
  id: string
  intg?: ClientIntegration
  onConnect: (id: string) => void
}

function IntegrationTile({ id, intg, onConnect }: IntegrationTileProps) {
  const meta = PLATFORM_META[id]
  const status = (intg?.status ?? 'not_connected') as ConnStatus
  const isActive = status === 'connected'

  if (!meta) return null

  return (
    <div
      className={[
        'bg-surface p-6 rounded-xl group hover:shadow-lg transition-all duration-300',
        isActive ? 'border-l-4 border-[#1c1917]' : '',
        meta.soon ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* Top: logo + category badge */}
      <div className="flex items-start justify-between mb-4">
        <PlatformLogo color={meta.color} name={meta.name} />
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-muted border border-border px-2 py-0.5 rounded-full uppercase tracking-tighter">
            {meta.category}
          </span>
          {isActive && (
            <span className="text-[8px] font-bold text-ink flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-ink rounded-full" /> ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Name + description */}
      <h5 className="font-bold text-ink mb-1">{meta.name}</h5>
      <p className="text-xs text-muted line-clamp-2 mb-6">{meta.description}</p>

      {/* Error message */}
      {intg?.errorMessage && status === 'error' && (
        <p className="text-[10px] text-[#DC2626] mb-3 truncate" title={intg.errorMessage}>
          {intg.errorMessage}
        </p>
      )}

      {/* Bottom button */}
      {!meta.soon &&
        (isActive ? (
          <button
            onClick={() => onConnect(id)}
            className="w-full bg-[#e7e5e4] text-ink text-xs font-bold py-2.5 rounded-lg hover:bg-[#d6d3d1] transition-all duration-200"
          >
            Manage
          </button>
        ) : (
          <button
            onClick={() => onConnect(id)}
            className="w-full bg-surface-sunken text-muted group-hover:bg-ink group-hover:text-white text-xs font-bold py-2.5 rounded-lg transition-all duration-200"
          >
            Connect
          </button>
        ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const router = useRouter()

  const [configStatus, setConfigStatus] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [integrations, setIntegrations] = useState<ClientIntegration[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingIntgs, setLoadingIntgs] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [filter, setFilter] = useState<FilterTab>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [configuringPlatform, setConfiguringPlatform] = useState<string | null>(null)
  const [m365Grant, setM365Grant] = useState<{ connected: boolean; tier: 'read' | 'write' | null }>(
    { connected: false, tier: null }
  )

  // Surface the OAuth admin-consent callback result (?m365=connected|error).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const m365 = sp.get('m365')
    if (!m365) return
    if (m365 === 'connected') {
      setTestResult({ ok: true, msg: 'Microsoft 365 connected via admin consent.' })
    } else {
      setTestResult({
        ok: false,
        msg: `Microsoft connection failed: ${sp.get('reason') ?? 'unknown'}`,
      })
    }
    // Strip the query so a refresh doesn't re-show the banner.
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Load the M365 admin-consent grant status for the active client (grant vs legacy).
  useEffect(() => {
    if (!selectedClient) {
      setM365Grant({ connected: false, tier: null })
      return
    }
    getM365GrantStatus(selectedClient.id)
      .then(setM365Grant)
      .catch(() => setM365Grant({ connected: false, tier: null }))
  }, [selectedClient])

  useEffect(() => {
    getConfigStatus()
      .then((s) => setConfigStatus(s))
      .catch(() => setConfigStatus(null))
      .finally(() => setLoadingStatus(false))

    getClients()
      .then((list) => {
        setClients(list)
        if (list.length > 0) setSelectedClient(list[0])
      })
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
    if (!selectedClient) {
      setIntegrations([])
      return
    }
    refreshIntegrations()
  }, [selectedClient, refreshIntegrations])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testConfig()
      setTestResult({
        ok: !!res.ok,
        msg: res.tenantName ? `Connected — ${res.tenantName}` : 'Connection successful',
      })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  function getIntegration(id: string) {
    return integrations.find((i) => i.platform === id)
  }

  const azureConnected = !!configStatus?.configured
  const tenantName = configStatus?.tenantName ?? '—'
  const tenantId = configStatus?.tenantId ?? '—'

  const platformIds = Object.keys(PLATFORM_META)
  const connectedIds = platformIds.filter((id) => getIntegration(id)?.status === 'connected')
  const availableIds = platformIds.filter((id) => getIntegration(id)?.status !== 'connected')

  // Apply tab filter
  const tabFiltered =
    filter === 'connected' ? connectedIds : filter === 'available' ? availableIds : platformIds

  // Apply search filter
  const filteredIds = filterSearch.trim()
    ? tabFiltered.filter((id) => {
        const meta = PLATFORM_META[id]
        const q = filterSearch.toLowerCase()
        return meta.name.toLowerCase().includes(q) || meta.category.toLowerCase().includes(q)
      })
    : tabFiltered

  const filterCounts = {
    all: platformIds.length,
    connected: connectedIds.length,
    available: availableIds.length,
  }

  return (
    <div className="p-8 max-w-6xl pb-12">
      {/* ── Page Header ── */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Integrations</h1>
        <p className="text-muted mt-1 text-sm max-w-2xl">
          Connect Atlas to your organization's security and productivity tools to automate evidence
          collection and risk monitoring.
        </p>
      </div>

      {/* Test result banner */}
      {testResult && (
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-6 border ${
            testResult.ok
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="text-[12px] font-medium flex-1">{testResult.msg}</span>
          <button
            onClick={() => setTestResult(null)}
            className="text-sm opacity-40 hover:opacity-80 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Microsoft Platform ── */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Blocks className="w-5 h-5 text-ink" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-faint">
            Microsoft Platform
          </h3>
        </div>

        {loadingStatus ? (
          <div className="bg-canvas rounded-xl p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-faint" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MicrosoftEntraCard
              connected={azureConnected || m365Grant.connected}
              tenantName={tenantName}
              tenantId={tenantId}
              clientId={selectedClient?.id}
              authSource={m365Grant.connected ? 'grant' : azureConnected ? 'legacy' : undefined}
              onReconfigure={() => router.push('/setup')}
              onTest={handleTest}
              testing={testing}
            />

            {/* Microsoft Graph API card */}
            <div className="bg-canvas rounded-xl p-6 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center">
                    <svg viewBox="0 0 96 96" className="w-8 h-8" fill="none">
                      <circle cx="48" cy="48" r="44" fill="#00BCF2" />
                      <path
                        d="M24 48c0-13.3 10.7-24 24-24s24 10.7 24 24-10.7 24-24 24-24-10.7-24-24z"
                        fill="#fff"
                        opacity=".25"
                      />
                      <path d="M36 36l24 12-24 12V36z" fill="#fff" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-ink">Microsoft Graph API</h4>
                    <p className="text-xs text-muted">Data Fabric & Unified API</p>
                  </div>
                </div>
                {azureConnected ? <ConnectedBadge /> : <StatusPill status="not_connected" />}
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-8 py-4 border-y border-[#a8a29e]/10">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-tighter mb-1">
                    Endpoint
                  </p>
                  <p className="text-sm font-medium text-ink">graph.microsoft.com/v1.0</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-tighter mb-1">
                    Auth Method
                  </p>
                  <p className="text-sm font-medium text-ink">Client Credentials</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-tighter mb-1">
                    Latency
                  </p>
                  <p className="text-sm font-medium text-ink">
                    ~120ms <span className="text-ink text-[10px] ml-1">(Optimal)</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted tracking-tighter mb-1">
                    Permission Level
                  </p>
                  <p className="text-sm font-medium text-ink">AuditLog.Read.All</p>
                </div>
              </div>

              <div className="flex gap-3 mt-auto">
                <a
                  href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#e7e5e4] text-ink text-xs font-semibold py-2 px-4 rounded-lg hover:bg-[#d6d3d1] transition-colors inline-flex items-center gap-1.5"
                >
                  Graph Explorer <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => router.push('/assess')}
                  className="text-ink text-xs font-semibold py-2 px-4 rounded-lg border border-[#1c1917]/20 hover:bg-ink/5 transition-colors"
                >
                  View Permissions
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Client Integrations ── */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Cable className="w-5 h-5 text-faint" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-faint">
              Client Integrations
            </h3>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Search input */}
            <div className="relative flex-1 md:w-72">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg text-xs py-2 pl-9 focus:ring-2 focus:ring-[color:var(--text-ink)]/15 focus:outline-none"
                placeholder="Filter by name or category..."
              />
            </div>

            {/* Filter tabs */}
            <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
              {(['all', 'connected', 'available'] as FilterTab[]).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={[
                    'px-3 py-2 text-xs font-medium capitalize transition-colors',
                    i < 2 ? 'border-r border-border' : '',
                    filter === tab
                      ? 'bg-[#d6d3d1] font-bold text-ink'
                      : 'bg-surface text-muted hover:bg-canvas',
                  ].join(' ')}
                >
                  {tab}
                  <span
                    className={`ml-1 text-[10px] ${filter === tab ? 'text-faint' : 'text-faint'}`}
                  >
                    {filterCounts[tab]}
                  </span>
                </button>
              ))}
            </div>

            {/* Client selector */}
            {!loadingClients && clients.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-canvas text-xs font-medium text-ink transition"
                >
                  <Building2 className="w-3.5 h-3.5 text-faint" />
                  {selectedClient?.name ?? 'Select client'}
                  <ChevronDown className="w-3 h-3 text-faint" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl z-10 min-w-[180px] overflow-hidden">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedClient(c)
                          setDropdownOpen(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-[12px] font-medium transition ${
                          selectedClient?.id === c.id
                            ? 'bg-canvas text-ink'
                            : 'text-ink hover:bg-canvas'
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
        </div>

        {loadingClients ? (
          <div className="bg-canvas rounded-xl p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-faint" />
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-10 text-center">
            <Building2 className="w-8 h-8 text-[#d6d3d1] mx-auto mb-3" />
            <p className="text-[13px] font-medium text-faint mb-1">No clients yet</p>
            <p className="text-[12px] text-faint">
              Add a client on the{' '}
              <button onClick={() => router.push('/clients')} className="text-ink hover:underline">
                Clients page
              </button>{' '}
              to configure integrations.
            </p>
          </div>
        ) : (
          <>
            {loadingIntgs ? (
              <div className="bg-canvas rounded-xl p-10 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-faint" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIds.map((id) => (
                  <IntegrationTile
                    key={id}
                    id={id}
                    intg={getIntegration(id)}
                    onConnect={setConfiguringPlatform}
                  />
                ))}
              </div>
            )}

            {filteredIds.length === 0 && !loadingIntgs && (
              <div className="bg-surface rounded-xl border border-border p-10 text-center">
                <p className="text-[13px] text-faint">
                  {filterSearch
                    ? 'No integrations match your search.'
                    : filter === 'connected'
                      ? 'No integrations connected yet.'
                      : 'No integrations available.'}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Ticket Nominations ── */}
      {selectedClient && getIntegration('jira')?.status === 'connected' && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-faint uppercase tracking-widest">
              Ticket Intelligence
            </h2>
            <div className="flex-1 h-px bg-[#e7e5e4]" />
          </div>
          <TicketNominationsPanel
            key={`jira-${selectedClient.id}`}
            clientId={selectedClient.id}
            platform="jira"
          />
        </div>
      )}
      {selectedClient && getIntegration('servicenow')?.status === 'connected' && (
        <div className="mt-8">
          {getIntegration('jira')?.status !== 'connected' && (
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-bold text-faint uppercase tracking-widest">
                Ticket Intelligence
              </h2>
              <div className="flex-1 h-px bg-[#e7e5e4]" />
            </div>
          )}
          <TicketNominationsPanel
            key={`sn-${selectedClient.id}`}
            clientId={selectedClient.id}
            platform="servicenow"
          />
        </div>
      )}

      {/* ── Bottom Insight Cards ── */}
      <div className="mt-12 flex flex-col lg:flex-row gap-6">
        {/* Promotional card */}
        <div className="flex-1 bg-[#0c0a09] rounded-xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-2">Automated Evidence Collection</h4>
            <p className="text-[#e7e5e4] opacity-90 max-w-lg text-sm leading-relaxed">
              By connecting your stack, you automate the majority of evidence requirements for SOC
              2, ISO 27001, and more. Review data mapping in the Insights panel.
            </p>
            <div className="mt-6 flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">
                  {connectedIds.length}/{platformIds.length}
                </p>
                <p className="text-[10px] uppercase font-bold opacity-60">Systems Linked</p>
              </div>
              <div className="w-px h-10 bg-surface/20" />
              <div>
                <p className="text-2xl font-bold">—</p>
                <p className="text-[10px] uppercase font-bold opacity-60">Monthly Syncs</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alert card */}
        <div className="lg:w-80 bg-[#d6d3d1] rounded-xl p-6 flex flex-col justify-center border-l-4 border-[#9f403d]">
          <AlertTriangle className="w-6 h-6 text-[#9f403d] mb-2" />
          <h5 className="font-bold text-ink mb-1">Integration Alert</h5>
          <p className="text-xs text-muted mb-4">
            Check your integration tokens regularly. Expired tokens can cause service interruptions
            for evidence collection.
          </p>
          <button
            onClick={() => setFilter('connected')}
            className="text-[#9f403d] text-xs font-bold hover:underline text-left"
          >
            Review connected integrations →
          </button>
        </div>
      </div>

      {/* ── Configure Modal ── */}
      {configuringPlatform && selectedClient && (
        <ConfigureModal
          clientId={selectedClient.id}
          platformId={configuringPlatform}
          existing={getIntegration(configuringPlatform)}
          onClose={() => setConfiguringPlatform(null)}
          onSaved={() => {
            refreshIntegrations()
          }}
        />
      )}
    </div>
  )
}
