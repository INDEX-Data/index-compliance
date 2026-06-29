import { cn } from '@/lib/cn'

export interface SectionHeaderProps {
  children: React.ReactNode
  /** Optional numbered governance motif, e.g. "01". */
  index?: string
  className?: string
  right?: React.ReactNode
}

export function SectionHeader({ children, index, right, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 mb-2.5', className)}>
      {index && (
        <span className="font-mono text-[11px] text-faint tracking-tight">/{index}</span>
      )}
      <span className="text-[11.5px] uppercase tracking-[0.06em] text-faint font-medium">
        {children}
      </span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  )
}
