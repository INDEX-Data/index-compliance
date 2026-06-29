import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Default is `secondary` (neutral). `primary` is the orange brand action —
// use it sparingly: one per view (the locked direction reserves orange for the
// brand mark and the primary action only).
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-active ring-[color:var(--brand)]',
  secondary:
    'bg-surface text-ink border border-border hover:bg-surface-sunken active:bg-surface-sunken ring-[color:var(--text-ink)]',
  ghost: 'text-muted hover:bg-surface-sunken hover:text-ink ring-[color:var(--text-ink)]',
  danger: 'bg-fail text-white hover:opacity-90 ring-[color:var(--status-fail)]',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-md select-none',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-offset-2 ring-offset-[color:var(--surface-card)]',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
