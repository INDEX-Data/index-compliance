'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getProfile } from '@/lib/api'

export function ProfileGuard() {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't check on the welcome or onboarding pages themselves
    if (pathname === '/welcome' || pathname === '/onboarding') return
    getProfile().catch(() => {
      router.replace('/welcome')
    })
  }, [pathname, router])

  return null
}
