'use client'

import { useState, useEffect } from 'react'
import { Search, Bell, HelpCircle, Sparkles } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { useCopilot } from '@/contexts/CopilotContext'

function CopilotButton() {
  const { isOpen, toggle } = useCopilot()
  return (
    <button
      onClick={toggle}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
        isOpen
          ? 'bg-[#1c1917] text-white'
          : 'text-[#78716c] hover:text-[#1c1917] hover:bg-[#f3f4f6]'
      }`}
    >
      <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.5} />
    </button>
  )
}

export function TopNavbar() {
  const [initials, setInitials] = useState('U')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClientSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata
        const name = meta?.full_name ?? meta?.name ?? session.user.email?.split('@')[0] ?? ''
        setInitials((name[0] ?? 'U').toUpperCase())
        if (meta?.avatar_url) setAvatarUrl(meta.avatar_url)
      }
    })
  }, [])

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-8 z-10"
      style={{
        background: 'rgba(247,249,251,0.80)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #f5f5f4',
      }}
    >
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a8a29e]" strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search compliance data..."
          className="w-full bg-white border border-[#e7e5e4] text-[13px] text-[#1c1d1f] pl-10 pr-4 h-9 rounded-lg
                     placeholder-[#a8a29e] outline-none focus:border-[#1c1917] focus:ring-1 focus:ring-[#1c1917]/20
                     transition-colors"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f3f4f6] transition-colors">
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f3f4f6] transition-colors">
          <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>
        <CopilotButton />
        <div className="ml-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-8 h-8 rounded-lg object-cover border border-[#e7e5e4]"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#d6d3d1] flex items-center justify-center text-[12px] font-bold text-[#1c1917]">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
