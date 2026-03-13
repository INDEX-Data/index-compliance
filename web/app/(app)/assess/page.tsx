'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ChevronRight, Loader2, Lock, CheckCircle2, Building2, ChevronDown } from 'lucide-react'
import { getFrameworks, getClients } from '@/lib/api'
import type { FrameworkMeta as FrameworkInfo, Client } from '@/lib/types'

// Accent color per framework — left border bar only
const FRAMEWORK_ACCENT: Record<string, string> = {
  'nist-csf':     '#0F766E',
  'cmmc-l2':      '#6D28D9',
  'nist-800-171': '#1D4ED8',
  'hipaa':        '#15803D',
  'finra':        '#B45309',
  'ferpa':        '#BE185D',
}

const FRAMEWORK_ICONS: Record<string, string> = {
  'nist-csf':     '🛡️',
  'cmmc-l2':      '🔒',
  'nist-800-171': '🏛️',
  'hipaa':        '🏥',
  'finra':        '📈',
  'ferpa':        '🎓',
}

export default function AssessPage() {
  const router = useRouter()

  const [frameworks,      setFrameworks]      = useState<FrameworkInfo[]>([])
  const [clients,         setClients]         = useState<Client[]>([])
  const [selectedClient,  setSelectedClient]  = useState<Client | null>(null)
  const [clientDropdown,  setClientDropdown]  = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [launching,       setLaunching]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getFrameworks(), getClients()])
      .then(([fws, clients]) => {
        setFrameworks(fws)
        setClients(clients)
        if (clients.length > 0) setSelectedClient(clients[0])
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleRun(fw: FrameworkInfo) {
    if (!fw.implemented || !selectedClient) return
    setLaunching(fw.id)
    await new Promise(r => setTimeout(r, 250))
    router.push(`/assess/running?framework=${fw.id}&clientId=${selectedClient.id}`)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight">Run Assessment</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Select a client and compliance framework to assess
        </p>
      </div>

      {/* Client selector */}
      {!loading && (
        <div className="mb-7">
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-2">
            Client Context
          </p>

          {clients.length === 0 ? (
            <div className="flex items-center gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3">
              <Building2 className="w-4 h-4 text-[#B45309] shrink-0" />
              <p className="text-sm text-[#92400E]">
                No clients configured.{' '}
                <a href="/clients" className="font-semibold underline hover:text-[#78350F]">
                  Add a client first →
                </a>
              </p>
            </div>
          ) : clients.length === 1 ? (
            // Single client — show as static badge
            <div className="inline-flex items-center gap-2.5 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 shadow-card">
              <Building2 className="w-4 h-4 text-[#C4A96D]" />
              <span className="text-[13px] font-semibold text-[#0F172A]">{selectedClient?.name}</span>
              <span className="text-[11px] font-mono text-[#94A3B8]">{selectedClient?.tenantId.slice(0, 8)}…</span>
            </div>
          ) : (
            // Multi-client — dropdown picker
            <div className="relative inline-block">
              <button
                onClick={() => setClientDropdown(s => !s)}
                className="inline-flex items-center gap-2.5 bg-white border border-[#E2E8F0] rounded-xl
                           px-4 py-2.5 shadow-card hover:border-[#CBD5E1] transition"
              >
                <Building2 className="w-4 h-4 text-[#C4A96D]" />
                <span className="text-[13px] font-semibold text-[#0F172A]">
                  {selectedClient?.name ?? 'Select client…'}
                </span>
                {selectedClient && (
                  <span className="text-[11px] font-mono text-[#94A3B8]">
                    {selectedClient.tenantId.slice(0, 8)}…
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              </button>

              {clientDropdown && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-[#E2E8F0]
                                rounded-xl shadow-lg overflow-hidden min-w-[260px]">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedClient(c); setClientDropdown(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] transition
                                  ${c.id === selectedClient?.id ? 'bg-[#F8FAFC]' : ''}`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#0F172A] truncate">{c.name}</p>
                        <p className="text-[11px] font-mono text-[#94A3B8] truncate">{c.tenantId}</p>
                      </div>
                      {c.id === selectedClient?.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Framework grid */}
      {loading ? (
        <div className="flex items-center justify-center py-32 text-[#94A3B8]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading frameworks…</span>
        </div>
      ) : (
        <>
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-3">
            Compliance Frameworks
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {frameworks.map(fw => {
              const accent      = FRAMEWORK_ACCENT[fw.id] ?? '#64748B'
              const icon        = FRAMEWORK_ICONS[fw.id] ?? '📋'
              const isLaunching = launching === fw.id
              const disabled    = !fw.implemented || !selectedClient

              return (
                <div
                  key={fw.id}
                  className={`relative bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col
                              shadow-card
                              ${disabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:border-[#CBD5E1] hover:shadow-card-hover transition-all'
                              }`}
                  onClick={() => !disabled && handleRun(fw)}
                >
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />

                  <div className="pl-5 pr-5 pt-5 pb-4">
                    {!fw.implemented && (
                      <div className="absolute top-3.5 right-3.5">
                        <span className="text-[10px] font-medium bg-[#F3F4F6] text-[#94A3B8] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Coming soon
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xl leading-none mt-0.5">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[#0F172A] text-[14px] leading-snug">{fw.name}</h3>
                        {fw.version && (
                          <span className="text-[11px] text-[#94A3B8] font-mono">{fw.version}</span>
                        )}
                      </div>
                    </div>
                    {fw.description && (
                      <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">{fw.description}</p>
                    )}
                  </div>

                  <div className="mt-auto px-5 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                      <span><strong className="text-[#64748B]">{fw.controlCount}</strong> controls</span>
                    </div>
                    {fw.implemented && (
                      <div className="flex items-center gap-0.5 text-xs font-semibold text-[#0F172A]">
                        {isLaunching ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</>
                        ) : (
                          <>Run <ChevronRight className="w-3.5 h-3.5" /></>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Info note */}
      <div className="mt-8 bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-start gap-3 shadow-card">
        <Shield className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
        <p className="text-xs text-[#64748B] leading-relaxed">
          <strong className="text-[#0F172A]">Assessment note:</strong>{' '}
          Assessments query Microsoft Graph in real-time against the selected client tenant.
          Each framework typically takes 30–120 seconds depending on tenant size and permissions.
        </p>
      </div>
    </div>
  )
}
