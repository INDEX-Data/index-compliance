'use client'

/**
 * Silently keeps the module-level Clerk token in web/lib/api.ts up to date.
 * Renders nothing — include once in the root layout inside <ClerkProvider>.
 * Refreshes every 50 s (Clerk tokens are valid for 60 s).
 */

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { setClerkToken } from '@/lib/api'

export function ClerkTokenSync() {
  const { getToken } = useAuth()

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const token = await getToken()
        if (!cancelled) setClerkToken(token)
      } catch {
        // not signed in yet — ignore
      }
    }

    refresh()
    const id = setInterval(refresh, 50_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [getToken])

  return null
}
