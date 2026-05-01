'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  X,
  HelpCircle,
  ExternalLink,
  Link,
  Copy,
  Check,
  Mail,
  Clock,
  Search,
} from 'lucide-react'
import NextLink from 'next/link'
import {
  getClients,
  addClient,
  deleteClient,
  testClient,
  testConfig,
  createInvitation,
  getInvitations,
  revokeInvitation,
  getReports,
} from '@/lib/api'
import type { Client, Invitation, ReportMeta } from '@/lib/types'

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  const rh = h % 24
  if (d > 0) return `${d}d ${rh}h left`
  return `${h}h left`
}

// ─── Invite Modal ──────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [clientName, setClientName] = useState('')
  const [email, setEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [genError, setGenError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getInvitations()
      .then(setInvitations)
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  async function handleGenerate() {
    if (!clientName.trim()) return
    setGenerating(true)
    setGenError('')
    try {
      const result = await createInvitation({
        clientName: clientName.trim(),
        email: email.trim() || undefined,
      })
      setNewLink(result.link)
      setClientName('')
      setEmail('')
      getInvitations()
        .then(setInvitations)
        .catch(() => {})
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate link')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    try {
      await revokeInvitation(id)
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: 'revoked' as const } : inv))
      )
    } catch {
    } finally {
      setRevoking(null)
    }
  }

  async function handleCopy(link: string) {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function statusBadge(inv: Invitation) {
    if (inv.status === 'accepted') {
      return (
        <span className="text-[10px] font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
          ✓ Accepted
        </span>
      )
    }
    if (inv.status === 'revoked') {
      return (
        <span className="text-[10px] font-semibold text-[#505967] bg-[#fafafa] border border-[#e7e5e4] px-2 py-0.5 rounded-full">
          Revoked
        </span>
      )
    }
    return (
      <span className="text-[10px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-full">
        {formatExpiry(inv.expiresAt)}
      </span>
    )
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f5f4]">
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-[#1c1917]" />
            <span className="text-[14px] font-bold text-[#1c1d1f]">Invite a Client</span>
          </div>
          <button onClick={onClose} className="text-[#78716c] hover:text-[#505967] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g. Contoso Ltd"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e7e5e4] text-sm text-[#1c1d1f]
                           placeholder-[#a8a29e] bg-white focus:outline-none focus:ring-2
                           focus:ring-[#1c1917]/30 focus:border-[#1c1917] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">
                Email <span className="font-normal normal-case text-[#78716c]">(optional)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a8a29e]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e7e5e4] text-sm text-[#1c1d1f]
                             placeholder-[#a8a29e] bg-white focus:outline-none focus:ring-2
                             focus:ring-[#1c1917]/30 focus:border-[#1c1917] transition"
                />
              </div>
            </div>

            {genError && (
              <div className="flex items-center gap-2 text-xs bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {genError}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!clientName.trim() || generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         bg-[#1c1917] hover:bg-[#0c0a09] text-white text-sm font-semibold
                         disabled:bg-[#F3F4F6] disabled:text-[#78716c] disabled:cursor-not-allowed transition"
            >
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Link className="w-3.5 h-3.5" />
              )}
              Generate Link
            </button>
          </div>

          {newLink && (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
              <p className="text-xs font-semibold text-[#15803D] mb-2">
                Link generated — share with your client:
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={newLink}
                  className="flex-1 bg-white border border-[#e7e5e4] rounded-lg px-3 py-2 text-xs font-mono text-[#1c1d1f] focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(newLink)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#e7e5e4]
                             hover:bg-[#fafafa] text-xs font-medium text-[#1c1d1f] transition shrink-0"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-[#505967] mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires in 3 days
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#f5f5f4]" />
            <span className="text-[10px] font-semibold text-[#a8a29e] uppercase tracking-widest">
              Previous invites
            </span>
            <div className="flex-1 h-px bg-[#f5f5f4]" />
          </div>

          {loadingList ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#a8a29e]" />
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-xs text-[#78716c] text-center py-3">No invitations yet.</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    inv.status === 'revoked'
                      ? 'opacity-50 border-[#e7e5e4] bg-[#fafafa]'
                      : 'border-[#e7e5e4] bg-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1c1d1f] truncate">
                      {inv.clientName}
                    </p>
                    {inv.email && (
                      <p className="text-[10px] text-[#78716c] truncate">{inv.email}</p>
                    )}
                  </div>
                  {statusBadge(inv)}
                  {inv.status === 'pending' && (
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      disabled={revoking === inv.id}
                      className="text-[10px] font-medium text-[#78716c] hover:text-[#B91C1C] transition shrink-0"
                    >
                      {revoking === inv.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Revoke'
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Client Modal ──────────────────────────────────────────────────────

interface AddClientModalProps {
  onAdded: (client: Client) => void
  onClose: () => void
}

function AddClientModal({ onAdded, onClose }: AddClientModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    tenantName?: string
    error?: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)

  async function handleTest() {
    if (!tenantId || !clientId || !clientSecret) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testConfig({ tenantId, clientId, clientSecret })
      setTestResult(r)
      if (r.ok && r.tenantName && !name) setName(r.tenantName)
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleAdd() {
    if (!name || !tenantId || !clientId || !clientSecret) return
    setSaving(true)
    setError('')
    try {
      const client = await addClient({ name, tenantId, clientId, clientSecret })
      onAdded(client)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add client')
    } finally {
      setSaving(false)
    }
  }

  const canTest = tenantId.trim() && clientId.trim() && clientSecret.trim()
  const canAdd = canTest && name.trim()

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f5f4]">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#1c1917]" />
            <span className="text-[14px] font-bold text-[#1c1d1f]">Add New Client</span>
          </div>
          <button onClick={onClose} className="text-[#78716c] hover:text-[#505967] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Azure guide accordion */}
          <div className="rounded-lg border border-[#e7e5e4] overflow-hidden">
            <button
              type="button"
              onClick={() => setGuideOpen((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#fafafa] hover:bg-[#f5f5f4] text-sm font-medium text-[#1c1d1f] transition text-left"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-[#1c1917] shrink-0" />
                How to find your Azure credentials
              </span>
              {guideOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#78716c] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#78716c] shrink-0" />
              )}
            </button>

            {guideOpen && (
              <div className="px-4 pt-4 pb-3 border-t border-[#e7e5e4] space-y-3.5">
                {[
                  {
                    step: '1',
                    title: 'Open App Registrations',
                    desc: 'Go to portal.azure.com → Azure Active Directory → App registrations. Create a new registration or select an existing one.',
                  },
                  {
                    step: '2',
                    title: 'Copy Tenant ID & Client ID',
                    desc: 'On the app Overview page, copy the Directory (Tenant) ID and the Application (Client) ID.',
                  },
                  {
                    step: '3',
                    title: 'Create a client secret',
                    desc: 'Go to Certificates & secrets → New client secret. Copy the secret Value — not the ID. It only shows once.',
                  },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#1c1d1f] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {s.step}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-[#1c1d1f]">{s.title}</div>
                      <div className="text-xs text-[#505967] mt-0.5 leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
                <a
                  href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#505967] hover:text-[#1c1d1f] transition pt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Azure Portal →
                </a>
              </div>
            )}
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-xs font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">
              Client Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2.5 rounded-lg border border-[#e7e5e4] text-sm text-[#1c1d1f]
                         placeholder-[#a8a29e] bg-white focus:outline-none focus:ring-2
                         focus:ring-[#1c1917]/30 focus:border-[#1c1917] transition"
            />
          </div>

          {/* Tenant ID + Client ID row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1c1d1f] mb-0.5 uppercase tracking-wide">
                Tenant ID
              </label>
              <p className="text-[10px] text-[#78716c] mb-1.5">Azure AD → Properties</p>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e7e5e4] text-sm font-mono text-[#1c1d1f]
                           placeholder-[#a8a29e] bg-white focus:outline-none focus:ring-2
                           focus:ring-[#1c1917]/30 focus:border-[#1c1917] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1c1d1f] mb-0.5 uppercase tracking-wide">
                Client ID
              </label>
              <p className="text-[10px] text-[#78716c] mb-1.5">App Registration → Overview</p>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e7e5e4] text-sm font-mono text-[#1c1d1f]
                           placeholder-[#a8a29e] bg-white focus:outline-none focus:ring-2
                           focus:ring-[#1c1917]/30 focus:border-[#1c1917] transition"
              />
            </div>
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-xs font-semibold text-[#1c1d1f] mb-0.5 uppercase tracking-wide">
              Client Secret
            </label>
            <p className="text-[10px] text-[#78716c] mb-1.5">
              Certificates &amp; secrets → secret Value (not ID)
            </p>
            <div className="relative" suppressHydrationWarning>
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="App registration secret value"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#e7e5e4] text-sm font-mono text-[#1c1d1f]
                           placeholder-[#a8a29e] bg-white focus:outline-none focus:ring-2
                           focus:ring-[#1c1917]/30 focus:border-[#1c1917] transition"
                suppressHydrationWarning
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a8a29e] hover:text-[#505967] transition"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 ${
                testResult.ok
                  ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]'
                  : 'bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              )}
              <span>
                {testResult.ok
                  ? `Connected — ${testResult.tenantName ?? 'Tenant verified'}`
                  : (testResult.error ?? 'Connection failed')}
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-lg px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={!canTest || testing}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#e7e5e4] bg-white
                         hover:bg-[#fafafa] text-sm font-medium text-[#1c1d1f]
                         disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Test Connection
            </button>
            <button
              onClick={handleAdd}
              disabled={!canAdd || saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg
                         bg-[#1c1917] hover:bg-[#0c0a09] text-white text-sm font-semibold
                         disabled:bg-[#F3F4F6] disabled:text-[#78716c] disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add Client
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Client Card ──────────────────────────────────────────────────────────

function ClientCard({
  client,
  onDelete,
  lastReport,
}: {
  client: Client
  onDelete: (id: string) => void
  lastReport?: ReportMeta
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const scoreColor = (pct: number) => (pct >= 80 ? '#0eb472' : pct >= 50 ? '#f59e0b' : '#f25757')

  async function handleTest(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await testClient(client.id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed'
      setTestResult({ ok: false, error: msg })
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    try {
      await deleteClient(client.id)
      onDelete(client.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <NextLink
      href={`/clients/${client.id}`}
      className="block bg-white rounded-xl border border-[#e7e5e4] shadow-card hover:shadow-md hover:border-[#d6d3d1] transition-all overflow-hidden"
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-10 h-10 rounded-xl bg-[#fafafa] border border-[#e7e5e4] flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-[#505967]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[#1c1d1f] truncate">{client.name}</h3>
          <p className="text-[11px] text-[#a8a29e] font-mono truncate mt-0.5">{client.tenantId}</p>
        </div>

        {/* Last score */}
        {lastReport && (
          <div className="text-right shrink-0">
            <p
              className="text-[16px] font-bold tabular-nums"
              style={{
                color: scoreColor(lastReport.summary.compliancePercentage),
                letterSpacing: '-0.02em',
              }}
            >
              {lastReport.summary.compliancePercentage}%
            </p>
            <p className="text-[10px] text-[#a8a29e]">{lastReport.frameworkId}</p>
          </div>
        )}

        {/* Connection status */}
        {testResult && (
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${testResult.ok ? 'text-[#0eb472] bg-[rgba(14,180,114,0.08)]' : 'text-[#f25757] bg-[rgba(242,87,87,0.08)]'}`}
          >
            {testResult.ok ? '● OK' : '● Err'}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e7e5e4] text-[11px] font-medium text-[#505967] hover:bg-[#fafafa] transition-colors"
          >
            {testing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Test
          </button>
          {!confirming ? (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConfirming(true)
              }}
              className="p-1.5 rounded-lg text-[#a8a29e] hover:text-[#f25757] hover:bg-[#FEF2F2] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2.5 py-1 rounded-lg bg-[#f25757] text-white text-[11px] font-semibold transition-colors"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setConfirming(false)
                }}
                className="px-2.5 py-1 rounded-lg border border-[#e7e5e4] text-[11px] text-[#505967] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </NextLink>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([getClients(), getReports()])
      .then(([c, r]) => {
        setClients(c)
        setReports(r)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load clients'))
      .finally(() => setLoading(false))
  }, [])

  // Build latest report per client
  const latestReportByClient: Record<string, ReportMeta> = {}
  for (const r of reports) {
    if (!r.clientId) continue
    const existing = latestReportByClient[r.clientId]
    if (!existing || new Date(r.generatedAt) > new Date(existing.generatedAt)) {
      latestReportByClient[r.clientId] = r
    }
  }

  function handleAdded(client: Client) {
    setClients((prev) => [...prev, client])
    setShowAddForm(false)
  }

  function handleDeleted(id: string) {
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tenantId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-5xl">
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {showAddForm && (
        <AddClientModal onAdded={handleAdded} onClose={() => setShowAddForm(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-[#e7e5e4] flex items-center justify-center shadow-card">
            <Building2 className="w-4 h-4 text-[#505967]" />
          </div>
          <div>
            <h1
              className="text-[24px] font-bold text-[#1c1d1f]"
              style={{ letterSpacing: '-0.02em' }}
            >
              Clients
            </h1>
            <p className="text-[14px] text-[#78716c] mt-1.5">
              Manage Microsoft 365 tenants for multi-client assessments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-white hover:bg-[#fafafa] text-[#1c1d1f] border border-[#e7e5e4]
                       text-sm font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <Link className="w-4 h-4 text-[#1c1917]" />
            Invite Client
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-[#1c1917] hover:bg-[#0c0a09] text-white
                       text-sm font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      {clients.length > 0 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a8a29e]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#e7e5e4] bg-white text-[13px] text-[#1c1d1f] placeholder-[#a8a29e] focus:outline-none focus:border-[#1c1d1f] transition-colors"
          />
        </div>
      )}

      {/* Load error banner */}
      {loadError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Failed to load clients: {loadError}</span>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#78716c]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading clients…</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[#fafafa] border border-[#e7e5e4] flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-[#a8a29e]" />
          </div>
          <h3 className="text-[14px] font-semibold text-[#1c1d1f] mb-1">No clients yet</h3>
          <p className="text-sm text-[#78716c] mb-6 max-w-xs mx-auto">
            Connect a Microsoft 365 tenant to start running compliance assessments.
          </p>

          <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl px-5 py-4 mb-6 max-w-sm mx-auto text-left">
            <p className="text-[11px] font-semibold text-[#78716c] uppercase tracking-widest mb-3">
              Before you start, you&apos;ll need:
            </p>
            <ul className="space-y-2.5">
              {[
                { label: 'Directory (Tenant) ID', hint: 'Azure AD → Properties' },
                { label: 'Application (Client) ID', hint: 'App Registration → Overview' },
                { label: 'Client Secret value', hint: 'Certificates & Secrets tab' },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded border-2 border-[#d6d3d1] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm text-[#1c1d1f] font-medium">{item.label}</span>
                    <span className="text-xs text-[#78716c] ml-1.5">{item.hint}</span>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 flex items-center gap-1.5 text-xs text-[#505967] hover:text-[#1c1d1f] transition"
            >
              <ExternalLink className="w-3 h-3" />
              Open Azure Portal
            </a>
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 bg-[#1c1917] hover:bg-[#0c0a09] text-white
                       text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add First Client
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-[#78716c] uppercase tracking-widest mb-4">
            {filtered.length} {filtered.length === 1 ? 'Client' : 'Clients'}
            {search && ` matching "${search}"`}
          </p>
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onDelete={handleDeleted}
              lastReport={latestReportByClient[client.id]}
            />
          ))}
          {filtered.length === 0 && search && (
            <div className="text-center py-10 text-[#78716c] text-[13px]">
              No clients match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
