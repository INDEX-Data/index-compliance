'use client'

import { useEffect, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'

const STORAGE_KEY = 'index_onboarding_shown'

const CREDENTIALS = [
  {
    label: 'Directory (Tenant) ID',
    desc:  "Your M365 organization's unique directory identifier",
    where: 'Azure AD → Properties → Tenant ID',
  },
  {
    label: 'Application (Client) ID',
    desc:  'The app registration that will query Microsoft Graph',
    where: 'App Registrations → Your App → Overview',
  },
  {
    label: 'Client Secret',
    desc:  'Secret value (not the ID) used to authenticate the app',
    where: 'App → Certificates & Secrets → New client secret',
  },
]

export function WelcomeModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, '1')
        setVisible(true)
      }
    } catch {
      // localStorage unavailable (SSR, private mode) — skip
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) setVisible(false) }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-[#141412] px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Welcome to INDEX</span>
            </div>
            <p className="text-white/50 text-sm">
              Here&apos;s what you&apos;ll need to connect your first client
            </p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-white/30 hover:text-white/70 transition mt-0.5 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-[#6B7280] mb-4 leading-relaxed">
            To connect a Microsoft 365 tenant you need an{' '}
            <strong className="text-[#18181B]">Azure App Registration</strong> with these three values:
          </p>

          {/* Credential checklist */}
          <div className="space-y-2.5 mb-5">
            {CREDENTIALS.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-[#F7F5F1] border border-[#E9E5DD] rounded-xl px-4 py-3"
              >
                <span className="w-5 h-5 rounded-full bg-[#141412] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#18181B]">{item.label}</div>
                  <div className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{item.desc}</div>
                  <div className="text-[11px] text-[#9CA3AF] font-mono mt-1.5">📍 {item.where}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Azure Portal link */}
          <a
            href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full border border-[#E9E5DD] rounded-xl px-4 py-2.5
                       text-sm font-medium text-[#374151] hover:bg-[#F7F5F1] transition mb-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Azure App Registrations
          </a>

          {/* CTA */}
          <button
            onClick={() => setVisible(false)}
            className="w-full bg-[#141412] hover:bg-[#27272A] text-white rounded-xl px-4 py-2.5
                       text-sm font-semibold transition"
          >
            Got it — let&apos;s go →
          </button>
        </div>

      </div>
    </div>
  )
}
