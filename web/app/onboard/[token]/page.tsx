'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, Eye, EyeOff, Loader2,
  ArrowRight, ArrowLeft, Copy, Check, ExternalLink,
} from 'lucide-react'
import {
  getOnboardInfo, completeOnboard,
  testOnboardIntegration, saveOnboardIntegration,
} from '@/lib/api'

// ─── Platform definitions ────────────────────────────────────────────────────

interface PlatformField {
  key: string
  label: string
  placeholder?: string
  type?: 'password' | 'text'
}

interface PlatformDef {
  id: string
  name: string
  color: string
  fields: PlatformField[]
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'servicenow', name: 'ServiceNow', color: '#81B5A1',
    fields: [
      { key: 'instanceUrl', label: 'Instance URL',  placeholder: 'https://company.service-now.com' },
      { key: 'username',    label: 'Username',       placeholder: 'admin' },
      { key: 'password',    label: 'Password',       type: 'password' },
    ],
  },
  {
    id: 'splunk', name: 'Splunk', color: '#FF6A00',
    fields: [
      { key: 'baseUrl',  label: 'Splunk URL', placeholder: 'https://splunk.company.com:8089' },
      { key: 'apiToken', label: 'API Token',  type: 'password' },
    ],
  },
  {
    id: 'jira', name: 'Jira', color: '#0052CC',
    fields: [
      { key: 'domain',   label: 'Jira Domain', placeholder: 'company.atlassian.net' },
      { key: 'email',    label: 'Email',        placeholder: 'admin@company.com' },
      { key: 'apiToken', label: 'API Token',    type: 'password' },
    ],
  },
  {
    id: 'slack', name: 'Slack', color: '#4A154B',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/...' },
    ],
  },
  {
    id: 'teams', name: 'Microsoft Teams', color: '#464EB8',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://outlook.office.com/webhook/...' },
    ],
  },
  {
    id: 'workday', name: 'Workday', color: '#F5820E',
    fields: [
      { key: 'baseUrl',    label: 'Base URL',    placeholder: 'https://wd2.myworkday.com/...' },
      { key: 'tenantName', label: 'Tenant Name', placeholder: 'company' },
      { key: 'username',   label: 'Username' },
      { key: 'password',   label: 'Password',    type: 'password' },
    ],
  },
  {
    id: 'monday', name: 'Monday.com', color: '#F2484B',
    fields: [
      { key: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    id: 'box', name: 'Box', color: '#0061D5',
    fields: [
      { key: 'clientId',     label: 'Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'enterpriseId', label: 'Enterprise ID' },
    ],
  },
  {
    id: 'dropbox', name: 'Dropbox', color: '#0061FE',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
]

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEP_LABELS = ['Company', 'Microsoft 365', 'Integrations', 'Done']

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const num       = i + 1
        const active    = num === step
        const completed = num < step
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                completed ? 'bg-[#18181B] text-white'
                  : active ? 'bg-[#C4A96D] text-white'
                  : 'bg-[#E9E5DD] text-[#9CA3AF]'
              }`}>
                {completed ? <Check className="w-3.5 h-3.5" /> : num}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${
                active ? 'text-[#18181B]' : completed ? 'text-[#374151]' : 'text-[#9CA3AF]'
              }`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${completed ? 'bg-[#18181B]' : 'bg-[#E9E5DD]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Platform card (Step 3) ──────────────────────────────────────────────────

interface PlatformCardProps {
  platform:    PlatformDef
  token:       string
  savedConfig: Record<string, string> | null
  onSaved:     (platformId: string) => void
}

function PlatformCard({ platform, token, savedConfig, onSaved }: PlatformCardProps) {
  const [open,       setOpen]      = useState(false)
  const [fields,     setFields]    = useState<Record<string, string>>(savedConfig ?? {})
  const [showFields, setShowFields] = useState<Record<string, boolean>>({})
  const [testing,    setTesting]   = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null)
  const [saving,     setSaving]    = useState(false)
  const [saved,      setSaved]     = useState(!!savedConfig)

  const allFilled = platform.fields.every(f => fields[f.key]?.trim())

  async function handleTest() {
    if (!allFilled) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testOnboardIntegration(token, platform.id, fields)
      setTestResult({ ok: r.ok, message: r.message ?? (r.ok ? 'Connected successfully' : 'Test failed') })
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!allFilled) return
    setSaving(true)
    try {
      await saveOnboardIntegration(token, platform.id, fields)
      setSaved(true)
      setOpen(false)
      onSaved(platform.id)
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`rounded-xl border transition-all ${
      saved
        ? 'border-[#BBF7D0] bg-[#F0FDF4]'
        : open
        ? 'border-[#C4A96D] bg-white shadow-md'
        : 'border-[#E9E5DD] bg-white hover:border-[#D4CFC5]'
    }`}>
      {/* Card header */}
      <button
        type="button"
        onClick={() => !saved && setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Color swatch */}
        <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
          style={{ backgroundColor: platform.color + '22' }}>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#18181B]">{platform.name}</p>
          <p className="text-xs text-[#9CA3AF]">
            {saved ? 'Connected' : open ? 'Enter credentials below' : 'Not connected'}
          </p>
        </div>
        {saved ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
            open
              ? 'bg-[#C4A96D] text-white border-[#C4A96D]'
              : 'bg-white text-[#6B7280] border-[#E9E5DD] hover:bg-[#F7F5F1]'
          }`}>
            {open ? 'Cancel' : 'Connect'}
          </span>
        )}
      </button>

      {/* Expanded form */}
      {open && !saved && (
        <div className="border-t border-[#F0EDE6] px-4 pb-4 pt-3 space-y-3">
          {platform.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-[#374151] mb-1 uppercase tracking-wide">
                {field.label}
              </label>
              <div className="relative">
                <input
                  type={field.type === 'password' && !showFields[field.key] ? 'password' : 'text'}
                  value={fields[field.key] ?? ''}
                  onChange={e => setFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ?? ''}
                  className="w-full px-3 py-2 rounded-lg border border-[#E9E5DD] text-sm text-[#18181B]
                             placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                             focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition pr-8"
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#6B7280]"
                  >
                    {showFields[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {testResult && (
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
              testResult.ok
                ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]'
                : 'bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]'
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                : <AlertCircle  className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              }
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={!allFilled || testing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E9E5DD]
                         bg-white hover:bg-[#F7F5F1] text-xs font-medium text-[#374151]
                         disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Test
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!allFilled || saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                         bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold
                         disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OnboardPage() {
  const params = useParams()
  const token  = params.token as string

  // ── Token validation state ─────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true)
  const [tokenError,  setTokenError]  = useState<string | null>(null)
  const [inviteInfo,  setInviteInfo]  = useState<{ clientName: string; email?: string } | null>(null)

  // ── Wizard state ───────────────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // Step 1 – Company details
  const [companyName,   setCompanyName]   = useState('')
  const [contactName,   setContactName]   = useState('')
  const [contactEmail,  setContactEmail]  = useState('')

  // Step 2 – Microsoft 365
  const [tenantId,     setTenantId]     = useState('')
  const [clientId,     setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret,   setShowSecret]   = useState(false)
  const [m365Testing,  setM365Testing]  = useState(false)
  const [m365Result,   setM365Result]   = useState<{ ok: boolean; tenantName?: string; message?: string } | null>(null)
  const [m365Saving,   setM365Saving]   = useState(false)
  const [completedClientId, setCompletedClientId] = useState<string | null>(null)

  // Step 3 – Integrations
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set())

  // ── Load invite info on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    getOnboardInfo(token)
      .then(info => {
        if (info.status === 'accepted') {
          setTokenError('This invitation has already been completed.')
          return
        }
        setInviteInfo({ clientName: info.clientName, email: info.email })
        setCompanyName(info.clientName)
        setContactEmail(info.email ?? '')
      })
      .catch(e => {
        const msg = e instanceof Error ? e.message : 'Invalid link'
        if (msg.includes('expired') || msg.includes('410')) {
          setTokenError('This invitation link has expired.')
        } else if (msg.includes('revoked') || msg.includes('404')) {
          setTokenError('This invitation link is no longer valid.')
        } else {
          setTokenError(msg)
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  // ── Step 2: Test Microsoft 365 ─────────────────────────────────────────
  async function handleM365Test() {
    if (!tenantId || !clientId || !clientSecret) return
    setM365Testing(true)
    setM365Result(null)
    try {
      const r = await testOnboardIntegration(token, 'entra_id', { tenantId, clientId, clientSecret })
      setM365Result({ ok: r.ok, tenantName: r.tenantName, message: r.message })
    } catch (e) {
      setM365Result({ ok: false, message: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setM365Testing(false)
    }
  }

  // ── Step 2: Save and advance ───────────────────────────────────────────
  async function handleM365Save() {
    setM365Saving(true)
    try {
      const result = await completeOnboard(token, {
        companyName, contactName, contactEmail,
        tenantId, clientId, clientSecret,
      })
      setCompletedClientId(result.clientId)
      setStep(3)
    } catch (e) {
      setM365Result({ ok: false, message: e instanceof Error ? e.message : 'Failed to save' })
    } finally {
      setM365Saving(false)
    }
  }

  const handlePlatformSaved = useCallback((platformId: string) => {
    setConnectedPlatforms(prev => new Set(prev).add(platformId))
  }, [])

  // ── Render: loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C4A96D]" />
      </div>
    )
  }

  // ── Render: token error ────────────────────────────────────────────────
  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#E9E5DD] shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-[#B91C1C]" />
          </div>
          <h1 className="text-xl font-bold text-[#18181B] mb-2">Link Unavailable</h1>
          <p className="text-sm text-[#6B7280] mb-6">{tokenError}</p>
          <p className="text-xs text-[#9CA3AF]">
            Contact your compliance advisor to request a new invitation link.
          </p>
        </div>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (dark, decorative) ── */}
      <div className="hidden lg:flex w-[420px] shrink-0 bg-[#141412] flex-col p-10">
        {/* Logo */}
        <div className="mb-auto">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-lg bg-[#C4A96D] flex items-center justify-center">
              <span className="text-[#141412] font-black text-sm tracking-tight">IX</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">INDEX</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 leading-snug">
            {inviteInfo?.clientName} is setting up their compliance assessment
          </h2>
          <p className="text-[#6B7280] text-sm mt-4 leading-relaxed">
            Connect your platforms so INDEX can automatically gather evidence for your assessment.
          </p>

          {/* Platform list */}
          <div className="mt-10 space-y-2.5">
            {[
              { name: 'Microsoft Entra ID', color: '#0078D4', required: true },
              { name: 'Microsoft Graph API', color: '#00BCF2', required: true },
              ...PLATFORMS.map(p => ({ name: p.name, color: p.color, required: false })),
            ].map(p => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-[13px] text-[#9CA3AF]">{p.name}</span>
                {p.required && (
                  <span className="text-[10px] font-semibold text-[#C4A96D] uppercase tracking-wide ml-auto">Required</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-[#4B4A46] mt-10">Powered by Microsoft Graph API</p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 bg-[#F7F5F1] overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-12">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#141412] flex items-center justify-center">
              <span className="text-[#C4A96D] font-black text-xs">IX</span>
            </div>
            <span className="text-[#18181B] font-bold">INDEX</span>
          </div>

          <StepBar step={step} />

          {/* ── Step 1: Company Details ── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-[#E9E5DD] shadow-card p-8">
              <h1 className="text-xl font-bold text-[#18181B] mb-1">Confirm your company information</h1>
              <p className="text-sm text-[#6B7280] mb-6">
                Your compliance advisor has pre-filled your company name. Please confirm the details below.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm text-[#18181B]
                               placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                               focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm text-[#18181B]
                               placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                               focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm text-[#18181B]
                               placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                               focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setStep(2)}
                  disabled={!companyName.trim() || !contactName.trim() || !contactEmail.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#18181B] hover:bg-[#27272A]
                             text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Microsoft 365 ── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-[#E9E5DD] shadow-card p-8">
              <h1 className="text-xl font-bold text-[#18181B] mb-1">Connect Microsoft 365</h1>
              <p className="text-sm text-[#6B7280] mb-2">
                This is required for compliance assessment. We need read-only access to your Azure tenant.
              </p>
              <a
                href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#C4A96D] hover:text-[#A8873A] transition mb-6"
              >
                <ExternalLink className="w-3 h-3" />
                Open Azure Portal →
              </a>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-0.5 uppercase tracking-wide">
                      Tenant ID
                    </label>
                    <p className="text-[10px] text-[#9CA3AF] mb-1.5">Azure AD → Properties</p>
                    <input
                      type="text"
                      value={tenantId}
                      onChange={e => setTenantId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm font-mono text-[#18181B]
                                 placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                                 focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-0.5 uppercase tracking-wide">
                      Client ID
                    </label>
                    <p className="text-[10px] text-[#9CA3AF] mb-1.5">App Registration → Overview</p>
                    <input
                      type="text"
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm font-mono text-[#18181B]
                                 placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                                 focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-0.5 uppercase tracking-wide">
                    Client Secret
                  </label>
                  <p className="text-[10px] text-[#9CA3AF] mb-1.5">Certificates & secrets → secret Value (not ID)</p>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      placeholder="App registration secret value"
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#E9E5DD] text-sm font-mono text-[#18181B]
                                 placeholder-[#C4BFB5] bg-white focus:outline-none focus:ring-2
                                 focus:ring-[#C4A96D]/30 focus:border-[#C4A96D] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#6B7280]"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {m365Result && (
                  <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 ${
                    m365Result.ok
                      ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]'
                      : 'bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]'
                  }`}>
                    {m365Result.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      : <AlertCircle  className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    }
                    <span>
                      {m365Result.ok
                        ? `Connected — ${m365Result.tenantName ?? 'Tenant verified'}`
                        : m365Result.message ?? 'Connection failed'
                      }
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E9E5DD]
                             bg-white hover:bg-[#F7F5F1] text-sm font-medium text-[#6B7280] transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleM365Test}
                    disabled={!tenantId || !clientId || !clientSecret || m365Testing}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#E9E5DD]
                               bg-white hover:bg-[#F7F5F1] text-sm font-medium text-[#374151]
                               disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {m365Testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Test Connection
                  </button>
                  <button
                    onClick={handleM365Save}
                    disabled={!m365Result?.ok || m365Saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#18181B] hover:bg-[#27272A]
                               text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {m365Saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save & Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Additional Platforms ── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-[#E9E5DD] shadow-card p-8">
              <h1 className="text-xl font-bold text-[#18181B] mb-1">Connect your other platforms</h1>
              <p className="text-sm text-[#6B7280] mb-6">
                These help INDEX gather evidence from more systems for a fuller assessment. All integrations are optional.
              </p>

              {connectedPlatforms.size > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2 mb-4">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {connectedPlatforms.size} platform{connectedPlatforms.size !== 1 ? 's' : ''} connected
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {PLATFORMS.map(platform => (
                  <PlatformCard
                    key={platform.id}
                    platform={platform}
                    token={token}
                    savedConfig={null}
                    onSaved={handlePlatformSaved}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#F0EDE6]">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E9E5DD]
                             bg-white hover:bg-[#F7F5F1] text-sm font-medium text-[#6B7280] transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#18181B] hover:bg-[#27272A]
                             text-white text-sm font-semibold transition"
                >
                  Finish Setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && (
            <div className="bg-white rounded-2xl border border-[#E9E5DD] shadow-card p-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-[#15803D]" />
              </div>
              <h1 className="text-2xl font-bold text-[#18181B] mb-3">Setup complete!</h1>
              <p className="text-sm text-[#6B7280] leading-relaxed mb-2 max-w-sm mx-auto">
                Your Microsoft 365 tenant is connected and your assessment will begin shortly.
              </p>
              {connectedPlatforms.size > 0 && (
                <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto">
                  {connectedPlatforms.size} additional platform{connectedPlatforms.size !== 1 ? 's' : ''} connected:{' '}
                  {Array.from(connectedPlatforms).map(id => PLATFORMS.find(p => p.id === id)?.name).filter(Boolean).join(', ')}.
                </p>
              )}
              <p className="text-sm text-[#9CA3AF] mb-8 max-w-sm mx-auto">
                Your compliance advisor will be in touch.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-[#E9E5DD]
                           bg-white hover:bg-[#F7F5F1] text-sm font-medium text-[#374151] transition"
              >
                Return to homepage
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
