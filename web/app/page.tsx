import Link from 'next/link'
import { ShieldCheck, ArrowRight } from 'lucide-react'

const FRAMEWORKS = [
  { name: 'CMMC Level 2',  tag: '110 practices',   desc: 'DoD supply chain' },
  { name: 'NIST 800-171',  tag: '110 controls',    desc: 'Federal contractors' },
  { name: 'HIPAA',         tag: '45 CFR §164',     desc: 'Healthcare' },
  { name: 'FINRA',         tag: 'Rule 4370',        desc: 'Financial services' },
  { name: 'FERPA',         tag: 'Student privacy',  desc: 'Education' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F1] flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#141412] border-b border-[#252521]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#F7F5F1]">
              <ShieldCheck className="w-4 h-4 text-[#141412]" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#F5F4EF] tracking-widest uppercase leading-none">INDEX</div>
              <div className="text-[9px] text-[#5A5A52] tracking-wide uppercase leading-none mt-0.5">Compliance</div>
            </div>
          </div>

          {/* Nav links */}
          <Link
            href="/sign-in"
            className="text-sm font-medium text-[#A09F92] hover:text-[#F5F4EF] transition flex items-center gap-1.5"
          >
            Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white border border-[#E9E5DD] rounded-full px-3.5 py-1.5 mb-8 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C4A96D]" />
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest">
            Powered by Microsoft Graph API
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl font-bold text-[#141412] tracking-tight leading-[1.08] mb-5 max-w-2xl">
          Compliance visibility<br />
          <span className="text-[#C4A96D]">for Microsoft 365</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg text-[#6B7280] leading-relaxed max-w-lg mb-10">
          Automated security assessments across your M365 tenant.
          Identify gaps, track progress, and export audit-ready reports.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[#141412] hover:bg-[#27272A] text-white
                       text-sm font-semibold px-6 py-3 rounded-xl transition shadow-sm"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 bg-white hover:bg-[#F0EDE6] text-[#374151]
                       text-sm font-semibold px-6 py-3 rounded-xl border border-[#E9E5DD] transition"
          >
            Sign In
          </Link>
        </div>

        {/* ── Framework grid ───────────────────────────────────── */}
        <div className="mt-16 w-full max-w-2xl">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-widest mb-5">
            Supported Frameworks
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {FRAMEWORKS.map(f => (
              <div
                key={f.name}
                className="bg-white border border-[#E9E5DD] rounded-xl px-4 py-3.5 text-left shadow-sm"
              >
                <div className="text-[13px] font-semibold text-[#18181B]">{f.name}</div>
                <div className="text-[11px] text-[#9CA3AF] mt-0.5">{f.tag}</div>
                <div className="text-[10px] text-[#C4BFB5] mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[#E9E5DD] py-5 px-6 text-center">
        <p className="text-[11px] text-[#C4BFB5]">
          © {new Date().getFullYear()} INDEX Compliance · Microsoft Graph API
        </p>
      </footer>

    </div>
  )
}
