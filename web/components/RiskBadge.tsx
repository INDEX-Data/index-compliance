import type { RiskScore } from '@/lib/types'

const cfg: Record<RiskScore, { label: string; dot: string; cls: string }> = {
  low:      { label: 'Low Risk',      dot: '#15803D', cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
  medium:   { label: 'Medium Risk',   dot: '#B45309', cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
  high:     { label: 'High Risk',     dot: '#C2410C', cls: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]' },
  critical: { label: 'Critical Risk', dot: '#B91C1C', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
}

export function RiskBadge({ score }: { score: RiskScore }) {
  const { label, dot, cls } = cfg[score] ?? cfg.critical
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
      {label}
    </span>
  )
}
