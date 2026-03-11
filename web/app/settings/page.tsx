'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, CheckCircle2, Building2, Users } from 'lucide-react'
import { getConfigStatus } from '@/lib/api'

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
