'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientSupabase } from '@/lib/supabase'

const FRAMEWORKS = [
  { name: 'CMMC Level 2',  desc: '110 practices' },
  { name: 'NIST 800-171',  desc: '110 controls'  },
  { name: 'HIPAA',         desc: '45 CFR §164'   },
  { name: 'FINRA',         desc: 'Rule 4370'      },
  { name: 'FERPA',         desc: 'Student privacy' },
]

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    const supabase = createClientSupabase()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setEmailSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — dark branding ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] shrink-0 flex-col bg-[#1c1d1f] text-white px-10 py-12">

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

      {/* ── Right panel — Sign up form ──────────────────────────────── */}
      <div className="flex-1 bg-[#fafafa] flex flex-col items-center justify-center px-8 py-12">

        {/* Mobile logo (hidden on lg+) */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1c1d1f]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#1c1d1f] tracking-widest uppercase">INDEX</div>
            <div className="text-[10px] text-[#6f7988] leading-none tracking-wide uppercase">Compliance</div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {emailSent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-[#15803D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1c1d1f] mb-2">Check your email</h1>
              <p className="text-sm text-[#6f7988] mb-6">
                We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
              </p>
              <Link href="/sign-in" className="text-sm text-[#1c1d1f] font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[#1c1d1f] mb-1">Create your account</h1>
              <p className="text-sm text-[#6f7988] mb-6">
                Start assessing your Microsoft 365 compliance
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#1c1d1f] mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white border border-[#e4e7ec] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 focus:border-[#1c1d1f]"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#1c1d1f] mb-1">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white border border-[#e4e7ec] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 focus:border-[#1c1d1f]"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1c1d1f] mb-1">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white border border-[#e4e7ec] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 focus:border-[#1c1d1f]"
                    placeholder="Confirm your password"
                  />
                </div>

                {error && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-sm text-[#B91C1C]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1c1d1f] text-white text-sm font-semibold py-2.5 rounded-lg transition hover:bg-[#2d2e30] disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </form>

              <p className="text-sm text-[#6f7988] text-center mt-6">
                Already have an account?{' '}
                <Link href="/sign-in" className="text-[#1c1d1f] font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
