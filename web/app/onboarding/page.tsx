'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Users, ChevronRight, Check,
  Loader2, AlertCircle, BarChart3, FileCheck, ShieldCheck,
} from 'lucide-react'
import Image from 'next/image'
import { createClientSupabase } from '@/lib/supabase'
import { saveProfile, getProfile } from '@/lib/api'

const INDUSTRIES = [
  'Defense / DIB', 'Healthcare', 'Finance / FinTech', 'Government',
  'Education', 'Technology', 'Manufacturing', 'Other',
]
const ORG_SIZES = ['1–10', '11–50', '51–250', '251–1,000', '1,000+']
const ROLES = [
  'CISO / CSO', 'IT Manager / Director', 'Security Analyst',
  'Compliance Officer', 'MSP / Consultant', 'Other',
]

export default function OnboardingPage() {
  const router = useRouter()

  // Phase: loading = checking for existing profile; wizard = show the form
  const [phase,        setPhase]        = useState<'loading' | 'wizard'>('loading')
  const [step,         setStep]         = useState<1 | 2>(1)
  const [transitioning, setTransitioning] = useState(false)

  // Step 1
  const [accountType, setAccountType] = useState<'org' | 'msp' | null>(null)

  // Step 2
  const [companyName, setCompanyName] = useState('')
  const [role,        setRole]        = useState('')
  const [industry,    setIndustry]    = useState('')
  const [orgSize,     setOrgSize]     = useState('')

  // Submission
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // On mount: check if profile already exists (returning user).
  // Supabase sessions are cookie-based — no token polling needed.
  useEffect(() => {
    async function check() {
      const supabase = createClientSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setPhase('wizard'); return }
      const user = session.user
      try {
        const profile = await getProfile()
        // Profile exists with real data — returning user whose onboarding flags
        // may be missing (e.g. cookie was lost, metadata update failed).
        // Re-trigger /onboard-finish to set the flags, then hard-navigate.
        if (profile.companyName) {
          await fetch('/onboard-finish', { method: 'POST' }).catch(() => {})
          const dest = profile.accountType === 'msp' ? '/clients' : '/dashboard'
          window.location.href = dest  // hard nav so browser sends fresh cookie
          return
        }
        setPhase('wizard')
      } catch {
        // 404 = new user; any other error = show wizard (don't block)
        setPhase('wizard')
      }
    }
    check()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function goToStep(n: 1 | 2) {
    setTransitioning(true)
    setTimeout(() => {
      setStep(n)
      setError(null)
      setTransitioning(false)
    }, 150)
  }

  async function handleFinish() {
    if (!accountType || !companyName.trim()) return
    setSaving(true)
    setError(null)
    try {
      // STEP 1: Complete onboarding gate — sets cookie + user metadata
      const flagRes = await fetch('/onboard-finish', { method: 'POST', redirect: 'error' })
      if (!flagRes.ok) {
        const body = await flagRes.json().catch(() => ({}))
        throw new Error((body as any).error ?? 'Failed to complete workspace setup')
      }

      // STEP 2: Save profile to database
      await saveProfile({ companyName: companyName.trim(), accountType, role, orgSize, industry })

      // Hard navigation so the browser sends the fresh idx_onboarded cookie.
      window.location.href = accountType === 'msp' ? '/clients' : '/dashboard'
    } catch (e) {
      setSaving(false)
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#1c1917] animate-spin" />
      </div>
    )
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — dark branding ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] shrink-0 flex-col
                      bg-gradient-to-b from-[#1c1d1f] to-[#111213] text-white px-10 py-12">

        {/* Logo */}
        <div className="flex items-center">
          <Image src="/atlas-logo.svg" alt="Atlas" width={160} height={64} className="h-10 w-auto invert" />
        </div>

        {/* Value prop — vertically centered */}
        <div className="mt-auto mb-auto py-16">
          <h2 className="text-3xl font-bold leading-snug tracking-tight mb-2">
            Your compliance<br />command center
          </h2>
          <p className="text-[14px] text-white/40 mb-10 leading-relaxed">
            Automated security assessments for Microsoft 365 environments.
          </p>

          {/* Feature bullets */}
          <div className="space-y-7">
            {[
              {
                icon: ShieldCheck,
                title: 'Automated M365 assessments',
                body:  'Scan 100+ controls across CMMC, NIST, HIPAA, and more',
              },
              {
                icon: BarChart3,
                title: 'Real-time gap analysis',
                body:  'See exactly what needs fixing with actionable guidance',
              },
              {
                icon: FileCheck,
                title: 'Audit-ready reports',
                body:  'Export compliance evidence with one click',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <Icon className="w-5 h-5 text-white/70 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[14px] font-semibold text-white">{title}</p>
                  <p className="text-[13px] text-white/45 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Framework pills */}
        <div className="flex flex-wrap gap-2">
          {['CMMC L2', 'NIST 800-171', 'HIPAA', 'FINRA', 'FERPA'].map(f => (
            <span
              key={f}
              className="border border-white/10 bg-white/5 text-white/45
                         text-[11px] rounded-full px-3 py-1"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex-1 bg-white relative flex flex-col items-center justify-center
                      px-6 sm:px-10 py-12">

        {/* Step indicator — top right */}
        <div className="absolute top-8 right-10 flex items-center gap-1.5">
          {[1, 2].map(n => (
            <div
              key={n}
              className={`rounded-full transition-all duration-300 ${
                step === n ? 'bg-[#1c1917] w-6 h-2' : 'bg-[#e7e5e4] w-2 h-2'
              }`}
            />
          ))}
        </div>

        {/* Form card — centered, max width */}
        <div className="w-full max-w-[480px]">

          {/* Step content with fade transition */}
          <div
            className={`transition-all duration-150 ${
              transitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >

            {/* ══ Step 1: Account Type ══════════════════════════════════════ */}
            {step === 1 && (
              <div>
                <h1
                  className="text-[28px] font-bold text-[#1c1d1f] mb-1.5"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  How will you use Atlas?
                </h1>
                <p className="text-[14px] text-[#78716c] mb-8">
                  We&apos;ll set up your workspace based on your answer.
                </p>

                <div className="space-y-3">

                  {/* Organisation card */}
                  <button
                    onClick={() => setAccountType('org')}
                    className={`relative w-full text-left p-6 rounded-2xl border-2 transition-all
                      hover:scale-[1.005] ${
                        accountType === 'org'
                          ? 'border-[#1c1917] bg-[rgba(37,93,173,0.03)]'
                          : 'border-[#e7e5e4] hover:border-[#d6d3d1]'
                      }`}
                  >
                    {accountType === 'org' && (
                      <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#1c1917]
                                      flex items-center justify-center animate-fade-in">
                        <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4
                      ${accountType === 'org' ? 'bg-[#1c1917]' : 'bg-[#f3f4f6]'}`}>
                      <Building2
                        className={`w-5 h-5 ${accountType === 'org' ? 'text-white' : 'text-[#505967]'}`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3 className="text-[15px] font-semibold text-[#1c1d1f] mb-1.5">Organisation</h3>
                    <p className="text-[13px] text-[#505967] leading-relaxed">
                      Assess your own company&apos;s Microsoft 365 environment against CMMC, NIST, HIPAA, and more.
                    </p>
                  </button>

                  {/* MSP / MSSP card */}
                  <button
                    onClick={() => setAccountType('msp')}
                    className={`relative w-full text-left p-6 rounded-2xl border-2 transition-all
                      hover:scale-[1.005] ${
                        accountType === 'msp'
                          ? 'border-[#1c1917] bg-[rgba(37,93,173,0.03)]'
                          : 'border-[#e7e5e4] hover:border-[#d6d3d1]'
                      }`}
                  >
                    {accountType === 'msp' && (
                      <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#1c1917]
                                      flex items-center justify-center animate-fade-in">
                        <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4
                      ${accountType === 'msp' ? 'bg-[#1c1917]' : 'bg-[#f3f4f6]'}`}>
                      <Users
                        className={`w-5 h-5 ${accountType === 'msp' ? 'text-white' : 'text-[#505967]'}`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3 className="text-[15px] font-semibold text-[#1c1d1f] mb-1.5">MSP / MSSP</h3>
                    <p className="text-[13px] text-[#505967] leading-relaxed">
                      Manage compliance for multiple client organisations with multi-tenant
                      dashboards, client portals, and cross-org reporting.
                    </p>
                  </button>
                </div>

                <button
                  onClick={() => goToStep(2)}
                  disabled={!accountType}
                  className="mt-8 w-full flex items-center justify-center gap-2 py-3.5
                             rounded-xl text-[14px] font-semibold text-white transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed
                             hover:bg-[#2e3238]"
                  style={{ background: '#1c1d1f' }}
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ══ Step 2: Company Details ═══════════════════════════════════ */}
            {step === 2 && (
              <div>
                <h1
                  className="text-[28px] font-bold text-[#1c1d1f] mb-1.5"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  About your organisation
                </h1>
                <p className="text-[14px] text-[#78716c] mb-8">
                  A few quick details to personalise your experience.
                </p>

                {/* Error — shown at top so it cannot be missed */}
                {error && (
                  <div className="mb-6 flex items-start gap-3 p-4 rounded-xl
                                  bg-red-50 border border-red-200">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[14px] font-medium text-red-700">{error}</p>
                  </div>
                )}

                <div className="space-y-6">

                  {/* Company Name */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5
                                      uppercase tracking-wide">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Acme Defense Corp"
                      autoFocus
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] bg-white
                                 text-[14px] text-[#1c1d1f] placeholder-[#a8a29e]
                                 focus:outline-none focus:border-[#1c1d1f] focus:ring-2
                                 focus:ring-[#1c1d1f]/10 transition-colors"
                    />
                  </div>

                  {/* Your Role */}
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-2
                                      uppercase tracking-wide">
                      Your Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r === role ? '' : r)}
                          className={`text-left px-3.5 py-2.5 rounded-lg border text-[13px]
                            transition-all ${
                              role === r
                                ? 'border-[#1c1917] bg-[#1c1917] text-white font-medium'
                                : 'border-[#e7e5e4] text-[#505967] hover:border-[#d6d3d1]'
                            }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Industry + Org Size */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5
                                        uppercase tracking-wide">
                        Industry
                      </label>
                      <select
                        value={industry}
                        onChange={e => setIndustry(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] bg-white
                                   text-[13px] text-[#1c1d1f] focus:outline-none
                                   focus:border-[#1c1d1f] transition-colors"
                      >
                        <option value="">Select…</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5
                                        uppercase tracking-wide">
                        Team Size
                      </label>
                      <select
                        value={orgSize}
                        onChange={e => setOrgSize(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] bg-white
                                   text-[13px] text-[#1c1d1f] focus:outline-none
                                   focus:border-[#1c1d1f] transition-colors"
                      >
                        <option value="">Select…</option>
                        {ORG_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => goToStep(1)}
                    disabled={saving}
                    className="px-5 py-3.5 rounded-xl border border-[#e7e5e4] text-[13px]
                               font-medium text-[#505967] hover:bg-[#f3f4f6] transition-colors
                               disabled:opacity-40"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={!companyName.trim() || saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl
                               text-[14px] font-semibold text-white transition-all
                               disabled:opacity-40 disabled:cursor-not-allowed
                               hover:bg-[#0c0a09]"
                    style={{ background: '#1c1917' }}
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                      : <>Create workspace <ChevronRight className="w-4 h-4" /></>
                    }
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
