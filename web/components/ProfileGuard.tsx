'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getProfile } from '@/lib/api'
import { ApiError } from '@/lib/api'

export function ProfileGuard() {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't check on the welcome or onboarding pages themselves
    if (pathname === '/welcome' || pathname === '/onboarding') return

    getProfile().catch((err) => {
      // Only redirect to /welcome when the profile genuinely doesn't exist (404).
      // For any other error (network timeout, 500, 401, etc.) we leave the user
      // where they are — we don't want a transient server blip to kick them out.
      if (err instanceof ApiError && err.status === 404) {
        router.replace('/welcome')
      }
    })
  }, [pathname, router])

  return null
}
