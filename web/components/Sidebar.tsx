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
      className={[
        'group/nav relative flex items-center gap-1.5 rounded-[9px] select-none outline-none',
        /* Attio: 28px height, 8px horizontal padding */
        collapsed
          ? 'w-7 h-7 justify-center mx-auto'
          : 'h-7 px-2 w-full',
        active
          ? 'bg-[#edeff3] text-[#1c1d1f]'
          : 'text-[#505967] hover:bg-[#f3f4f6] hover:text-[#2e3238]',
        /* Attio: fast hover in, instant out */
        'transition-colors duration-300 hover:duration-50',
      ].join(' ')}
    >
      {/* Gold left accent — active only */}
      {active && !collapsed && (
        <span className="absolute left-0 top-[5px] bottom-[5px] w-[2.5px] rounded-r-full bg-[#C4A96D]" />
      )}

      <Icon
        className={[
          'shrink-0',
          collapsed ? 'w-[15px] h-[15px]' : 'w-[14px] h-[14px]',
          active ? 'text-[#C4A96D]' : 'text-current',
        ].join(' ')}
        strokeWidth={1.5}
      />

      {!collapsed && (
        <>
          {/* Attio: 14px, weight 500, tracking -0.28px */}
          <span className="flex-1 text-[13.5px] font-medium leading-none" style={{ letterSpacing: '-0.01em' }}>
            {label}
          </span>

          {badge != null && badge > 0 && (
            <span className={[
              'text-[10px] font-semibold tabular-nums rounded-full px-[6px] py-[2px] leading-none',
              active
                ? 'bg-[#cad0d9]/50 text-[#505967]'
                : 'bg-[#eeeff1] text-[#6f7988] group-hover/nav:bg-[#e4e7ec]',
            ].join(' ')}>
              {badge}
            </span>
          )}

          {shortcut && (badge == null || badge === 0) && (
            <kbd className="text-[10px] font-mono text-[#a4adba] leading-none
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
      className="absolute top-[calc(100%+4px)] left-0 right-0 z-[999]
                 bg-white border border-[#e4e7ec] rounded-[10px] overflow-hidden
                 shadow-[0_4px_16px_0_rgba(28,29,31,0.08),0_1px_4px_0_rgba(28,29,31,0.04)]"
    >
      {/* Org identity */}
      <div className="px-3 py-2.5 border-b border-[#eeeff1]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[#C4A96D]/10 border border-[#C4A96D]/20
                          flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C4A96D]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1c1d1f] truncate leading-none" style={{ letterSpacing: '-0.01em' }}>
              {orgName}
            </p>
            <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest
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
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const path     = usePathname()
  const { user } = useUser()

  const [collapsed,   setCollapsed]   = useState(false)
  const [hydrated,    setHydrated]    = useState(false)
  const [wsOpen,      setWsOpen]      = useState(false)
  const [clientCount, setClientCount] = useState<number | null>(null)
  const [orgName,     setOrgName]     = useState('INDEX')

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    if (saved === 'true') setCollapsed(true)
    setHydrated(true)
  }, [])

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

  // Prevent SSR flash
  if (!hydrated) {
    return (
      <aside
        className="w-[272px] shrink-0 h-screen"
        style={{ background: '#fbfbfb', borderRight: '1px solid #eeeff1' }}
      />
    )
  }

  return (
    <aside
      className={[
        'relative flex flex-col shrink-0 h-screen overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
      ].join(' ')}
      style={{
        width: collapsed ? 56 : 272,
        background: '#fbfbfb',
        borderRight: '1px solid #eeeff1',
      }}
    >

      {/* ── Workspace switcher ── */}
      <div className="relative px-2 pt-3 pb-2">
        {collapsed ? (
          <Tip label={orgName}>
            <button
              onClick={() => setWsOpen(s => !s)}
              className="w-7 h-7 rounded-[9px] flex items-center justify-center mx-auto
                         hover:bg-[#f3f4f6] transition-colors duration-300 hover:duration-50"
            >
              <ShieldCheck className="w-[15px] h-[15px] text-[#C4A96D]" strokeWidth={1.5} />
            </button>
          </Tip>
        ) : (
          <button
            onClick={() => setWsOpen(s => !s)}
            className={[
              'flex items-center gap-2 w-full px-2 h-9 rounded-[9px]',
              'transition-colors duration-300 hover:duration-50',
              wsOpen ? 'bg-[#f3f4f6]' : 'hover:bg-[#f3f4f6]',
            ].join(' ')}
          >
            <div className="w-6 h-6 rounded-[6px] bg-[#C4A96D]/10 border border-[#C4A96D]/20
                            flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3 h-3 text-[#C4A96D]" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-semibold text-[#1c1d1f] truncate leading-none"
                 style={{ letterSpacing: '-0.01em' }}>
                {orgName}
              </p>
            </div>
            <ChevronDown
              className={[
                'w-3.5 h-3.5 text-[#a4adba] shrink-0 transition-transform duration-150',
                wsOpen ? 'rotate-180' : '',
              ].join(' ')}
              strokeWidth={1.5}
            />
          </button>
        )}

        {wsOpen && <WorkspaceMenu orgName={orgName} onClose={() => setWsOpen(false)} />}
      </div>

      {/* ── New Assessment CTA ── */}
      <div className={['px-2 pb-3', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed ? (
          <Tip label="New Assessment">
            <Link
              href="/assess"
              className="w-7 h-7 rounded-[9px] flex items-center justify-center mx-auto
                         text-[#f3f4f6] transition-colors duration-300 hover:duration-50"
              style={{ background: '#202124' }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </Tip>
        ) : (
          <Link
            href="/assess"
            className="flex items-center justify-center gap-1.5 w-full h-8 rounded-[10px]
                       text-[#f3f4f6] text-[13px] font-medium
                       transition-colors duration-300 hover:duration-50"
            style={{
              background: '#202124',
              border: '0.667px solid rgba(80,89,103,0.4)',
              letterSpacing: '-0.01em',
            }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New Assessment
          </Link>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="mx-2 mb-3 h-px" style={{ background: '#eeeff1' }} />

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll px-2 space-y-4 pb-2">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              /* Attio overline: 12px semibold uppercase wide tracking muted */
              <p className="px-2 mb-1 text-[11px] font-semibold uppercase text-[#a4adba]"
                 style={{ letterSpacing: '0.06em' }}>
                {section.label}
              </p>
            )}
            <div className="space-y-[1px]">
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

      {/* ── Collapse toggle ── */}
      <div className={['px-2 pb-1', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed ? (
          <Tip label="Expand sidebar">
            <button
              onClick={toggleCollapsed}
              className="w-7 h-7 rounded-[9px] flex items-center justify-center mx-auto
                         text-[#a4adba] hover:text-[#6f7988] hover:bg-[#f3f4f6]
                         transition-colors duration-300 hover:duration-50"
            >
              <ChevronsRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </Tip>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-1.5 w-full px-2 py-[5px] rounded-[9px]
                       text-[#a4adba] hover:text-[#6f7988] hover:bg-[#f3f4f6]
                       transition-colors duration-300 hover:duration-50"
          >
            <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-[12px] font-medium">Collapse</span>
          </button>
        )}
      </div>

      {/* ── Settings + user row ── */}
      <div className="pt-2 pb-3 px-2 space-y-[1px]" style={{ borderTop: '1px solid #eeeff1' }}>
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
          active={isActive('/settings')}
          collapsed={collapsed}
        />

        <div className={[
          'flex items-center gap-2 mt-1',
          collapsed ? 'justify-center pt-1' : 'px-2 pt-1',
        ].join(' ')}>
          <UserButton appearance={{ elements: { avatarBox: 'w-[22px] h-[22px]' } }} />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-[#2e3238] truncate leading-none"
                 style={{ letterSpacing: '-0.01em' }}>
                {displayName}
              </p>
              <p className="text-[11px] text-[#a4adba] mt-[4px] leading-none">MSP Platform</p>
            </div>
          )}
        </div>
      </div>

    </aside>
  )
}
