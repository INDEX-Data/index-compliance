import type { ComplianceStatus } from '@/lib/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'

// Compliance status → semantic tone (token-driven; no inline hex).
const MAP: Record<ComplianceStatus, { label: string; tone: BadgeTone }> = {
  pass: { label: 'Pass', tone: 'pass' },
  partial: { label: 'Partial', tone: 'warn' },
  fail: { label: 'Fail', tone: 'fail' },
  manual_required: { label: 'Manual', tone: 'info' },
  not_assessed: { label: 'Not Assessed', tone: 'neutral' },
  not_applicable: { label: 'N/A', tone: 'neutral' },
}

interface Props {
  status: ComplianceStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { label, tone } = MAP[status] ?? MAP.not_assessed
  return (
    <Badge tone={tone} size={size} dot>
      {label}
    </Badge>
  )
}
