import type { ComplianceStatus } from '@/lib/types'

const cfg: Record<ComplianceStatus, { label: string; dot: string; cls: string }> = {
  pass:           { label: 'Pass',         dot: '#15803D', cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
  partial:        { label: 'Partial',      dot: '#B45309', cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
  fail:           { label: 'Fail',         dot: '#B91C1C', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
  not_assessed:   { label: 'Not Assessed', dot: '#94A3B8', cls: 'bg-[#F9FAFB] text-[#64748B] border-[#E5E7EB]' },
  not_applicable: { label: 'N/A',          dot: '#CBD5E1', cls: 'bg-[#F9FAFB] text-[#94A3B8] border-[#F3F4F6]' },
}

interface Props {
  status: ComplianceStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { label, dot, cls } = cfg[status] ?? cfg.not_assessed
  const padCls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${cls} ${padCls}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
      {label}
    </span>
  )
}
