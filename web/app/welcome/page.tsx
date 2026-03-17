'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Building2, Users, ChevronRight, Check, Loader2 } from 'lucide-react'
import { saveProfile } from '@/lib/api'

const INDUSTRIES = ['Defense / DIB', 'Healthcare', 'Finance / FinTech', 'Government', 'Education', 'Technology', 'Manufacturing', 'Other']
const ORG_SIZES  = ['1–10', '11–50', '51–250', '251–1,000', '1,000+']
const ROLES      = ['CISO / CSO', 'IT Manager / Director', 'Security Analyst', 'Compliance Officer', 'MSP / Consultant', 'Other']

export default function WelcomePage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)

  // Step 1 — company details
  const [companyName, setCompanyName] = useState('')
  const [role,        setRole]        = useState('')
  const [orgSize,     setOrgSize]     = useState('')
  const [industry,    setIndustry]    = useState('')

  // Step 2 — account type
  const [accountType, setAccountType] = useState<'org' | 'msp' | null>(null)

  async function handleFinish() {
    if (!accountType) return
    setSaving(true)
    try {
      await saveProfile({ companyName, accountType, role, orgSize, industry })
      if (accountType === 'msp') {
        router.replace('/clients')
      } else {
        router.replace('/onboarding')
      }
    } catch (e) {
      setSaving(false)
    }
  }

  const step1Valid = companyName.trim().length > 0

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Logo / brand */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-[#1c1d1f] flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-[#1c1d1f] tracking-tight">INDEX</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                step > s ? 'bg-[#1c1d1f] text-white' : step === s ? 'bg-[#1c1d1f] text-white' : 'bg-[#e4e7ec] text-[#a4adba]'
              }`}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 2 && <div className={`h-px w-8 transition-colors ${step > s ? 'bg-[#1c1d1f]' : 'bg-[#e4e7ec]'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Company details ── */}
        {step === 1 && (
          <div>
            <h1 className="text-[26px] font-bold text-[#1c1d1f] mb-1" style={{ letterSpacing: '-0.02em' }}>
              Welcome to INDEX
            </h1>
            <p className="text-[14px] text-[#6f7988] mb-8">Tell us a bit about your organisation.</p>

            <div className="space-y-5">
              {/* Company name */}
              <div>
                <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Defense Corp"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#e4e7ec] bg-white text-[14px] text-[#1c1d1f] placeholder-[#a4adba] focus:outline-none focus:border-[#1c1d1f] transition-colors"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">Your Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`text-left px-3.5 py-2.5 rounded-lg border text-[13px] transition-all ${
                        role === r
                          ? 'border-[#1c1d1f] bg-[rgba(28,29,31,0.04)] font-medium text-[#1c1d1f]'
                          : 'border-[#e4e7ec] text-[#505967] hover:border-[#c8ccd4]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry + Org size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">Industry</label>
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e4e7ec] bg-white text-[13px] text-[#1c1d1f] focus:outline-none focus:border-[#1c1d1f] transition-colors"
                  >
                    <option value="">Select…</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#1c1d1f] mb-1.5 uppercase tracking-wide">Org Size</label>
                  <select
                    value={orgSize}
                    onChange={e => setOrgSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e4e7ec] bg-white text-[13px] text-[#1c1d1f] focus:outline-none focus:border-[#1c1d1f] transition-colors"
                  >
                    <option value="">Select…</option>
                    {ORG_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="mt-8 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#1c1d1f' }}
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Account type ── */}
        {step === 2 && (
          <div>
            <h1 className="text-[26px] font-bold text-[#1c1d1f] mb-1" style={{ letterSpacing: '-0.02em' }}>
              How will you use INDEX?
            </h1>
            <p className="text-[14px] text-[#6f7988] mb-8">This sets up your workspace experience.</p>

            <div className="space-y-3">
              {/* Organisation */}
              <button
                onClick={() => setAccountType('org')}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  accountType === 'org'
                    ? 'border-[#1c1d1f] bg-[rgba(28,29,31,0.03)]'
                    : 'border-[#e4e7ec] hover:border-[#c8ccd4]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    accountType === 'org' ? 'bg-[#1c1d1f]' : 'bg-[#f3f4f6]'
                  }`}>
                    <Building2 className={`w-5 h-5 ${accountType === 'org' ? 'text-white' : 'text-[#a4adba]'}`} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1c1d1f]">Organisation</p>
                    <p className="text-[12px] text-[#6f7988] mt-0.5 leading-relaxed">
                      Assessing your own organisation&apos;s Microsoft 365 environment for CMMC, NIST, or other frameworks.
                    </p>
                  </div>
                  {accountType === 'org' && (
                    <div className="w-5 h-5 rounded-full bg-[#1c1d1f] flex items-center justify-center shrink-0 ml-auto mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>

              {/* MSP/MSSP */}
              <button
                onClick={() => setAccountType('msp')}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  accountType === 'msp'
                    ? 'border-[#1c1d1f] bg-[rgba(28,29,31,0.03)]'
                    : 'border-[#e4e7ec] hover:border-[#c8ccd4]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    accountType === 'msp' ? 'bg-[#1c1d1f]' : 'bg-[#f3f4f6]'
                  }`}>
                    <Users className={`w-5 h-5 ${accountType === 'msp' ? 'text-white' : 'text-[#a4adba]'}`} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1c1d1f]">MSP / MSSP</p>
                    <p className="text-[12px] text-[#6f7988] mt-0.5 leading-relaxed">
                      Managing compliance assessments across multiple client organisations. You&apos;ll get multi-tenant management, client portals, and cross-org reporting.
                    </p>
                  </div>
                  {accountType === 'msp' && (
                    <div className="w-5 h-5 rounded-full bg-[#1c1d1f] flex items-center justify-center shrink-0 ml-auto mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-xl border border-[#e4e7ec] text-[13px] font-medium text-[#505967] hover:bg-[#f3f4f6] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!accountType || saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#1c1d1f' }}
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</> : <>Set up my workspace <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
