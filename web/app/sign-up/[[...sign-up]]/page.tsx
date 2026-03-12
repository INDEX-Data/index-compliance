import { SignUp } from '@clerk/nextjs'

const FRAMEWORKS = [
  { name: 'CMMC Level 2',  desc: '110 practices' },
  { name: 'NIST 800-171',  desc: '110 controls'  },
  { name: 'HIPAA',         desc: '45 CFR §164'   },
  { name: 'FINRA',         desc: 'Rule 4370'      },
  { name: 'FERPA',         desc: 'Student privacy' },
]

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — dark branding ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] shrink-0 flex-col bg-[#141412] text-white px-10 py-12">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/10">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-widest uppercase">INDEX</div>
            <div className="text-[10px] text-white/40 leading-none tracking-wide uppercase">Compliance</div>
          </div>
        </div>

        {/* Value prop */}
        <div className="mt-auto mb-auto py-16">
          <h2 className="text-3xl font-bold leading-snug tracking-tight mb-3">
            Compliance visibility<br />for Microsoft 365
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-10">
            Automated security assessments across your M365 tenant.
            Identify gaps, track progress, export audit-ready reports.
          </p>

          {/* Framework list */}
          <div className="space-y-2">
            {FRAMEWORKS.map(f => (
              <div
                key={f.name}
                className="flex items-center justify-between bg-white/5 border border-white/8 rounded-lg px-3.5 py-2.5"
              >
                <span className="text-sm font-medium text-white/90">{f.name}</span>
                <span className="text-[11px] text-white/35">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-[11px] text-white/25 mt-auto">
          Powered by Microsoft Graph API
        </div>
      </div>

      {/* ── Right panel — Clerk form ────────────────────────────────── */}
      <div className="flex-1 bg-[#F7F5F1] flex flex-col items-center justify-center px-8 py-12">

        {/* Mobile logo (hidden on lg+) */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#141412]">
            <svg className="w-5 h-5 text-[#F7F5F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#141412] tracking-widest uppercase">INDEX</div>
            <div className="text-[10px] text-[#5A5A52] leading-none tracking-wide uppercase">Compliance</div>
          </div>
        </div>

        <SignUp />
      </div>

    </div>
  )
}
