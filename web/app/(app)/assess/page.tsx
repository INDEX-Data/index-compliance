'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Loader2, Lock, CheckCircle2,
  Building2, ChevronDown, Play, ArrowRight, X,
  ShieldCheck, AlertTriangle,
} from 'lucide-react'
import Image from 'next/image'
import { getFrameworks, getClients } from '@/lib/api'
import { CATEGORY_ORDER, type FrameworkCategory } from '@/lib/framework-catalog'
import type { FrameworkMeta as FrameworkInfo, Client } from '@/lib/types'

// Official logos/badges per framework
const FRAMEWORK_LOGOS: Record<string, string> = {
  'baseline':        '/atlas-logo.svg',
  'ai-readiness':    '/atlas-logo.svg',
  'nist-csf':        '/frameworks/nist.png',
  'cmmc-l2':         '/frameworks/cmmc.svg',
  'nist-800-171':    '/frameworks/nist.png',
  'hipaa':           '/frameworks/hipaa.png',
  'finra':           '/frameworks/finra.png',
  'ferpa':           '/frameworks/ferpa.png',
  'soc2':            '/frameworks/soc2.png',
  'iso-27001':       '/frameworks/iso.png',
  'pci-dss':         '/frameworks/pci-dss.png',
  'gdpr':            '/frameworks/gdpr.png',
  'hitrust':         '/frameworks/hitrust.svg',
  'fda':             '/frameworks/fda.png',
  'nydfs-nycrr-500': '/frameworks/nydfs.svg',
  'sec':             '/frameworks/sec.png',
  'iso-27017':       '/frameworks/iso.png',
  'cis-controls':    '/frameworks/cis.svg',
  'mvsp':            '/frameworks/mvsp.svg',
}

const CATEGORY_LABELS: Record<FrameworkCategory, string> = {
  baseline:         'Baseline Assessment',
  ai_readiness:     'AI Readiness',
  defense_gov:      'Defense & Government',
  financial:        'Financial Services',
  healthcare:       'Healthcare & Life Sciences',
  privacy:          'Privacy & Education',
  general_security: 'General Security',
}

