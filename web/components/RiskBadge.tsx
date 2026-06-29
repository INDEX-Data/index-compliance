import type { RiskScore } from '@/lib/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'

// Risk level → semantic tone (token-driven; no inline hex).
const MAP: Record<RiskScore, { label: string; tone: BadgeTone }> = {
  low: { label: 'Low Risk', tone: 'pass' },
  medium: { label: 'Medium Risk', tone: 'warn' },
  high: { label: 'High Risk', tone: 'warn' },
  critical: { label: 'Critical Risk', tone: 'fail' },
}

export function RiskBadge({ score }: { score: RiskScore }) {
  const { label, tone } = MAP[score] ?? MAP.critical
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}
