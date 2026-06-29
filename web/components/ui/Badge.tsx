import { cn } from '@/lib/cn'

export type BadgeTone = 'pass' | 'warn' | 'fail' | 'info' | 'neutral' | 'brand'

const TONES: Record<BadgeTone, string> = {
  pass: 'bg-pass-bg text-pass border-pass-border',
  warn: 'bg-warn-bg text-warn border-warn-border',
  fail: 'bg-fail-bg text-fail border-fail-border',
  info: 'bg-info-bg text-info border-info-border',
  neutral: 'bg-neutral-bg text-neutral border-neutral-border',
  brand: 'bg-brand-wash text-brand-ink border-transparent',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  /** Show a leading status dot. */
  dot?: boolean
  size?: 'sm' | 'md'
}

export function Badge({
  tone = 'neutral',
  dot = false,
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