export default function AssessPage() {
  const router = useRouter()

  const [frameworks,      setFrameworks]      = useState<FrameworkInfo[]>([])
  const [clients,         setClients]         = useState<Client[]>([])
  const [selectedClient,  setSelectedClient]  = useState<Client | null>(null)
  const [clientDropdown,  setClientDropdown]  = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [launching,       setLaunching]       = useState<string | null>(null)
  const [confirmFw,       setConfirmFw]       = useState<FrameworkInfo | null>(null)

  useEffect(() => {
    Promise.all([getFrameworks(), getClients()])
      .then(([fws, clients]) => {
        setFrameworks(fws)
        setClients(clients)
        if (clients.length > 0) setSelectedClient(clients[0])
      })
      .finally(() => setLoading(false))
  }, [])

  // Group frameworks by category, maintaining CATEGORY_ORDER
  const grouped = useMemo(() => {
    const map = new Map<FrameworkCategory, FrameworkInfo[]>()
    for (const cat of CATEGORY_ORDER) {
      const entries = frameworks.filter(f => f.category === cat)
      // Sort: implemented first
      entries.sort((a, b) => (a.implemented === b.implemented ? 0 : a.implemented ? -1 : 1))
      if (entries.length > 0) map.set(cat, entries)
    }
    // Frameworks without a category go at the end
    const uncategorized = frameworks.filter(f => !f.category)
    if (uncategorized.length > 0) map.set('general_security' as FrameworkCategory, [
      ...(map.get('general_security' as FrameworkCategory) ?? []),
      ...uncategorized,
    ])
    return map
  }, [frameworks])

  function handleCardClick(fw: FrameworkInfo) {
    if (!fw.implemented || !selectedClient) return
    setConfirmFw(fw)
  }

  async function handleConfirmRun() {
    if (!confirmFw || !selectedClient) return
    setLaunching(confirmFw.id)
    setConfirmFw(null)
    await new Promise(r => setTimeout(r, 250))
    router.push(`/assess/running?framework=${confirmFw.id}&clientId=${selectedClient.id}`)
  }

  return (
    <div className="max-w-6xl px-8 lg:px-12 py-16">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#1c1917]">
            Run Assessment
          </h1>
          <p className="text-[#44403c] text-sm">
            Select a governance framework to begin documentation.
          </p>
        </div>
      </div>

      {/* No tenant warning — shown above frameworks */}
      {!loading && clients.length === 0 && (
        <div className="mb-12 flex items-center gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-6 py-4">
          <ShieldCheck className="w-5 h-5 text-[#B45309] shrink-0" />
          <p className="text-sm text-[#92400E]">
            No Microsoft 365 tenant connected.{' '}
            <a href="/connect" className="font-semibold underline hover:text-[#78350F]">
              Connect your tenant to get started →
            </a>
          </p>
        </div>
      )}

      {/* ── Framework Grid (categorized) ── */}
      {loading ? (
        <div className="flex items-center justify-center py-32 text-[#78716c]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading frameworks…</span>
        </div>
      ) : (
        <div className="space-y-14">
          {Array.from(grouped.entries()).map(([cat, fws]) => (
            <section key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#a8a29e] whitespace-nowrap">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <div className="h-px flex-1 bg-[#e7e5e4]" />
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {fws.map(fw => {
                  const logo        = FRAMEWORK_LOGOS[fw.id]
                  const isLaunching = launching === fw.id
                  const disabled    = !fw.implemented || !selectedClient

                  return (
                    <div
                      key={fw.id}
                      className={`group relative bg-white p-8 rounded-2xl border border-slate-100 flex flex-col
                                  transition-all
                                  ${disabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'cursor-pointer hover:shadow-xl hover:border-[#1c1917]/20'
                                  }`}
                      onClick={() => !disabled && handleCardClick(fw)}
                    >
                      {/* Logo */}
                      <div className="mb-6">
                        <div className="w-12 h-12 rounded-xl bg-[#fafaf9] border border-[#e7e5e4] flex items-center justify-center overflow-hidden p-1.5">
                          {logo ? (
                            <Image
                              src={logo}
                              alt={fw.name}
                              width={36}
                              height={36}
                              className="object-contain w-full h-full"
                            />
                          ) : (
                            <Shield className="w-6 h-6 text-[#78716c]" strokeWidth={1.5} />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold tracking-tight text-[#1c1917] mb-2">{fw.name}</h3>
                        {fw.description && (
                          <p className="text-[13px] text-[#44403c] leading-relaxed mb-4 opacity-80">{fw.description}</p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a8a29e]">
                          {fw.controlCount} Controls
                        </span>
                        {fw.implemented ? (
                          isLaunching ? (
                            <Loader2 className="w-4 h-4 text-[#1c1917] animate-spin" />
                          ) : (
                            <ArrowRight
                              className="w-5 h-5 text-[#1c1917] opacity-0 group-hover:opacity-100 transition-opacity"
                              strokeWidth={1.5}
                            />
                          )
                        ) : (
                          <span className="text-[10px] font-medium bg-[#fafaf9] text-[#78716c] px-2.5 py-1 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Coming soon
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Client Configuration ── */}
      {!loading && clients.length > 0 && (
        <div className="mt-28">
          <div className="flex items-center gap-3 mb-10">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-[#a8a29e]">
              Assessment Configuration
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {/* Client selector */}
            <div className="space-y-4">
              <label className="block text-[11px] font-bold text-[#44403c] uppercase tracking-widest opacity-60">
                Client Tenant
              </label>
              {clients.length === 1 ? (
                <div className="flex items-center gap-4 py-4 px-6 bg-white border border-slate-100 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#fafaf9] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#1c1917]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-base font-semibold text-[#1c1917]">{selectedClient?.name}</span>
                    <p className="text-[11px] font-mono text-[#a8a29e]">{selectedClient?.tenantId.slice(0, 12)}…</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setClientDropdown(s => !s)}
                    className="w-full flex items-center gap-4 py-4 px-6 bg-white border border-slate-100 rounded-xl
                               hover:border-[#1c1917]/30 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#fafaf9] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[#1c1917]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-base font-semibold text-[#1c1917]">
                        {selectedClient?.name ?? 'Select client…'}
                      </span>
                      {selectedClient && (
                        <p className="text-[11px] font-mono text-[#a8a29e]">{selectedClient.tenantId.slice(0, 12)}…</p>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-300" />
                  </button>

                  {clientDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-[#e7e5e4]
                                    rounded-xl shadow-lg overflow-hidden">
                      {clients.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedClient(c); setClientDropdown(false) }}
                          className={`w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-[#fafaf9] transition
                                      ${c.id === selectedClient?.id ? 'bg-[#fafaf9]' : ''}`}
                        >
                          <Building2 className="w-4 h-4 text-[#78716c] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#1c1917] truncate">{c.name}</p>
                            <p className="text-[11px] font-mono text-[#a8a29e] truncate">{c.tenantId}</p>
                          </div>
                          {c.id === selectedClient?.id && (
                            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assessment info */}
            <div className="space-y-4">
              <label className="block text-[11px] font-bold text-[#44403c] uppercase tracking-widest opacity-60">
                Assessment Details
              </label>
              <div className="flex items-center gap-4 py-4 px-6 bg-white border border-slate-100 rounded-xl">
                <Shield className="w-5 h-5 text-[#1c1917]" strokeWidth={1.5} />
                <div>
                  <span className="text-sm font-semibold text-[#1c1917]">Real-time M365 query</span>
                  <p className="text-[11px] text-[#a8a29e]">Typically 30–120 seconds per framework</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="mt-32 pt-8 flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.15em] text-[#a8a29e]">
        <div className="flex gap-8">
          <span>© {new Date().getFullYear()} Atlas Compliance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#1c1917] animate-pulse" />
          <span>Systems Operational</span>
        </div>
      </footer>

      {/* ── Confirmation Modal ── */}
      {confirmFw && selectedClient && (() => {
        const logo = FRAMEWORK_LOGOS[confirmFw.id]

        return (
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmFw(null)}
          >
            <div
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-[#e7e5e4]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#fafaf9] border border-[#e7e5e4] flex items-center justify-center overflow-hidden p-1.5">
                      {logo ? (
                        <Image src={logo} alt={confirmFw.name} width={28} height={28} className="object-contain w-full h-full" />
                      ) : (
                        <Shield className="w-5 h-5 text-[#78716c]" strokeWidth={1.5} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#1c1917]">Confirm Assessment</h2>
                      <p className="text-xs text-[#78716c] mt-0.5">{confirmFw.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmFw(null)}
                    className="p-1 rounded-lg hover:bg-[#fafaf9] transition-colors text-[#a8a29e] hover:text-[#44403c]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Tenant card */}
                <div className="bg-[#fafaf9] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a8a29e] mb-3">Target Tenant</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-[#e7e5e4]">
                      <Building2 className="w-4 h-4 text-[#1c1917]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1c1917]">{selectedClient.name}</p>
                      <p className="text-[11px] font-mono text-[#a8a29e]">{selectedClient.tenantId}</p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#fafaf9] rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a8a29e] mb-1">Framework</p>
                    <p className="text-sm font-semibold text-[#1c1917]">{confirmFw.name}</p>
                  </div>
                  <div className="flex-1 bg-[#fafaf9] rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a8a29e] mb-1">Controls</p>
                    <p className="text-sm font-semibold text-[#1c1917]">{confirmFw.controlCount}</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3.5 py-3">
                  <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#92400E] leading-relaxed">
                    This will query the Microsoft 365 tenant in real-time. Please confirm you are assessing the correct client.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setConfirmFw(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#e7e5e4] text-sm font-medium text-[#44403c]
                             hover:bg-[#fafaf9] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRun}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#1c1917] text-white text-sm font-semibold
                             flex items-center justify-center gap-2
                             hover:bg-[#0c0a09] transition-colors"
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                  Run Assessment
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
