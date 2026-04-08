'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClientSupabase } from '@/lib/supabase'

const INACTIVITY_TIMEOUT = 60 * 60 * 1000 // 1 hour in ms
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

export function InactivityGuard() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const signOut = useCallback(async () => {
    const supabase = createClientSupabase()
    await supabase.auth.signOut()
    window.location.href = '/sign-in?reason=inactivity'
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(signOut, INACTIVITY_TIMEOUT)
  }, [signOut])

  useEffect(() => {
    // Start the initial timer
    resetTimer()

    // Reset on any user activity
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [resetTimer])

  return null
}
