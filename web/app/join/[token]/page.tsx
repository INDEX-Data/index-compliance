'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertCircle,
  Users,
  Loader2,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import Image from 'next/image'
import { createClientSupabase } from '@/lib/supabase'
import { getTeamJoinInfo, acceptTeamInvite } from '@/lib/api'

type Phase =
  | 'loading' // fetching invite info
  | 'sign-in' // unauthenticated — show sign-in form
  | 'ready' // authenticated + invite valid — show accept button
  | 'accepting' // POST in flight
  | 'done' // accepted successfully
  | 'already' // already a member
  | 'error' // expired / revoked / not found

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params.token === 'string' ? params.token : ''
  const supabase = createClientSupabase()

  const [phase, setPhase] = useState<Phase>('loading')
  const [inviteEmail, setInviteEmail] = useState('')
  const [errMsg, setErrMsg] = useState('')

  // Auth state
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)

  // Sign-in form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Check auth state on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user)
      setIsLoaded(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch invite info once auth state is loaded
  useEffect(() => {
    if (!isLoaded || !token) return
    getTeamJoinInfo(token)
      .then((info) => {
        if (info.alreadyAccepted) {
          setPhase('already')
          return
        }
        setInviteEmail(info.email)
        setPhase(isSignedIn ? 'ready' : 'sign-in')
      })
      .catch((e) => {
        setErrMsg(e.message ?? 'This invite link is invalid or has expired.')
        setPhase('error')
      })
  }, [isLoaded, isSignedIn, token])

  // After sign-in, move to ready if invite still valid
  useEffect(() => {
    if (phase === 'sign-in' && isSignedIn) setPhase('ready')
  }, [isSignedIn, phase])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError(error.message)
      }
      // onAuthStateChange will flip isSignedIn → triggers phase change
    } catch {
      setAuthError('Sign in failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleAccept() {
    setPhase('accepting')
    try {
      // Supabase auth is cookie-based — no explicit token needed.
      // acceptTeamInvite will use the session cookie automatically.
      const result = await acceptTeamInvite(token)
      setPhase(result.alreadyAccepted ? 'already' : 'done')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to accept invite.')
      setPhase('error')
    }
  }

  // ── Layout wrapper ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/atlas-logo.svg"
            alt="Atlas"
            width={160}
            height={64}
            className="h-10 w-auto"
          />
        </div>

        {/* Card */}
        {phase === 'loading' && (
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 text-center">
            <Loader2 className="w-8 h-8 text-faint animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted">Loading invite…</p>
          </div>
        )}

        {phase === 'sign-in' && (
          <div className="bg-surface rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="px-8 pt-8 pb-4 text-center border-b border-border">
              <div className="w-12 h-12 rounded-full bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center mx-auto mb-4">
                <Users className="w-5 h-5 text-[#0369A1]" />
              </div>
              <h1 className="text-xl font-bold text-ink">You've been invited</h1>
              {inviteEmail && (
                <p className="text-sm text-muted mt-1">
                  This invite was sent to <strong className="text-ink">{inviteEmail}</strong>
                </p>
              )}
              <p className="text-sm text-muted mt-1">Sign in to accept and get access.</p>
            </div>
            <form onSubmit={handleSignIn} className="p-6 space-y-4">
              {authError && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2.5 text-sm text-[#B91C1C]">
                  {authError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f] focus:border-transparent"
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1c1d1f] focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 text-sm font-semibold text-white bg-ink rounded-xl hover:bg-ink disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
            <p className="text-sm text-faint text-center px-6 pb-6">
              Don&apos;t have an account?{' '}
              <a href="/sign-up" className="text-ink font-medium hover:underline">
                Sign up
              </a>
            </p>
          </div>
        )}

        {(phase === 'ready' || phase === 'accepting') && (
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center mx-auto mb-5">
              <Users className="w-6 h-6 text-[#0369A1]" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Join as a team member</h1>
            <p className="text-sm text-muted mb-6">
              You'll get read and write access to all clients managed by the person who sent this
              invite.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              disabled={phase === 'accepting'}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-ink rounded-xl hover:bg-ink active:bg-[#0c0a09] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {phase === 'accepting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Accepting…
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" /> Accept Invite
                </>
              )}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-[#15803D]" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">You're in!</h1>
            <p className="text-sm text-muted mb-6">
              You now have access to your team's clients. Head to the dashboard to get started.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-ink rounded-xl hover:bg-ink transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'already' && (
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-[#15803D]" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Already a member</h1>
            <p className="text-sm text-muted mb-6">
              You're already part of this team. Head to the dashboard to get started.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-ink rounded-xl hover:bg-ink transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#FFF1F2] border border-[#FECDD3] flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-[#BE123C]" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Invite unavailable</h1>
            <p className="text-sm text-muted mb-2">
              {errMsg || 'This invite link is invalid or has expired.'}
            </p>
            <p className="text-xs text-faint">Ask your team admin to send a new invite.</p>
          </div>
        )}
      </div>
    </div>
  )
}
