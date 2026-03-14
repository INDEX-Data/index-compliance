'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShieldCheck, LayoutDashboard, Play, Clock,
  Building2, Plug, Settings, ChevronDown,
  Plus, ChevronsLeft, ChevronsRight,
  UserCog, HelpCircle,
} from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'
import { getClients, getConfigStatus } from '@/lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_KEY = 'idx:sidebar:collapsed'

/** Single-key shortcuts shown on nav item hover */
const SHORTCUTS: Record<string, string> = {
  '/dashboard':    'D',
  '/assess':       'A',
  '/history':      'H',
  '/clients':      'C',
  '/integrations': 'I',
  '/settings':     'S',
}

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { href: '/assess',       label: 'Assess',       icon: Play },
      { href: '/history',      label: 'History',      icon: Clock },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/clients',      label: 'Clients',      icon: Building2 },
      { href: '/integrations', label: 'Integrations', icon: Plug },
    ],
  },
]

// ─── Tooltip — dark, shown to the right in collapsed mode ────────────────────

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip w-full flex justify-center">
      {children}
      <div
        className="
          pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[999]
          opacity-0 group-hover/tip:opacity-100 transition-opacity duration-75 delay-300
        "
      >
        <div className="bg-[#111111] border border-[#2a2a2a] text-white text-[11px]
                        font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
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
      className={[
        'group/nav relative flex items-center rounded-[7px]',
        'select-none outline-none',
        collapsed
          ? 'w-8 h-8 justify-center mx-auto'
          : 'gap-2.5 px-2.5 py-[7px] w-full',
        active
          ? 'bg-[#F0F0F0] text-[#0A0A0A]'
          : 'text-[#888888] hover:bg-[#F7F7F7] hover:text-[#333333]',
      ].join(' ')}
    >
      {/* Gold left accent */}
      {active && !collapsed && (
        <span className="absolute left-0 top-[5px] bottom-[5px] w-[2.5px] rounded-r-full bg-[#C4A96D]" />
      )}

      <Icon
        className={[
          'shrink-0',
          collapsed ? 'w-[15px] h-[15px]' : 'w-[14px] h-[14px]',
          active ? 'text-[#C4A96D]' : 'text-current',
        ].join(' ')}
      />

      {!collapsed && (
        <>
          <span className="flex-1 text-[12.5px] font-semibold tracking-[-0.01em] leading-none">
            {label}
          </span>

          {/* Live badge count */}
          {badge != null && badge > 0 && (
            <span
              className={[
                'text-[10px] font-bold tabular-nums rounded-full px-[6px] py-[2px] leading-none',
                active
                  ? 'bg-[#E3E3E3] text-[#444444]'
                  : 'bg-[#F0F0F0] text-[#AAAAAA] group-hover/nav:bg-[#EBEBEB] group-hover/nav:text-[#666666]',
              ].join(' ')}
            >
              {badge}
            </span>
          )}

          {/* Keyboard shortcut hint */}
          {shortcut && (badge == null || badge === 0) && (
            <kbd className="text-[10px] font-mono text-[#DDDDDD] leading-none
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

function WorkspaceMenu({ orgName, onClose }: { orgName: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handle) }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="
        absolute top-[calc(100%+4px)] left-0 right-0 z-[999]
        bg-white border border-[#E8E8E8] rounded-xl shadow-card-hover overflow-hidden
      "
    >
      {/* Org header */}
      <div className="px-3.5 py-3 border-b border-[#F3F3F3]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#C4A96D]/10 border border-[#C4A96D]/25
                          flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C4A96D]" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#0A0A0A] truncate leading-none">{orgName}</p>
            <span className="inline-block mt-1.5 text-[9px] font-extrabold uppercase tracking-widest
                             text-[#C4A96D] bg-[#C4A96D]/10 px-1.5 py-[2px] rounded-full leading-none">
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
            className="flex items-center gap-2.5 px-3.5 py-[7px]
                       text-[12px] font-medium text-[#666666]
                       hover:text-[#0A0A0A] hover:bg-[#F7F7F7]"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const path = usePathname()
  const { user } = useUser()

  const [collapsed,    setCollapsed]    = useState(false)
  const [hydrated,     setHydrated]     = useState(false)
  const [wsOpen,       setWsOpen]       = useState(false)
  const [clientCount,  setClientCount]  = useState<number | null>(null)
  const [orgName,      setOrgName]      = useState('INDEX')

  // Restore collapsed state after hydration (avoids SSR flash)
  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    if (saved === 'true') setCollapsed(true)
    setHydrated(true)
  }, [])

  // Fetch live data
  useEffect(() => {
    getClients()
      .then(c => setClientCount(c.length))
      .catch(() => {})
    getConfigStatus()
      .then(s => { if (s.tenantName) setOrgName(s.tenantName) })
      .catch(() => {})
  }, [])

  const toggleCollapsed = useCallback(() => {
    setWsOpen(false)
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSED_KEY, String(next))
  }, [collapsed])

  const isActive = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' : path.startsWith(href)

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ?? 'Account'

  // Prevent layout flash while reading localStorage
  if (!hydrated) {
    return <aside className="w-[240px] shrink-0 bg-white border-r border-[#E8E8E8] h-screen" />
  }

  return (
    <aside
      className={[
        'relative flex flex-col shrink-0 h-screen',
        'bg-white border-r border-[#E8E8E8]',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        collapsed ? 'w-[56px]' : 'w-[240px]',
      ].join(' ')}
    >

      {/* ── Workspace switcher ──────────────────────────────────────────────── */}
      <div className="relative px-2 pt-3 pb-2">
        {collapsed ? (
          <Tip label={orgName}>
            <button
              onClick={() => setWsOpen(s => !s)}
              className="w-8 h-8 rounded-[7px] flex items-center justify-center mx-auto
                         hover:bg-[#F7F7F7]"
            >
              <ShieldCheck className="w-[15px] h-[15px] text-[#C4A96D]" />
            </button>
          </Tip>
        ) : (
          <button
            onClick={() => setWsOpen(s => !s)}
            className={[
              'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[8px]',
              wsOpen ? 'bg-[#F7F7F7]' : 'hover:bg-[#F7F7F7]',
            ].join(' ')}
          >
            <div className="w-7 h-7 rounded-lg bg-[#C4A96D]/10 border border-[#C4A96D]/25
                            flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C4A96D]" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] font-bold text-[#0A0A0A] truncate leading-none">{orgName}</p>
              <p className="text-[10px] text-[#BBBBBB] mt-[5px] leading-none">MSP Platform</p>
            </div>
            <ChevronDown
              className={[
                'w-3.5 h-3.5 text-[#CCCCCC] shrink-0 transition-transform duration-150',
                wsOpen ? 'rotate-180' : '',
              ].join(' ')}
            />
          </button>
        )}

        {wsOpen && <WorkspaceMenu orgName={orgName} onClose={() => setWsOpen(false)} />}
      </div>

      {/* ── New Assessment CTA ──────────────────────────────────────────────── */}
      <div className={['px-2 pb-3', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed ? (
          <Tip label="New Assessment">
            <Link
              href="/assess"
              className="w-8 h-8 rounded-[7px] flex items-center justify-center mx-auto
                         bg-[#0A0A0A] hover:bg-[#222222] text-white"
            >
              <Plus className="w-3.5 h-3.5" />
            </Link>
          </Tip>
        ) : (
          <Link
            href="/assess"
            className="flex items-center justify-center gap-2 w-full py-[7px] rounded-[8px]
                       bg-[#0A0A0A] hover:bg-[#222222]
                       text-white text-[12px] font-bold tracking-[-0.01em]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Assessment
          </Link>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div className="mx-2 mb-3 h-px bg-[#F3F3F3]" />

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll px-2 space-y-4 pb-2">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#CCCCCC]">
                {section.label}
              </p>
            )}
            <div className="space-y-[2px]">
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
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle ──────────────────────────────────────────────────── */}
      <div className={['px-2 pb-1', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed ? (
          <Tip label="Expand sidebar">
            <button
              onClick={toggleCollapsed}
              className="w-8 h-8 rounded-[7px] flex items-center justify-center mx-auto
                         text-[#CCCCCC] hover:text-[#888888] hover:bg-[#F7F7F7]"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </Tip>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-2 w-full px-2.5 py-[6px] rounded-[7px]
                       text-[#CCCCCC] hover:text-[#888888] hover:bg-[#F7F7F7]"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Collapse</span>
          </button>
        )}
      </div>

      {/* ── Settings + user ──────────────────────────────────────────────────── */}
      <div className="border-t border-[#F3F3F3] pt-2 pb-3 px-2 space-y-[2px]">
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
          active={isActive('/settings')}
          collapsed={collapsed}
        />

        <div
          className={[
            'flex items-center gap-2.5 mt-1',
            collapsed ? 'justify-center pt-1' : 'px-2.5 pt-1',
          ].join(' ')}
        >
          <UserButton
            appearance={{ elements: { avatarBox: 'w-6 h-6' } }}
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-semibold text-[#333333] truncate leading-none">
                {displayName}
              </p>
              <p className="text-[9.5px] text-[#BBBBBB] mt-[5px] leading-none">MSP Platform</p>
            </div>
          )}
        </div>
      </div>

    </aside>
  )
}
