'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser, useAuth, SignIn } from '@clerk/nextjs'
import { CheckCircle2, AlertCircle, Users, Loader2, ArrowRight } from 'lucide-react'
import { getTeamJoinInfo, acceptTeamInvite } from '@/lib/api'

type Phase =
  | 'loading'      // fetching invite info
  | 'sign-in'      // unauthenticated — show Clerk sign-in
  | 'ready'        // authenticated + invite valid — show accept button
  | 'accepting'    // POST in flight
  | 'done'         // accepted successfully
  | 'already'      // already a member
  | 'error'        // expired / revoked / not found

export default function JoinPage() {
  const params    = useParams()
  const router    = useRouter()
  const token     = typeof params.token === 'string' ? params.token : ''
  const { isLoaded, isSignedIn } = useUser()
  const { getToken } = useAuth()

  const [phase,    setPhase]    = useState<Phase>('loading')
  const [inviteEmail, setInviteEmail] = useState('')
  const [errMsg,   setErrMsg]   = useState('')

  // Fetch invite info once Clerk is loaded
  useEffect(() => {
    if (!isLoaded || !token) return
    getTeamJoinInfo(token)
      .then(info => {
        if (info.alreadyAccepted) { setPhase('already'); return }
        setInviteEmail(info.email)
        setPhase(isSignedIn ? 'ready' : 'sign-in')
      })
      .catch(e => {
        setErrMsg(e.message ?? 'This invite link is invalid or has expired.')
        setPhase('error')
      })
  }, [isLoaded, isSignedIn, token])

  // After sign-in, move to ready if invite still valid
  useEffect(() => {
    if (phase === 'sign-in' && isSignedIn) setPhase('ready')
  }, [isSignedIn, phase])

  async function handleAccept() {
    setPhase('accepting')
    try {
      // Fetch a fresh Clerk token directly — the module-level token in api.ts
      // may not be set yet on the join page (ClerkTokenSync runs only in the
      // (app) layout). Passing it explicitly avoids a "Sign in" 401.
      const authToken = await getToken()
      const result = await acceptTeamInvite(token, authToken)
      setPhase(result.alreadyAccepted ? 'already' : 'done')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to accept invite.')
      setPhase('error')
    }
  }

  // ── Layout wrapper ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] flex items-center justify-center">
              <span className="text-[#D4A843] text-xs font-black tracking-wider">IX</span>
            </div>
            <span className="text-lg font-bold text-[#0A0A0A] tracking-tight">INDEX</span>
          </div>
        </div>

        {/* Card */}
        {phase === 'loading' && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-xl p-8 text-center">
            <Loader2 className="w-8 h-8 text-[#999999] animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#555555]">Loading invite…</p>
          </div>
        )}

        {phase === 'sign-in' && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-xl overflow-hidden">
            <div className="px-8 pt-8 pb-4 text-center border-b border-[#E8E8E8]">
              <div className="w-12 h-12 rounded-full bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center mx-auto mb-4">
                <Users className="w-5 h-5 text-[#0369A1]" />
              </div>
              <h1 className="text-xl font-bold text-[#0A0A0A]">You've been invited</h1>
              {inviteEmail && (
                <p className="text-sm text-[#555555] mt-1">
                  This invite was sent to <strong className="text-[#0A0A0A]">{inviteEmail}</strong>
                </p>
              )}
              <p className="text-sm text-[#555555] mt-1">Sign in to accept and get access.</p>
            </div>
            <div className="p-4">
              <SignIn
                routing="hash"
                forceRedirectUrl={`/join/${token}`}
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none border-0 p-0',
                  },
                }}
              />
            </div>
          </div>
        )}

        {(phase === 'ready' || phase === 'accepting') && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center mx-auto mb-5">
              <Users className="w-6 h-6 text-[#0369A1]" />
            </div>
            <h1 className="text-xl font-bold text-[#0A0A0A] mb-2">Join as a team member</h1>
            <p className="text-sm text-[#555555] mb-6">
              You'll get read and write access to all clients managed by the person who sent this invite.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              disabled={phase === 'accepting'}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-[#0A0A0A] rounded-xl hover:bg-[#111111] active:bg-[#1A1A1A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {phase === 'accepting'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
                : <><Users className="w-4 h-4" /> Accept Invite</>
              }
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-[#15803D]" />
            </div>
            <h1 className="text-xl font-bold text-[#0A0A0A] mb-2">You're in!</h1>
            <p className="text-sm text-[#555555] mb-6">
              You now have access to your team's clients. Head to the dashboard to get started.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-[#0A0A0A] rounded-xl hover:bg-[#111111] transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'already' && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-[#15803D]" />
            </div>
            <h1 className="text-xl font-bold text-[#0A0A0A] mb-2">Already a member</h1>
            <p className="text-sm text-[#555555] mb-6">
              You're already part of this team. Head to the dashboard to get started.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 px-6 text-sm font-semibold text-white bg-[#0A0A0A] rounded-xl hover:bg-[#111111] transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#FFF1F2] border border-[#FECDD3] flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-[#BE123C]" />
            </div>
            <h1 className="text-xl font-bold text-[#0A0A0A] mb-2">Invite unavailable</h1>
            <p className="text-sm text-[#555555] mb-2">{errMsg || 'This invite link is invalid or has expired.'}</p>
            <p className="text-xs text-[#999999]">Ask your team admin to send a new invite.</p>
          </div>
        )}

      </div>
    </div>
  )
}
