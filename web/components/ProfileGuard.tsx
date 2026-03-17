'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { getProfile, setClerkToken, ApiError } from '@/lib/api'

export function ProfileGuard() {
  const router   = useRouter()
  const pathname = usePathname()
  const { isLoaded, isSignedIn, getToken } = useAuth()

  useEffect(() => {
    // Don't check on the welcome or onboarding pages themselves
    if (pathname === '/welcome' || pathname === '/onboarding') return
    // Wait for Clerk to finish initialising — avoids 401 race condition
    if (!isLoaded || !isSignedIn) return

    // Ensure the module-level token is current before calling getProfile()
    getToken()
      .then((token) => {
        setClerkToken(token)
        return getProfile()
      })
      .catch((err) => {
        // Only redirect when the profile genuinely doesn't exist (404).
        // Other errors (500, network timeout, etc.) are ignored so that a
        // transient server blip doesn't boot the user to /welcome.
        if (err instanceof ApiError && err.status === 404) {
          router.replace('/welcome')
        }
      })
  }, [pathname, router, isLoaded, isSignedIn, getToken])

  return null
}
