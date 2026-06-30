'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import Image from 'next/image'
import { getClients, getFrameworks, testConfig, addClient } from '@/lib/api'
import type { FrameworkMeta } from '@/lib/types'

const STEPS = ['Welcome', 'Connect Tenant', 'Choose Framework'] as const

export default function OnboardingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState(0)

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    tenantName?: string
    domain?: string
    error?: string
  } | null>(null)
  const [savedClientId, setSavedClientId] = useState<string | null>(null)

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [frameworks, setFrameworks] = useState<FrameworkMeta[]>([])
  const [selectedFramework, setSelectedFramework] = useState('')

  // Guard: if user already has a client, send them to dashboard
  useEffect(() => {
    getClients()
      .then((clients) => {
        if (clients.length > 0) router.replace('/dashboard')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  // Load frameworks when reaching step 3
  useEffect(() => {
    if (step !== 2) return
    getFrameworks()
      .then((fw) => {
        const implemented = fw.filter((f) => f.implemented)
        setFrameworks(implemented)
        if (implemented.length > 0) setSelectedFramework(implemented[0].id)
      })
      .catch(() => {})
  }, [step])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConfig({ tenantId, clientId, clientSecret })
      setTestResult(result)
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveAndContinue = async () => {
    setSaving(true)
    try {
      const client = await addClient({ name: name.trim(), tenantId, clientId, clientSecret })
      setSavedClientId(client.id)
      setStep(2)
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Failed to save client' })
    } finally {
      setSaving(false)
    }
  }

  const handleStartAssessment = () => {
    const params = new URLSearchParams()
    if (savedClientId) params.set('clientId', savedClientId)
    if (selectedFramework) params.set('framework', selectedFramework)
    router.push(`/assess?${params.toString()}`)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const fieldsComplete =
    name.trim() !== '' && tenantId !== '' && clientId !== '' && clientSecret !== ''
  const step2Ready = testResult?.ok === true && fieldsComplete

  // ── Loading guard ─────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-7 h-7 text-[#d6d3d1] animate-spin" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      {/* ── Progress indicator ── */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors
                    ${
                      i < step
                        ? 'bg-ink border-[#1c1917] text-white'
                        : i === step
                          ? 'border-[#1c1917] text-ink bg-surface'
                          : 'border-border-strong text-[#d6d3d1] bg-surface'
                    }`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span
                  className={`text-[12px] font-medium hidden sm:block transition-colors
                  ${i <= step ? 'text-ink' : 'text-faint'}`}
                >
                  {label}
                </span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-3 transition-colors ${i < step ? 'bg-ink' : 'bg-[#e7e5e4]'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Card ── */}
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-sm">
        {/* ══ Step 1: Welcome ══════════════════════════════════════════════ */}
        {step === 0 && (
          <div className="p-8">
            <div className="mb-6">
              <Image
                src="/atlas-logo.svg"
                alt="Atlas"
                width={140}
                height={56}
                className="h-10 w-auto"
              />
            </div>

            <h1
              className="text-[24px] font-bold text-ink mb-2"
              style={{ letterSpacing: '-0.02em' }}
            >
              Welcome to Atlas
            </h1>
            <p className="text-sm text-muted leading-relaxed mb-8">
              You&apos;re 2 steps away from your first compliance assessment. Before you connect,
              grab these from Azure Portal:
            </p>

            {/* Checklist */}
            <div className="space-y-2.5 mb-8">
              {[
                { label: 'Directory (Tenant) ID', hint: 'Azure AD → Properties' },
                { label: 'Application (Client) ID', hint: 'App Registration → Overview' },
                { label: 'Client Secret value', hint: 'Certificates & Secrets tab' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 bg-canvas rounded-xl px-4 py-3"
                >
                  <div className="w-4 h-4 mt-0.5 rounded border-2 border-[#1c1917] shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-ink">{item.label}</p>
                    <p className="text-[11px] text-faint mt-0.5">{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://portal.azure.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition mb-8"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Azure Portal
            </a>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-full bg-ink hover:bg-ink text-on-accent font-semibold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                Get Started <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-faint hover:text-muted transition text-center py-1"
              >
                Skip setup — I&apos;ll do this later
              </button>
            </div>
          </div>
        )}

        {/* ══ Step 2: Connect Tenant ════════════════════════════════════════ */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-ink tracking-tight mb-1">
              Connect your Microsoft 365 tenant
            </h2>
            <p className="text-sm text-muted mb-7">
              Enter your Azure app registration credentials below.
            </p>

            <div className="space-y-4 mb-5">
              {/* Client Name */}
              <div>
                <label className="block text-[12px] font-semibold text-ink mb-1.5 uppercase tracking-wide">
                  Client Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Contoso Ltd"
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 placeholder-[#a8a29e]"
                />
              </div>

              {/* Tenant ID */}
              <div>
                <label className="block text-[12px] font-semibold text-ink mb-1.5 uppercase tracking-wide">
                  Tenant ID
                  <span className="text-faint font-normal ml-2 normal-case">
                    Azure AD → Properties
                  </span>
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => {
                    setTenantId(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 placeholder-[#a8a29e]"
                />
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-[12px] font-semibold text-ink mb-1.5 uppercase tracking-wide">
                  Client ID
                  <span className="text-faint font-normal ml-2 normal-case">
                    App Registration → Overview
                  </span>
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 placeholder-[#a8a29e]"
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-[12px] font-semibold text-ink mb-1.5 uppercase tracking-wide">
                  Client Secret
                  <span className="text-faint font-normal ml-2 normal-case">
                    Certificates &amp; Secrets
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={(e) => {
                      setClientSecret(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="Secret value"
                    className="w-full border border-border rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 placeholder-[#a8a29e]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test result banner */}
            {testResult && (
              <div
                className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-5 text-sm
                ${
                  testResult.ok
                    ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]'
                    : 'bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>
                  {testResult.ok
                    ? `Connected! Tenant: ${testResult.tenantName ?? testResult.domain ?? 'Microsoft 365'}`
                    : (testResult.error ??
                      'Connection failed. Check your credentials and try again.')}
                </span>
              </div>
            )}

            {/* Test Connection button */}
            <button
              onClick={handleTestConnection}
              disabled={testing || !tenantId || !clientId || !clientSecret}
              className="w-full border border-border hover:bg-canvas text-ink font-medium text-sm py-2.5 rounded-xl transition mb-6 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {testing ? 'Testing connection…' : 'Test Connection'}
            </button>

            {/* Back / Save & Continue */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-border hover:bg-canvas text-ink font-medium text-sm py-2.5 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSaveAndContinue}
                disabled={!step2Ready || saving}
                className="flex-[2] bg-ink hover:bg-ink text-on-accent font-semibold text-sm py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving…' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ══ Step 3: Choose Framework ══════════════════════════════════════ */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-ink tracking-tight mb-1">Choose a framework</h2>
            <p className="text-sm text-muted mb-7">
              Which compliance standard do you need to assess first?
            </p>

            <div className="space-y-2.5 mb-8">
              {frameworks.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#d6d3d1]" />
                </div>
              ) : (
                frameworks.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() => setSelectedFramework(fw.id)}
                    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition
                      ${
                        selectedFramework === fw.id
                          ? 'border-[#1c1917] bg-surface shadow-sm'
                          : 'border-border bg-surface hover:border-[#a8a29e]'
                      }`}
                  >
                    {/* Radio */}
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
                      ${selectedFramework === fw.id ? 'border-[#1c1917]' : 'border-border-strong'}`}
                    >
                      {selectedFramework === fw.id && (
                        <div className="w-2 h-2 rounded-full bg-ink" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{fw.name}</p>
                      {fw.description && (
                        <p className="text-[11px] text-faint mt-0.5 truncate">{fw.description}</p>
                      )}
                    </div>

                    {/* Control count badge */}
                    <span className="text-[11px] text-faint font-mono shrink-0">
                      {fw.controlCount} controls
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Back / Start Assessment */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-border hover:bg-canvas text-ink font-medium text-sm py-2.5 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleStartAssessment}
                disabled={!selectedFramework}
                className="flex-[2] bg-ink hover:bg-ink text-on-accent font-semibold text-sm py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Start My First Assessment <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step counter below card */}
      <p className="text-[11px] text-faint mt-5 font-mono">
        Step {step + 1} of {STEPS.length}
      </p>
    </div>
  )
}
