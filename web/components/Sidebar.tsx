'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShieldCheck, AlertTriangle, Wrench, Waves, FileCheck, FileText,
  Plug, Layers, Sparkles, ChevronDown,
  Plus, UserCog, HelpCircle, LogOut,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase'
import { getClients, getConfigStatus, getProfile } from '@/lib/api'
import { useCopilot } from '@/contexts/CopilotContext'
import type { UserProfile } from '@/lib/types'

// Audit-centric information architecture (the locked direction's nav).
const NAV_SECTIONS = [
  {
    label: 'The Audit',
    items: [
      { href: '/dashboard', label: 'Posture', icon: ShieldCheck },
      { href: '/findings', label: 'Findings', icon: AlertTriangle },
      { href: '/remediation', label: 'Remediation', icon: Wrench },
      { href: '/drift', label: 'Drift', icon: Waves },
      { href: '/evidence', label: 'Evidence', icon: FileCheck },
      { href: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    label: 'Setup',
    items: [
      { href: '/clients', label: 'Connections', icon: Plug },
      { href: '/assess', label: 'Frameworks', icon: Layers },
    ],
  },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_KEY = 'idx:sidebar:collapsed'

// Decorative hover hints (no global handler wired). Empty until keybindings exist.
const SHORTCUTS: Record<string, string> = {}

// ─── Tooltip (dark, right-side, collapsed mode only) ─────────────────────────

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip w-full flex justify-center">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-[999]
                      opacity-0 group-hover/tip:opacity-100 transition-opacity delay-300 duration-75">
        <div className="bg-[#1c1d1f] text-[#f3f4f6] text-[12px] font-medium
                        px-2.5 py-1.5 rounded-[8px] shadow-lg whitespace-nowrap
                        border border-[#2e3238]/60">
          {label}
        </div>
      </div>
    </div>
  )
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  collapsed: boolean
  badge?: number | null
}

function NavItem({ href, label, icon: Icon, active, collapsed, badge }: NavItemProps) {
  const shortcut = SHORTCUTS[href]

  const inner = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'group/nav relative flex items-center gap-3 rounded-md select-none outline-none',
        collapsed ? 'w-9 h-9 justify-center mx-auto' : 'h-10 px-3 w-full',
        active
          ? 'bg-[color:var(--rail-active-bg)] text-white font-medium'
          : 'text-rail-text hover:bg-rail-raised hover:text-white',
        'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-white/25',
      ].join(' ')}
    >
      <Icon
        className={['shrink-0 w-[18px] h-[18px]', active ? 'text-white' : 'text-rail-faint'].join(' ')}
        strokeWidth={1.6}
      />

      {!collapsed && (
        <>
          <span className="flex-1 text-[13px] leading-none tracking-tight">{label}</span>

          {badge != null && badge > 0 && (
            <span className={[
              'text-[10.5px] font-medium tabular-nums rounded-full px-[7px] py-[3px] leading-none font-mono',
              active ? 'bg-white/15 text-white' : 'bg-rail-raised text-rail-faint group-hover/nav:bg-rail-border',
            ].join(' ')}>
              {badge}
            </span>
          )}

          {shortcut && (badge == null || badge === 0) && (
            <kbd className="text-[10.5px] font-mono text-rail-faint leading-none
                            opacity-0 group-hover/nav:opacity-100 transition-opacity duration-100">
              {shortcut}
            </kbd>
          )}
        </>
      )}
    </Link>
  )

  if (collapsed) return <Tip label={label}>{inner}</Tip>
  return inner
}

// ─── Workspace dropdown ───────────────────────────────────────────────────────

