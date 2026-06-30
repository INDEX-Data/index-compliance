import type { ComplianceStatus } from '@/lib/types'
import { cn } from '@/lib/cn'

// Quiet, Cursor-style status: a dot + colored text — no filled pill.
const MAP: Record<ComplianceStatus, { label: string; cls: string; dot: string }> = {
  pass: { label: 'Pass', cls: 'text-pass', dot: 'bg-pass' },
  partial: { label: 'Partial', cls: 'text-warn', dot: 'bg-warn' },
  fail: { label: 'Fail', cls: 'text-fail', dot: 'bg-fail' },
  manual_required: { label: 'Manual', cls: 'text-muted', dot: 'bg-faint' },
  not_assessed: { label: 'Not Assessed', cls: 'text-faint', dot: 'bg-faint' },
  not_applicable: { label: 'N/A', cls: 'text-faint', dot: 'bg-faint' },
}

interface Props {
  status: ComplianceStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { label, cls, dot } = MAP[status] ?? MAP.not_assessed
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium whitespace-nowrap', cls, size === 'sm' ? 'text-[11px]' : 'text-[12px]')}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} aria-hidden />
      {label}
    </span>
  )
}
