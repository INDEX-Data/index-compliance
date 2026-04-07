'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2, Users, UserPlus, Mail, Clock, Check,
  X, Trash2, Copy, CheckCircle2, Plug, Bell,
  Shield, ChevronRight, AlertTriangle, ExternalLink,
} from 'lucide-react'
import {
  getConfigStatus, getTeamInvites, createTeamInvite,
  revokeTeamInvite, getTeamMembers, removeTeamMember,
} from '@/lib/api'
import type { TeamInvite, TeamMember } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'team' | 'integrations' | 'api-access' | 'notifications'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general',       label: 'General',       icon: Building2 },
  { id: 'team',          label: 'Team',          icon: Users },
  { id: 'integrations',  label: 'Integrations',  icon: Plug },
  { id: 'api-access',    label: 'API Access',    icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d ${h % 24}h left`
  return `${h}h left`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children, last }: {
  title: string; description?: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div className={`py-7 ${!last ? 'border-b border-[#f5f5f4]' : ''}`}>
      <div className="mb-5">
        <h3 className="text-[14px] font-semibold text-[#1c1d1f]">{title}</h3>
        {description && <p className="text-[13px] text-[#78716c] mt-1 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ tenantName, clientCount, loading }: {
  tenantName: string; clientCount: number; loading: boolean
}) {
  const router = useRouter()

  return (
    <div>
      <Section title="Primary Azure Tenant" description="The Microsoft Entra ID tenant used for compliance assessments.">
        <div className="bg-[#fafafa] rounded-xl border border-[#e7e5e4] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center">
                <svg viewBox="0 0 96 96" className="w-5 h-5" fill="none">
                  <path d="M48 4L4 20v56l44 16 44-16V20L48 4z" fill="#0078D4"/>
                  <path d="M48 4v88l44-16V20L48 4z" fill="#0050B3" opacity=".6"/>
                  <path d="M27 34h14l20 28H47L27 34zm28 0h14L49 62H35L55 34z" fill="#fff"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#1c1d1f]">
                  {loading ? 'Loading…' : tenantName || 'Not configured'}
                </p>
                <p className="text-[11px] text-[#78716c] mt-0.5">Microsoft Entra ID</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push('/setup')}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#78716c] hover:text-[#1c1d1f] transition"
        >
          Reconfigure Azure credentials <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </Section>

      <Section
        title="MSP / Multi-Client Mode"
        description="Manage multiple Microsoft 365 tenants and run compliance assessments across all client environments."
        last
      >
        <div className="flex items-center justify-between p-4 bg-[#fafafa] rounded-xl border border-[#e7e5e4]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-[#e7e5e4] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#78716c]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1c1d1f]">
                {loading ? '—' : `${clientCount} ${clientCount === 1 ? 'client' : 'clients'}`}
              </p>
              <p className="text-[11px] text-[#78716c] mt-0.5">Active tenants</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/clients')}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1c1d1f] hover:text-[#1c1d1f] bg-white border border-[#e7e5e4] hover:bg-[#fafafa] px-3 py-1.5 rounded-lg transition"
          >
            Manage clients <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </Section>
    </div>
  )
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab() {
  const [invites,  setInvites]  = useState<TeamInvite[]>([])
  const [members,  setMembers]  = useState<TeamMember[]>([])
  const [loading,  setLoading]  = useState(true)
  const [email,    setEmail]    = useState('')
  const [creating, setCreating] = useState(false)
  const [newLink,  setNewLink]  = useState<string | null>(null)
  const [copied,   setCopied]   = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [inv, mem] = await Promise.all([getTeamInvites(), getTeamMembers()])
      setInvites(inv)
      setMembers(mem)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleCreate() {
    if (!email.trim()) return
    setCreating(true); setError(null); setNewLink(null)
    try {
      const result = await createTeamInvite({ email: email.trim() })
      setNewLink(result.link)
      setEmail('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invite')
    } finally { setCreating(false) }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const pendingInvites = invites.filter(i => i.status === 'pending')

  return (
    <div>
      <Section
        title="Invite Team Members"
        description="Generate an invite link to share with colleagues. Links expire after 7 days."
      >
        {/* Invite form */}
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="flex-1 text-[13px] border border-[#e7e5e4] rounded-lg px-3.5 py-2.5 outline-none focus:border-[#1c1917] focus:ring-2 focus:ring-[#1c1917]/10 bg-white placeholder-[#a8a29e] transition"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !email.trim()}
            className="px-4 py-2.5 text-[13px] font-semibold text-white bg-[#1c1917] rounded-lg hover:bg-[#0c0a09] active:bg-[#0c0a09] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {creating ? 'Creating…' : 'Generate Link'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Generated link */}
        {newLink && (
          <div className="flex items-center gap-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3">
            <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span className="flex-1 text-[12px] font-mono text-[#16A34A] truncate">{newLink}</span>
            <button
              onClick={() => copyText(newLink, 'new')}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A] hover:text-[#166534]"
            >
              <Copy className="w-3 h-3" />
              {copied === 'new' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </Section>

      {/* Pending invites */}
      {(loading || pendingInvites.length > 0) && (
        <Section title="Pending Invites" description="Awaiting acceptance. Copy the link to resend.">
          {loading ? (
            <div className="text-[13px] text-[#a8a29e]">Loading…</div>
          ) : pendingInvites.length === 0 ? (
            <p className="text-[13px] text-[#78716c]">No pending invites.</p>
          ) : (
            <div className="space-y-2">
              {pendingInvites.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-4 py-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg"
                >
                  <Mail className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                  <span className="flex-1 text-[13px] text-[#1c1d1f] truncate font-medium">{inv.email}</span>
                  <span className="flex items-center gap-1 text-[11px] text-[#D97706] shrink-0">
                    <Clock className="w-3 h-3" />
                    {timeLeft(inv.expiresAt)}
                  </span>
                  <button
                    onClick={() => copyText(`${window.location.origin}/join/${inv.token}`, inv.id)}
                    className="p-1.5 text-[#78716c] hover:text-[#1c1d1f] rounded-lg hover:bg-white/60 transition"
                    title="Copy invite link"
                  >
                    {copied === inv.id ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={async () => { await revokeTeamInvite(inv.id); refresh() }}
                    className="p-1.5 text-[#78716c] hover:text-[#DC2626] rounded-lg hover:bg-white/60 transition"
                    title="Revoke invite"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Active members */}
      <Section title="Team Members" description="People with access to your clients and assessments." last>
        {loading ? (
          <div className="text-[13px] text-[#a8a29e]">Loading…</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Users className="w-8 h-8 text-[#d6d3d1] mb-3" />
            <p className="text-[13px] font-medium text-[#78716c]">No team members yet</p>
            <p className="text-[12px] text-[#a8a29e] mt-1">Generate an invite link above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
                <div className="w-7 h-7 rounded-full bg-[#BBF7D0] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-[#16A34A]">
                    {m.memberId.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="flex-1 text-[12px] font-mono text-[#1c1d1f] truncate">{m.memberId}</span>
                <span className="text-[11px] text-[#505967] shrink-0">Joined {fmtDate(m.joinedAt)}</span>
                <button
                  onClick={async () => { await removeTeamMember(m.id); refresh() }}
                  className="p-1.5 text-[#78716c] hover:text-[#DC2626] rounded-lg hover:bg-white/60 transition"
                  title="Remove member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  const router = useRouter()

  const tools = [
    { name: 'ServiceNow', desc: 'GRC ticketing and change management',  color: '#81B5A1' },
    { name: 'Splunk',     desc: 'SIEM log forwarding and correlation',   color: '#FF6A00' },
    { name: 'Jira',       desc: 'Auto-create issues for failed controls',color: '#0052CC' },
    { name: 'Slack',      desc: 'Post assessment summaries to channels', color: '#4A154B' },
  ]

  return (
    <div>
      <Section title="Connected Tools" description="Manage your third-party integration connections.">
        <button
          onClick={() => router.push('/integrations')}
          className="w-full flex items-center justify-between p-4 bg-[#fafafa] rounded-xl border border-[#e7e5e4] hover:bg-white hover:border-[#d6d3d1] transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-[#e7e5e4] flex items-center justify-center">
              <Plug className="w-4 h-4 text-[#78716c]" />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-[#1c1d1f]">Manage Integrations</p>
              <p className="text-[11px] text-[#78716c] mt-0.5">ServiceNow, Splunk, Jira, Slack and more</p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-[#78716c] group-hover:text-[#1c1d1f] transition" />
        </button>
      </Section>

      <Section title="Available Integrations" description="Tools you can connect to automate workflows." last>
        <div className="grid grid-cols-2 gap-2.5">
          {tools.map(t => (
            <div key={t.name} className="flex items-center gap-3 p-3.5 bg-white border border-[#e7e5e4] rounded-xl">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold"
                style={{ background: t.color + '18', color: t.color }}
              >
                {t.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#1c1d1f]">{t.name}</p>
                <p className="text-[10px] text-[#78716c] mt-0.5 truncate">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push('/integrations')}
          className="mt-3 text-[12px] text-[#78716c] hover:text-[#1c1d1f] font-medium transition flex items-center gap-1"
        >
          View all integrations <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </Section>
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  return (
    <div>
      <Section title="Email Notifications" description="Configure when Atlas sends you compliance alerts." last>
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#e7e5e4] flex items-center justify-center mb-4 shadow-card">
            <Bell className="w-5 h-5 text-[#d6d3d1]" />
          </div>
          <p className="text-[14px] font-semibold text-[#1c1d1f] mb-1">Coming soon</p>
          <p className="text-[13px] text-[#78716c] max-w-xs leading-relaxed">
            Email alerts when controls change status, assessments complete, or team members join.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-3 py-1 rounded-full">
            <Shield className="w-3 h-3" /> On the roadmap
          </span>
        </div>
      </Section>
    </div>
  )
}

// ─── API Access Tab ──────────────────────────────────────────────────────────

type ApiStatus = 'ok' | 'denied' | 'not_licensed' | 'error' | 'unchecked'

interface PermissionsData {
  graph: ApiStatus
  graphBetaSecurity: ApiStatus
  defender: ApiStatus
  managementActivity: ApiStatus
  checkedAt: string
  details: Record<string, string>
}

const API_ROWS: {
  key: keyof Pick<PermissionsData, 'graph' | 'graphBetaSecurity' | 'defender' | 'managementActivity'>
  label: string
  description: string
  permissions: string
}[] = [
  {
    key: 'graph',
    label: 'Microsoft Graph API',
    description: 'Core identity, conditional access, device management, audit logs, secure score',
    permissions: 'User.Read.All, Policy.Read.All, AuditLog.Read.All, DeviceManagementConfiguration.Read.All, SecurityEvents.Read.All',
  },
  {
    key: 'graphBetaSecurity',
    label: 'Graph Security (XDR)',
    description: 'Security incidents, advanced hunting via Graph beta, threat intelligence',
    permissions: 'SecurityIncident.Read.All, ThreatHunting.Read.All',
  },
  {
    key: 'defender',
    label: 'Defender for Endpoint',
    description: 'Device risk scores, vulnerability management, CVEs, security recommendations, KQL hunting',
    permissions: 'Machine.Read.All, Vulnerability.Read.All, AdvancedQuery.Read.All, Alert.Read.All (api.securitycenter.microsoft.com)',
  },
  {
    key: 'managementActivity',
    label: 'Unified Audit Log',
    description: 'DLP events, Exchange/SharePoint/Teams audit, comprehensive compliance logging',
    permissions: 'ActivityFeed.Read (Office 365 Management APIs)',
  },
]

function ApiAccessTab() {
  const [perms, setPerms] = useState<PermissionsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/check-permissions')
      if (!res.ok) throw new Error('Failed to check permissions')
      const data = await res.json()
      setPerms(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { check() }, [check])

  const statusBadge = (status: ApiStatus) => {
    if (status === 'ok') return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Connected
      </span>
    )
    if (status === 'denied') return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" /> Permissions needed
      </span>
    )
    if (status === 'not_licensed') return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#78716c] bg-[#fafafa] border border-[#e7e5e4] px-2 py-0.5 rounded-full">
        <X className="w-3 h-3" /> Not licensed
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EF4444] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" /> Error
      </span>
    )
  }

  return (
    <div>
      <Section
        title="Microsoft API Permissions"
        description="Atlas uses multiple Microsoft APIs for deep compliance data. Each API requires specific permissions on your Azure app registration."
        last
      >
        {error && (
          <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12px] text-[#EF4444]">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {API_ROWS.map(row => {
            const status = perms?.[row.key] || 'unchecked'
            const detail = perms?.details?.[row.key]
            return (
              <div key={row.key} className="bg-[#fafafa] rounded-xl border border-[#e7e5e4] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-1">
                      <p className="text-[13px] font-semibold text-[#1c1d1f]">{row.label}</p>
                      {loading ? (
                        <span className="text-[11px] text-[#a8a29e]">Checking...</span>
                      ) : (
                        statusBadge(status)
                      )}
                    </div>
                    <p className="text-[12px] text-[#78716c] leading-relaxed">{row.description}</p>
                    {status !== 'ok' && status !== 'unchecked' && (
                      <div className="mt-2 p-2.5 bg-white rounded-lg border border-[#e7e5e4]">
                        <p className="text-[11px] font-medium text-[#44403c] mb-1">Required permissions:</p>
                        <p className="text-[11px] text-[#78716c] font-mono leading-relaxed">{row.permissions}</p>
                        {detail && (
                          <p className="text-[11px] text-[#D97706] mt-1.5">{detail}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={check}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1c1d1f] bg-white border border-[#e7e5e4] hover:bg-[#fafafa] px-3 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Re-check permissions'}
          </button>

          {perms?.checkedAt && (
            <span className="text-[11px] text-[#a8a29e]">
              Last checked: {new Date(perms.checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="mt-6 p-4 bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl">
          <p className="text-[12px] font-semibold text-[#1E40AF] mb-1.5">How to add permissions</p>
          <ol className="text-[12px] text-[#3B82F6] leading-relaxed space-y-1 list-decimal list-inside">
            <li>Go to <span className="font-medium">Azure Portal &gt; App registrations &gt; your app</span></li>
            <li>Click <span className="font-medium">API permissions &gt; Add a permission</span></li>
            <li>Select the API (Microsoft Graph, Defender, or Office 365 Management)</li>
            <li>Choose <span className="font-medium">Application permissions</span> and add the required ones</li>
            <li>Click <span className="font-medium">Grant admin consent</span></li>
          </ol>
          <a
            href="https://learn.microsoft.com/en-us/entra/identity-platform/permissions-consent-overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-[#1E40AF] hover:underline"
          >
            Microsoft docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </Section>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab,     setActiveTab]     = useState<Tab>('general')
  const [tenantName,    setTenantName]    = useState('')
  const [clientCount,   setClientCount]   = useState(0)
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    getConfigStatus()
      .then(s => {
        setTenantName((s as any).tenantName ?? '')
        setClientCount((s as any).clientCount ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false))
  }, [])

  return (
    <div className="flex h-full min-h-screen">

      {/* ── Left sub-nav ── */}
      <div className="w-[200px] shrink-0 border-r border-[#f5f5f4] bg-[#fafafa] px-3 py-6">
        <p className="px-3 mb-3 text-[10px] font-semibold text-[#a8a29e] uppercase tracking-[0.07em]">Settings</p>
        <nav className="space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-colors',
                activeTab === id
                  ? 'bg-white text-[#1c1d1f] shadow-sm border border-[#e7e5e4]'
                  : 'text-[#78716c] hover:text-[#1c1d1f] hover:bg-white/50',
              ].join(' ')}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${activeTab === id ? 'text-[#1c1917]' : ''}`} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl px-8 pb-16">

          {/* Page title */}
          <div className="pt-8 pb-2">
            <h1 className="text-[24px] font-bold text-[#1c1d1f]" style={{ letterSpacing: '-0.02em' }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-[14px] text-[#78716c] mt-1.5">
              {activeTab === 'general'       && 'Manage your tenant connection and client accounts.'}
              {activeTab === 'team'          && 'Invite colleagues to share access and collaborate on assessments.'}
              {activeTab === 'integrations'  && 'Connect Atlas to your existing security and productivity tools.'}
              {activeTab === 'api-access'    && 'Check and manage Microsoft API permissions for deeper compliance data.'}
              {activeTab === 'notifications' && 'Control how and when you receive compliance alerts.'}
            </p>
          </div>

          {/* Tab content */}
          {activeTab === 'general' && (
            <GeneralTab
              tenantName={tenantName}
              clientCount={clientCount}
              loading={loadingStatus}
            />
          )}
          {activeTab === 'team'          && <TeamTab />}
          {activeTab === 'integrations'  && <IntegrationsTab />}
          {activeTab === 'api-access'    && <ApiAccessTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  )
}
