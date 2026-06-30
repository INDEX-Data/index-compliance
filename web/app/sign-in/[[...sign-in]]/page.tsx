'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClientSupabase } from '@/lib/supabase'

const FRAMEWORKS = [
  { name: 'CMMC Level 2', desc: '110 practices' },
  { name: 'NIST 800-171', desc: '110 controls' },
  { name: 'HIPAA', desc: '45 CFR §164' },
  { name: 'FINRA', desc: 'Rule 4370' },
  { name: 'FERPA', desc: 'Student privacy' },
]

interface LastUser {
  name: string
  email: string
  avatar?: string
}

const LAST_USER_KEY = 'atlas_last_user'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inactivityLogout = searchParams.get('reason') === 'inactivity'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Returning user recognition
  const [lastUser, setLastUser] = useState<LastUser | null>(null)
  const [recognized, setRecognized] = useState(true) // true = show returning user state if lastUser exists

  // On mount: check localStorage for returning user
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_USER_KEY)
      if (stored) {
        const parsed: LastUser = JSON.parse(stored)
        if (parsed.email) {
          setLastUser(parsed)
          setEmail(parsed.email)
        }
      }
    } catch {
      // Invalid data — ignore
    }
  }, [])

  function handleNotYou() {
    localStorage.removeItem(LAST_USER_KEY)
    setLastUser(null)
    setRecognized(false)
    setEmail('')
    setPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClientSupabase()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Store user info in localStorage for returning user recognition
    if (data.user) {
      const meta = data.user.user_metadata
      const name = meta?.full_name ?? meta?.name ?? data.user.email?.split('@')[0] ?? ''
      const stored: LastUser = {
        name,
        email: data.user.email ?? email,
        avatar: meta?.avatar_url,
      }
      try {
        localStorage.setItem(LAST_USER_KEY, JSON.stringify(stored))
      } catch {}
    }

    router.push('/dashboard')
    router.refresh()
  }

  const showReturning = lastUser && recognized
  const firstName = lastUser?.name?.split(' ')[0] ?? ''
  const initials = (firstName[0] ?? 'U').toUpperCase()

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — dark branding ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] shrink-0 flex-col bg-ink text-on-accent px-10 py-12">
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/atlas-logo.svg"
            alt="Atlas"
            width={160}
            height={64}
            className="h-10 w-auto invert"
          />
        </div>

        {/* Value prop */}
        <div className="mt-auto mb-auto py-16">
          <h2 className="text-3xl font-bold leading-snug tracking-tight mb-3">
            Compliance visibility
            <br />
            for Microsoft 365
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-10">
            Automated security assessments across your M365 tenant. Identify gaps, track progress,
            export audit-ready reports.
          </p>

          {/* Framework list */}
          <div className="space-y-2">
            {FRAMEWORKS.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between bg-surface/5 border border-white/8 rounded-lg px-3.5 py-2.5"
              >
                <span className="text-sm font-medium text-white/90">{f.name}</span>
                <span className="text-[11px] text-white/35">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-[11px] text-white/25 mt-auto">Powered by Microsoft Graph API</div>
      </div>

      {/* ── Right panel — Sign in form ──────────────────────────────── */}
      <div className="flex-1 bg-canvas flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo (hidden on lg+) */}
        <div className="flex items-center mb-8 lg:hidden">
          <Image
            src="/atlas-logo.svg"
            alt="Atlas"
            width={160}
            height={64}
            className="h-10 w-auto"
          />
        </div>

        <div className="w-full max-w-sm">
          {/* Returning user header */}
          {showReturning ? (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                {lastUser.avatar ? (
                  <img
                    src={lastUser.avatar}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-[16px] font-bold text-white">
                    {initials}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-ink">Welcome back, {firstName}</h1>
                  <p className="text-sm text-faint">{lastUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleNotYou}
                className="text-[13px] text-faint hover:text-ink underline underline-offset-2 transition-colors"
              >
                Not {firstName}?
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-ink mb-1">Welcome back</h1>
              <p className="text-sm text-faint mb-6">Sign in to your account to continue</p>
            </>
          )}

          {inactivityLogout && (
            <div className="bg-[#FEF9C3] border border-[#FDE68A] rounded-lg px-3 py-2 text-sm text-[#92400E] mb-4">
              You were signed out due to inactivity. Please sign in again.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email — hidden when returning user recognized, shown with pre-fill */}
            {!showReturning && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 focus:border-[#1c1d1f]"
                  placeholder="you@company.com"
                />
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus={!!showReturning}
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f]/20 focus:border-[#1c1d1f]"
                placeholder="Enter your password"
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
              className="w-full bg-ink text-on-accent text-sm font-semibold py-2.5 rounded-lg transition hover:bg-ink disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-faint text-center mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-ink font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
