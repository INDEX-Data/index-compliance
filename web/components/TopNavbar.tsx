'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, HelpCircle, Sparkles, Settings, LogOut, BookOpen, MessageSquare, ExternalLink } from 'lucide-react'
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
      title="Atlas Copilot"
    >
      <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.5} />
    </button>
  )
}

function NotificationsButton() {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(s => !s)}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f3f4f6] transition-colors"
        title="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#e7e5e4] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f5f5f4]">
            <p className="text-[13px] font-semibold text-[#1c1917]">Notifications</p>
          </div>
          <div className="px-4 py-8 flex flex-col items-center text-center">
            <Bell className="w-8 h-8 text-[#d6d3d1] mb-2" strokeWidth={1.5} />
            <p className="text-[13px] text-[#78716c]">No notifications yet</p>
            <p className="text-[11px] text-[#a8a29e] mt-1">Assessment alerts and updates will appear here.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function HelpButton() {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { toggle: toggleCopilot } = useCopilot()

  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show])

  const items = [
    { icon: MessageSquare, label: 'Ask Atlas Copilot', onClick: () => { setShow(false); toggleCopilot() } },
    { icon: BookOpen, label: 'Documentation', href: 'https://learn.microsoft.com/en-us/graph/overview', external: true },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(s => !s)}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#f3f4f6] transition-colors"
        title="Help & resources"
      >
        <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.5} />
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#e7e5e4] rounded-xl shadow-lg z-50 overflow-hidden py-1">
          {items.map(item => (
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                onClick={() => setShow(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#44403c] hover:bg-[#f5f5f4] transition-colors"
              >
                <item.icon className="w-4 h-4 text-[#78716c]" strokeWidth={1.5} />
                {item.label}
                {item.external && <ExternalLink className="w-3 h-3 text-[#a8a29e] ml-auto" strokeWidth={1.5} />}
              </a>
            ) : (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#44403c] hover:bg-[#f5f5f4] transition-colors"
              >
                <item.icon className="w-4 h-4 text-[#78716c]" strokeWidth={1.5} />
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [initials, setInitials] = useState('U')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClientSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata
        const name = meta?.full_name ?? meta?.name ?? session.user.email?.split('@')[0] ?? ''
        setDisplayName(name)
        setEmail(session.user.email ?? '')
        setInitials((name[0] ?? 'U').toUpperCase())
        if (meta?.avatar_url) setAvatarUrl(meta.avatar_url)
      }
    })
  }, [])

  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show])

  const handleSignOut = async () => {
    const supabase = createClientSupabase()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="relative ml-3" ref={ref}>
      <button onClick={() => setShow(s => !s)} className="rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1c1917]/20">
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
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-[#e7e5e4] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f5f5f4]">
            <p className="text-[13px] font-semibold text-[#1c1917] truncate">{displayName}</p>
            <p className="text-[11px] text-[#a8a29e] truncate">{email}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { setShow(false); router.push('/settings') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#44403c] hover:bg-[#f5f5f4] transition-colors"
            >
              <Settings className="w-4 h-4 text-[#78716c]" strokeWidth={1.5} />
              Settings
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#9f403d] hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopNavbar() {
  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-8 z-10 bg-surface/80 border-b border-border-subtle"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search compliance data..."
          className="w-full bg-canvas border border-border text-[13px] text-ink pl-10 pr-4 h-9 rounded-md
                     placeholder:text-faint outline-none focus:border-border-strong focus:ring-2 focus:ring-[color:var(--text-ink)]/10
                     transition-colors"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <NotificationsButton />
        <HelpButton />
        <CopilotButton />
        <UserMenu />
      </div>
    </header>
  )
}
