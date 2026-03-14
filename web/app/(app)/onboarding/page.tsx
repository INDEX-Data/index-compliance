'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, ChevronRight, ExternalLink,
  Eye, EyeOff, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import { getClients, getFrameworks, testConfig, addClient } from '@/lib/api'
import type { FrameworkMeta } from '@/lib/types'

const STEPS = ['Welcome', 'Connect Tenant', 'Choose Framework'] as const

export default function OnboardingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState(0)

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [name,         setName]         = useState('')
  const [tenantId,     setTenantId]     = useState('')
  const [clientId,     setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret,   setShowSecret]   = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean; tenantName?: string; domain?: string; error?: string
  } | null>(null)
  const [savedClientId, setSavedClientId] = useState<string | null>(null)

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [frameworks,         setFrameworks]         = useState<FrameworkMeta[]>([])
  const [selectedFramework,  setSelectedFramework]  = useState('')

  // Guard: if user already has a client, send them to dashboard
  useEffect(() => {
    getClients()
      .then(clients => {
        if (clients.length > 0) router.replace('/dashboard')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  // Load frameworks when reaching step 3
  useEffect(() => {
    if (step !== 2) return
    getFrameworks()
      .then(fw => {
        const implemented = fw.filter(f => f.implemented)
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
    if (savedClientId)     params.set('clientId',   savedClientId)
    if (selectedFramework) params.set('framework',  selectedFramework)
    router.push(`/assess?${params.toString()}`)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const fieldsComplete = name.trim() !== '' && tenantId !== '' && clientId !== '' && clientSecret !== ''
  const step2Ready     = testResult?.ok === true && fieldsComplete

  // ── Loading guard ─────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full">
        <ShieldCheck className="w-7 h-7 text-[#D4D4D4] animate-pulse" />
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
                    ${i < step  ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white'
                    : i === step ? 'border-[#0A0A0A] text-[#0A0A0A] bg-white'
                    :              'border-[#D4D4D4] text-[#D4D4D4] bg-white'}`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[12px] font-medium hidden sm:block transition-colors
                  ${i <= step ? 'text-[#1A1A1A]' : 'text-[#BBBBBB]'}`}>
                  {label}
                </span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 transition-colors ${i < step ? 'bg-[#0A0A0A]' : 'bg-[#E8E8E8]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Card ── */}
      <div className="w-full max-w-lg bg-white border border-[#E8E8E8] rounded-2xl shadow-sm">

        {/* ══ Step 1: Welcome ══════════════════════════════════════════════ */}
        {step === 0 && (
          <div className="p-8">
            <div className="w-12 h-12 rounded-2xl bg-[#FFFFFF] flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight mb-2">
              Welcome to INDEX
            </h1>
            <p className="text-sm text-[#555555] leading-relaxed mb-8">
              You&apos;re 2 steps away from your first compliance assessment.
              Before you connect, grab these from Azure Portal:
            </p>

            {/* Checklist */}
            <div className="space-y-2.5 mb-8">
              {[
                { label: 'Directory (Tenant) ID',   hint: 'Azure AD → Properties' },
                { label: 'Application (Client) ID', hint: 'App Registration → Overview' },
                { label: 'Client Secret value',     hint: 'Certificates & Secrets tab' },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 bg-[#FAFAFA] rounded-xl px-4 py-3"
                >
                  <div className="w-4 h-4 mt-0.5 rounded border-2 border-[#C4A96D] shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-[#0A0A0A]">{item.label}</p>
                    <p className="text-[11px] text-[#999999] mt-0.5">{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://portal.azure.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#555555] hover:text-[#0A0A0A] transition mb-8"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Azure Portal
            </a>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep(1)}
                className="w-full bg-[#0A0A0A] hover:bg-[#111111] text-white font-semibold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                Get Started <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-[#999999] hover:text-[#555555] transition text-center py-1"
              >
                Skip setup — I&apos;ll do this later
              </button>
            </div>
          </div>
        )}

        {/* ══ Step 2: Connect Tenant ════════════════════════════════════════ */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-[#0A0A0A] tracking-tight mb-1">
              Connect your Microsoft 365 tenant
            </h2>
            <p className="text-sm text-[#555555] mb-7">
              Enter your Azure app registration credentials below.
            </p>

            <div className="space-y-4 mb-5">

              {/* Client Name */}
              <div>
                <label className="block text-[12px] font-semibold text-[#1A1A1A] mb-1.5 uppercase tracking-wide">
                  Client Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Contoso Ltd"
                  className="w-full border border-[#E8E8E8] rounded-lg px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 placeholder-[#BBBBBB]"
                />
              </div>

              {/* Tenant ID */}
              <div>
                <label className="block text-[12px] font-semibold text-[#1A1A1A] mb-1.5 uppercase tracking-wide">
                  Tenant ID
                  <span className="text-[#999999] font-normal ml-2 normal-case">Azure AD → Properties</span>
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={e => { setTenantId(e.target.value); setTestResult(null) }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full border border-[#E8E8E8] rounded-lg px-3.5 py-2.5 text-sm font-mono text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 placeholder-[#BBBBBB]"
                />
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-[12px] font-semibold text-[#1A1A1A] mb-1.5 uppercase tracking-wide">
                  Client ID
                  <span className="text-[#999999] font-normal ml-2 normal-case">App Registration → Overview</span>
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => { setClientId(e.target.value); setTestResult(null) }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full border border-[#E8E8E8] rounded-lg px-3.5 py-2.5 text-sm font-mono text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 placeholder-[#BBBBBB]"
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-[12px] font-semibold text-[#1A1A1A] mb-1.5 uppercase tracking-wide">
                  Client Secret
                  <span className="text-[#999999] font-normal ml-2 normal-case">Certificates &amp; Secrets</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={e => { setClientSecret(e.target.value); setTestResult(null) }}
                    placeholder="Secret value"
                    className="w-full border border-[#E8E8E8] rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 placeholder-[#BBBBBB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#555555] transition"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test result banner */}
            {testResult && (
              <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-5 text-sm
                ${testResult.ok
                  ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]'
                  : 'bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]'}`}>
                {testResult.ok
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>
                  {testResult.ok
                    ? `Connected! Tenant: ${testResult.tenantName ?? testResult.domain ?? 'Microsoft 365'}`
                    : (testResult.error ?? 'Connection failed. Check your credentials and try again.')}
                </span>
              </div>
            )}

            {/* Test Connection button */}
            <button
              onClick={handleTestConnection}
              disabled={testing || !tenantId || !clientId || !clientSecret}
              className="w-full border border-[#E8E8E8] hover:bg-[#FAFAFA] text-[#1A1A1A] font-medium text-sm py-2.5 rounded-xl transition mb-6 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {testing ? 'Testing connection…' : 'Test Connection'}
            </button>

            {/* Back / Save & Continue */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-[#E8E8E8] hover:bg-[#FAFAFA] text-[#1A1A1A] font-medium text-sm py-2.5 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSaveAndContinue}
                disabled={!step2Ready || saving}
                className="flex-[2] bg-[#0A0A0A] hover:bg-[#111111] text-white font-semibold text-sm py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <h2 className="text-xl font-bold text-[#0A0A0A] tracking-tight mb-1">
              Choose a framework
            </h2>
            <p className="text-sm text-[#555555] mb-7">
              Which compliance standard do you need to assess first?
            </p>

            <div className="space-y-2.5 mb-8">
              {frameworks.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#D4D4D4]" />
                </div>
              ) : (
                frameworks.map(fw => (
                  <button
                    key={fw.id}
                    onClick={() => setSelectedFramework(fw.id)}
                    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition
                      ${selectedFramework === fw.id
                        ? 'border-[#0A0A0A] bg-white shadow-sm'
                        : 'border-[#E8E8E8] bg-white hover:border-[#BBBBBB]'}`}
                  >
                    {/* Radio */}
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
                      ${selectedFramework === fw.id ? 'border-[#0A0A0A]' : 'border-[#D4D4D4]'}`}>
                      {selectedFramework === fw.id && (
                        <div className="w-2 h-2 rounded-full bg-[#0A0A0A]" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0A0A0A]">{fw.name}</p>
                      {fw.description && (
                        <p className="text-[11px] text-[#999999] mt-0.5 truncate">{fw.description}</p>
                      )}
                    </div>

                    {/* Control count badge */}
                    <span className="text-[11px] text-[#BBBBBB] font-mono shrink-0">
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
                className="flex-1 border border-[#E8E8E8] hover:bg-[#FAFAFA] text-[#1A1A1A] font-medium text-sm py-2.5 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleStartAssessment}
                disabled={!selectedFramework}
                className="flex-[2] bg-[#0A0A0A] hover:bg-[#111111] text-white font-semibold text-sm py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Start My First Assessment <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Step counter below card */}
      <p className="text-[11px] text-[#BBBBBB] mt-5 font-mono">
        Step {step + 1} of {STEPS.length}
      </p>

    </div>
  )
}
