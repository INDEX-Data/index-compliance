'use client'

import { useEffect, useRef, useState } from 'react'
import { Sun, Moon, Clock, Check } from 'lucide-react'

type Mode = 'light' | 'dark' | 'auto'
const KEY = 'atlas-theme'

function isAutoDark() {
  const h = new Date().getHours()
  return h >= 19 || h < 7
}

// Light-first: an unset preference resolves to light, not auto.
const DEFAULT_MODE: Mode = 'light'

function apply(mode: Mode) {
  const dark = mode === 'dark' || (mode === 'auto' && isAutoDark())
  document.documentElement.classList.toggle('dark', dark)
}

const OPTIONS: { mode: Mode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'auto', label: 'Auto (time of day)', icon: Clock },
]

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Mode | null) ?? DEFAULT_MODE
    setMode(saved)
    apply(saved)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function choose(m: Mode) {
    setMode(m)
    localStorage.setItem(KEY, m)
    apply(m)
    setOpen(false)
  }

  // Icon reflects the effective theme.
  const effectiveDark = mode === 'dark' || (mode === 'auto' && isAutoDark())
  const TriggerIcon = effectiveDark ? Moon : Sun

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-faint hover:text-ink hover:bg-surface-sunken transition-colors"
        title="Theme"
        aria-label="Theme"
      >
        <TriggerIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-xl shadow-float z-50 overflow-hidden py-1">
          {OPTIONS.map(({ mode: m, label, icon: Icon }) => (
            <button
              key={m}
              onClick={() => choose(m)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-muted hover:bg-surface-sunken hover:text-ink transition-colors"
            >
              <Icon className="w-4 h-4 text-faint" strokeWidth={1.5} />
              {label}
              {mode === m && <Check className="w-3.5 h-3.5 text-ink ml-auto" strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
