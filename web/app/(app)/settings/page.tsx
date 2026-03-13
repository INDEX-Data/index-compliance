'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, CheckCircle2, Building2, Users, UserPlus, Mail, Clock, Check, X, Trash2, Copy, ChevronDown } from 'lucide-react'
import { getConfigStatus, getTeamInvites, createTeamInvite, revokeTeamInvite, getTeamMembers, removeTeamMember } from '@/lib/api'
import type { TeamInvite, TeamMember } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Team Section Component ────────────────────────────────────────────────────

function TeamSection() {
  const [invites,     setInvites]     = useState<TeamInvite[]>([])
  const [members,     setMembers]     = useState<TeamMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [email,       setEmail]       = useState('')
  const [creating,    setCreating]    = useState(false)
  const [newLink,     setNewLink]     = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [expanded,    setExpanded]    = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [inv, mem] = await Promise.all([getTeamInvites(), getTeamMembers()])
      setInvites(inv)
      setMembers(mem)
    } catch { /* silently ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleCreate() {
    if (!email.trim()) return
    setCreating(true)
    setError(null)
    setNewLink(null)
    try {
      const result = await createTeamInvite({ email: email.trim() })
      setNewLink(result.link)
      setEmail('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invite')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    await revokeTeamInvite(id)
    await refresh()
  }

  async function handleRemoveMember(id: string) {
    await removeTeamMember(id)
    await refresh()
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pendingInvites  = invites.filter(i => i.status === 'pending')
  const acceptedInvites = invites.filter(i => i.status === 'accepted')

  return (
    <div className="bg-white rounded-xl border border-[#E9E5DD] p-5 shadow-card">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 text-left"
      >
        <UserPlus className="w-4 h-4 text-[#9CA3AF]" />
        <h2 className="text-[14px] font-semibold text-[#18181B]">Team Access</h2>
        {!loading && (members.length > 0 || pendingInvites.length > 0) && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#374151] bg-[#F7F5F1] border border-[#E9E5DD] px-2.5 py-1 rounded-full">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#9CA3AF] ml-auto transition-transform ${expanded ? 'rotate-180' : ''} ${members.length > 0 || pendingInvites.length > 0 ? '' : 'ml-auto'}`} />
      </button>

      <p className="text-sm text-[#6B7280] mt-1 ml-7">
        Invite colleagues to access your clients and run assessments together.
      </p>

      {expanded && (
        <div className="mt-4 space-y-4">

          {/* Invite form */}
          <div className="border border-[#E9E5DD] rounded-lg p-4 bg-[#FAFAF8]">
            <p className="text-[12px] font-semibold text-[#374151] mb-2">Send an invite</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="flex-1 text-sm border border-[#E9E5DD] rounded-lg px-3 py-2 outline-none focus:border-[#D4A843] bg-white placeholder-[#C4BFB5]"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !email.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#18181B] rounded-lg hover:bg-[#27272A] active:bg-[#3F3F46] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? 'Creating…' : 'Generate Link'}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>

          {/* New link result */}
          {newLink && (
            <div className="border border-[#BBF7D0] bg-[#F0FDF4] rounded-lg p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-[#15803D] shrink-0" />
              <span className="flex-1 text-xs font-mono text-[#15803D] truncate">{newLink}</span>
              <button
                type="button"
                onClick={() => copyLink(newLink)}
                className="shrink-0 text-[11px] font-semibold text-[#15803D] hover:text-[#166534] flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Pending Invites</p>
              <div className="space-y-1.5">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-2 px-3 py-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
                    <Mail className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                    <span className="flex-1 text-sm text-[#18181B] truncate">{inv.email}</span>
                    <span className="text-[10px] text-[#D97706] flex items-center gap-0.5 shrink-0">
                      <Clock className="w-2.5 h-2.5" /> {timeLeft(inv.expiresAt)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const host = window.location.origin
                        await copyLink(`${host}/join/${inv.token}`)
                      }}
                      className="shrink-0 p-1 text-[#9CA3AF] hover:text-[#374151] rounded transition-colors"
                      title="Copy link"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.id)}
                      className="shrink-0 p-1 text-[#9CA3AF] hover:text-red-500 rounded transition-colors"
                      title="Revoke"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active members */}
          {members.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Team Members</p>
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                    <span className="flex-1 text-[11px] font-mono text-[#374151] truncate">{m.memberId}</span>
                    <span className="text-[10px] text-[#6B7280] shrink-0">Joined {fmtDate(m.joinedAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="shrink-0 p-1 text-[#9CA3AF] hover:text-red-500 rounded transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted (no longer active) history */}
          {acceptedInvites.length > 0 && members.length === 0 && (
            <p className="text-xs text-[#9CA3AF]">
              {acceptedInvites.length} invite{acceptedInvites.length > 1 ? 's' : ''} previously accepted.
            </p>
          )}

          {/* Empty state */}
          {!loading && invites.length === 0 && members.length === 0 && (
            <p className="text-xs text-[#9CA3AF] text-center py-2">
              No team members yet. Generate a link to invite a colleague.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()

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
    <div className="p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-lg bg-white border border-[#E9E5DD] flex items-center justify-center shadow-card">
          <Settings className="w-4 h-4 text-[#6B7280]" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#18181B] tracking-tight">Settings</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Platform configuration and tenant management</p>
        </div>
      </div>

      {/* Azure Tenant */}
      <div className="bg-white rounded-xl border border-[#E9E5DD] p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-1">
          <Building2 className="w-4 h-4 text-[#9CA3AF]" />
          <h2 className="text-[14px] font-semibold text-[#18181B]">Primary Azure Tenant</h2>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        </div>
        {loadingStatus ? (
          <p className="text-sm text-[#C4BFB5] mt-1">Loading…</p>
        ) : (
          <p className="text-sm text-[#6B7280] mt-1">
            Tenant: <strong className="text-[#18181B]">{tenantName || 'Unknown'}</strong>
          </p>
        )}
        <button
          onClick={() => router.push('/setup')}
          className="mt-3 text-xs text-[#6B7280] hover:text-[#18181B] font-medium transition underline decoration-[#D4CFC5] underline-offset-2"
        >
          Reconfigure Azure credentials →
        </button>
      </div>

      {/* Multi-tenant clients */}
      <div className="bg-white rounded-xl border border-[#E9E5DD] p-5 mb-4 shadow-card">
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-4 h-4 text-[#9CA3AF]" />
          <h2 className="text-[14px] font-semibold text-[#18181B]">Multi-Client (MSP Mode)</h2>
          {!loadingStatus && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#374151] bg-[#F7F5F1] border border-[#E9E5DD] px-2.5 py-1 rounded-full">
              {clientCount} {clientCount === 1 ? 'client' : 'clients'}
            </span>
          )}
        </div>
        <p className="text-sm text-[#6B7280] mt-1">
          Manage multiple Microsoft 365 tenants for running assessments across client environments.
        </p>
        <button
          onClick={() => router.push('/clients')}
          className="mt-3 text-xs text-[#6B7280] hover:text-[#18181B] font-medium transition underline decoration-[#D4CFC5] underline-offset-2"
        >
          Manage clients →
        </button>
      </div>

      {/* Team Access */}
      <div className="mb-4">
        <TeamSection />
      </div>

      {/* Integrations */}
      <div className="bg-white rounded-xl border border-[#E9E5DD] p-5 shadow-card">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-4 h-4 text-[#9CA3AF]" />
          <h2 className="text-[14px] font-semibold text-[#18181B]">Integrations</h2>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">
          Connect INDEX to external tools — ServiceNow, Splunk, Jira, Slack, and more.
        </p>
        <button
          onClick={() => router.push('/integrations')}
          className="mt-3 text-xs text-[#6B7280] hover:text-[#18181B] font-medium transition underline decoration-[#D4CFC5] underline-offset-2"
        >
          View integrations →
        </button>
      </div>

    </div>
  )
}
