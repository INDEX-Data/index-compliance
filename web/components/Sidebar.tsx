'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ShieldCheck, LayoutDashboard, Play, Clock,
  Building2, Plug, Settings, ChevronDown,
} from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'

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

interface NavItemProps {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}

function NavItem({ href, label, icon: Icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={[
        'relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium',
        'transition-colors duration-100 select-none',
        active
          ? 'bg-[#1D1D1B] text-[#ECEAE3]'
          : 'text-[#6B6860] hover:bg-[#191917] hover:text-[#A8A49E]',
      ].join(' ')}
    >
      {active && (
        <span className="absolute left-0 inset-y-[5px] w-[3px] rounded-r-full bg-[#C4A96D]" />
      )}
      <Icon className={`w-[15px] h-[15px] shrink-0 ${active ? 'text-[#C4A96D]' : ''}`} />
      <span className="tracking-[-0.01em]">{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const path = usePathname()
  const { user } = useUser()

  const isActive = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' : path.startsWith(href)

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ?? 'Account'

  return (
    <aside className="flex flex-col w-[240px] shrink-0 bg-[#111110] border-r border-[#1D1D1B] h-screen">

      {/* Workspace switcher */}
      <button className="group flex items-center gap-2.5 px-4 py-[13px] border-b border-[#1D1D1B] hover:bg-[#191917] transition-colors w-full text-left">
        <div className="w-7 h-7 rounded-lg bg-[#C4A96D]/10 border border-[#C4A96D]/20 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C4A96D]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#ECEAE3] tracking-tight leading-none">INDEX</p>
          <p className="text-[10px] text-[#3D3D3A] mt-[5px] leading-none">Compliance Platform</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#3D3D3A] group-hover:text-[#6B6860] transition-colors shrink-0" />
      </button>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-2.5 pt-4 pb-2 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#3D3D3A]">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem key={item.href} {...item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings + user footer */}
      <div className="border-t border-[#1D1D1B]">
        <div className="px-2.5 pt-2.5 pb-1">
          <NavItem href="/settings" label="Settings" icon={Settings} active={isActive('/settings')} />
        </div>

        <div className="flex items-center gap-2.5 px-4 pt-2 pb-4">
          <UserButton
            appearance={{ elements: { avatarBox: 'w-7 h-7' } }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-[#A8A49E] truncate leading-none">{displayName}</p>
            <p className="text-[10px] text-[#3D3D3A] mt-[5px] leading-none">MSP Platform</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
