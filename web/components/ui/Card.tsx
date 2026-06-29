import { cn } from '@/lib/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the Attio multi-layer shadow for elevated/hero cards. */
  raised?: boolean
  /** Default inner padding (p-5). Set false for custom layouts. */
  padded?: boolean
}

export function Card({ raised = false, padded = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-lg',
        raised && 'shadow-card',
        padded && 'p-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 px-5 py-3.5 border-b border-border-subtle', className)}
      {...props}
    >
      {children}
    </div>
  )
}
