'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { saveConfig, testConfig } from '@/lib/api'

type Step = 'enter' | 'testing' | 'success' | 'error'

export default function SetupPage() {
  const router = useRouter()

  const [step, setStep]             = useState<Step>('enter')
  const [tenantId, setTenantId]     = useState('')
  const [clientId, setClientId]     = useState('')
  const [clientSecret, setSecret]   = useState('')
  const [tenantName, setTenantName] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [detectedName, setDetected] = useState('')
  const [errorMsg, setErrorMsg]     = useState('')
  const [saving, setSaving]         = useState(false)

  const canTest = tenantId.trim() && clientId.trim() && clientSecret.trim()

  async function handleTest() {
    if (!canTest) return
    setStep('testing')
    setErrorMsg('')
    try {
      const result = await testConfig({ tenantId, clientId, clientSecret })
      if (result.ok) {
        setDetected(result.tenantName ?? tenantId)
        if (!tenantName) setTenantName(result.tenantName ?? '')
        setStep('success')
      } else {
        setErrorMsg(result.error ?? 'Connection failed')
        setStep('error')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Network error')
      setStep('error')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveConfig({ tenantId, clientId, clientSecret, tenantName: tenantName || detectedName })
      router.push('/')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Save failed')
      setStep('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1E1E1C 0%, #141412 60%, #0E0E0D 100%)' }}
    >
      <div className="w-full max-w-[440px]">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#F7F5F1] mb-4">
            <ShieldCheck className="w-6 h-6 text-[#141412]" />
          </div>
          <div className="text-[15px] font-bold text-[#F5F4EF] tracking-widest uppercase">INDEX</div>
          <div className="text-[11px] text-[#4A4A42] mt-0.5 tracking-wide uppercase">Compliance Platform</div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-[#F0EDE6]">
            <h2 className="text-[16px] font-bold text-[#18181B]">Connect Azure tenant</h2>
            <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
              Enter your App Registration credentials to get started
            </p>
          </div>

          <div className="p-6 space-y-4">

            {/* Tenant ID */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                Tenant ID
              </label>
              <input
                type="text"
                value={tenantId}
                onChange={e => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm font-mono text-[#18181B]
                           placeholder-[#C4BFB5] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#C4A96D]/40 focus:border-[#C4A96D] transition"
                disabled={step === 'testing'}
              />
            </div>

            {/* Client ID */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm font-mono text-[#18181B]
                           placeholder-[#C4BFB5] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#C4A96D]/40 focus:border-[#C4A96D] transition"
                disabled={step === 'testing'}
              />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                Client Secret
              </label>
              <div className="relative" suppressHydrationWarning>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="Your app registration secret value"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#E9E5DD] text-sm font-mono text-[#18181B]
                             placeholder-[#C4BFB5] bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#C4A96D]/40 focus:border-[#C4A96D] transition"
                  disabled={step === 'testing'}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#6B7280] transition"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Display name (optional) */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">
                Display Name <span className="text-[#C4BFB5] font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={tenantName}
                onChange={e => setTenantName(e.target.value)}
                placeholder="e.g. Acme Corp (auto-detected if blank)"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E9E5DD] text-sm text-[#18181B]
                           placeholder-[#C4BFB5] bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#C4A96D]/40 focus:border-[#C4A96D] transition"
                disabled={step === 'testing'}
              />
            </div>

            {/* Status feedback */}
            {step === 'success' && (
              <div className="flex items-start gap-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#15803D]">Connection successful</p>
                  <p className="text-xs text-[#166534] mt-0.5">Tenant: <strong>{detectedName}</strong></p>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#B91C1C]">Connection failed</p>
                  <p className="text-xs text-[#991B1B] mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {step !== 'success' ? (
                <button
                  onClick={handleTest}
                  disabled={!canTest || step === 'testing'}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#18181B] hover:bg-[#27272A]
                             disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed
                             text-white font-semibold text-sm py-2.5 rounded-lg transition"
                >
                  {step === 'testing' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
                  ) : (
                    <>Test Connection <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setStep('enter')}
                    className="px-4 py-2.5 text-sm font-medium text-[#6B7280] bg-[#F7F5F1] hover:bg-[#F0EDE6] rounded-lg transition border border-[#E9E5DD]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#18181B] hover:bg-[#27272A]
                               disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]
                               text-white font-semibold text-sm py-2.5 rounded-lg transition"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <>Open Dashboard <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-[#FAFAF8] border-t border-[#F0EDE6] px-6 py-3.5">
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              Credentials are stored locally on this machine only and never transmitted externally.
              Requires an Azure App Registration with Microsoft Graph application permissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