function WorkspaceMenu({ orgName, onClose, toggleRef }: { orgName: string; onClose: () => void; toggleRef?: React.RefObject<HTMLElement | null> }) {
  const ref      = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const handleSignOut = async () => {
    const supabase = createClientSupabase()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current && !ref.current.contains(target) &&
          !(toggleRef?.current && toggleRef.current.contains(target))) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handle) }
  }, [onClose, toggleRef])

  return (
    <div
      ref={ref}
      className="absolute top-[calc(100%+4px)] left-0 right-0 z-[999]
                 bg-white border border-[#e7e5e4] rounded-[10px] overflow-hidden
                 shadow-[0_4px_16px_0_rgba(28,29,31,0.08),0_1px_4px_0_rgba(28,29,31,0.04)]"
    >
      {/* Org identity */}
      <div className="px-3 py-2.5 border-b border-[#f5f5f4]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[#1c1917]/10 border border-[#1c1917]/20
                          flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1c1917]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1c1d1f] truncate leading-none" style={{ letterSpacing: '-0.01em' }}>
              {orgName}
            </p>
            <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest
                             text-[#1c1917] bg-[#1c1917]/10 px-1.5 py-[2px] rounded-full leading-none">
              MSP PRO
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <nav className="py-1.5">
        {[
          { label: 'Invite Team Member', href: '/settings?tab=team', icon: Plus },
          { label: 'Workspace Settings', href: '/settings',          icon: UserCog },
          { label: 'Help & Support',     href: '#',                  icon: HelpCircle },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-[6px]
                       text-[13px] font-medium text-[#505967]
                       hover:text-[#1c1d1f] hover:bg-[#f3f4f6]
                       transition-colors duration-300 hover:duration-50"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Sign out — separated */}
      <div className="border-t border-[#f5f5f4] py-1.5">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-[6px]
                     text-[13px] font-medium text-[#e5484d]
                     hover:bg-red-50
                     transition-colors duration-300 hover:duration-50"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const path     = usePathname()
  const router   = useRouter()
  const { toggle: toggleCopilot } = useCopilot()

  const [supaUser,    setSupaUser]    = useState<{ id: string; email?: string } | null>(null)
  const [collapsed,   setCollapsed]   = useState(false)
  const [hydrated,    setHydrated]    = useState(false)
  const [wsOpen,      setWsOpen]      = useState(false)
  const brandRef = useRef<HTMLDivElement>(null)
  const [clientCount, setClientCount] = useState<number | null>(null)
  const [orgName,     setOrgName]     = useState('Atlas')
  const [profile,     setProfile]     = useState<UserProfile | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    if (saved === 'true') setCollapsed(true)
    setHydrated(true)

    // Get Supabase user from session (no network call)
    const supabase = createClientSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setSupaUser({ id: session.user.id, email: session.user.email ?? undefined })
    })
  }, [])

  useEffect(() => {
    getClients()
      .then(c => setClientCount(c.length))
      .catch(() => {})
    getConfigStatus()
      .then(s => { if (s.tenantName) setOrgName(s.tenantName) })
      .catch(() => {})
    getProfile().then(setProfile).catch(() => {})
  }, [])

  const toggleCollapsed = useCallback(() => {
    setWsOpen(false)
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSED_KEY, String(next))
  }, [collapsed])

  const isActive = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' : path.startsWith(href)

  const displayName = profile?.companyName
    ?? supaUser?.email?.split('@')[0]
    ?? 'Account'

  // Prevent SSR flash
  if (!hydrated) {
    return <aside className="w-[256px] shrink-0 h-screen bg-rail border-r border-rail-border" />
  }

  return (
    <aside
      className="relative flex flex-col shrink-0 h-screen overflow-hidden bg-rail border-r border-rail-border transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 64 : 256 }}
    >

      {/* ── Brand mark (dark-safe: orange square + wordmark) ── */}
      <div ref={brandRef} className={`relative pt-5 mb-5 ${collapsed ? 'px-3' : 'px-4'}`}>
        <button
          onClick={() => setWsOpen(s => !s)}
          className={`group w-full flex items-center rounded-md hover:bg-rail-raised transition-colors
                      ${collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-2 py-1.5'}`}
        >
          <span className="w-7 h-7 rounded-md bg-brand flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2} />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-[15px] font-semibold text-white tracking-[-0.01em]">ATLAS</span>
              <ChevronDown className={`w-3.5 h-3.5 text-rail-faint transition-transform ${wsOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {wsOpen && <WorkspaceMenu orgName={profile?.companyName ?? orgName} onClose={() => setWsOpen(false)} toggleRef={brandRef} />}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll px-3 pb-4 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="space-y-1">
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-rail-faint">
                {section.label}
              </div>
            )}
            {section.items.map(item => (
              <NavItem
                key={item.href}
                {...item}
                active={isActive(item.href)}
                collapsed={collapsed}
                badge={item.href === '/clients' ? clientCount : null}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Bottom: Ask your environment (Copilot launcher) ── */}
      <div className="mt-auto px-3 pb-5">
        <button
          onClick={toggleCopilot}
          aria-label="Ask your environment"
          className={`group w-full flex items-center rounded-md border border-rail-border
                      text-rail-text hover:bg-rail-raised hover:text-white transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25
                      ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'}`}
        >
          <Sparkles className="w-[18px] h-[18px] text-rail-faint shrink-0 group-hover:text-white" strokeWidth={1.6} />
          {!collapsed && <span className="text-[13px] leading-tight text-left">Ask your environment</span>}
        </button>
      </div>

    </aside>
  )
}
