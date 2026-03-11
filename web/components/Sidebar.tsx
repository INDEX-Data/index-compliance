'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck, LayoutDashboard, Play, Clock, Building2, Plug, Settings } from 'lucide-react'

const nav = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/assess',        label: 'Assess',       icon: Play },
  { href: '/history',       label: 'History',      icon: Clock },
  { href: '/clients',       label: 'Clients',      icon: Building2 },
  { href: '/integrations',  label: 'Integrations', icon: Plug },
  { href: '/settings',      label: 'Settings',     icon: Settings },
]

export function Sidebar() {
  const path = usePathname()

  return (
    <aside className="flex flex-col w-52 shrink-0 bg-[#141412] border-r border-[#252521]">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-[#252521]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#F7F5F1]">
          <ShieldCheck className="w-4 h-4 text-[#141412]" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-[#F5F4EF] tracking-widest uppercase">INDEX</div>
          <div className="text-[10px] text-[#5A5A52] leading-none tracking-wide uppercase">Compliance</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto sidebar-scroll">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                group select-none
                ${active
                  ? 'bg-[#1E1E1C] text-[#F5F4EF]'
                  : 'text-[#A09F92] hover:bg-[#1A1A18] hover:text-[#D4D2C9]'
                }
              `}
            >
              {/* Active left bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[#C4A96D]" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#C4A96D]' : ''}`} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#252521]">
        <p className="text-[10px] text-[#3E3E38] font-mono uppercase tracking-wider">v1.0 · DSaaS</p>
      </div>
    </aside>
  )
}
