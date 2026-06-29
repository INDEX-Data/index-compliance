import { Wrench } from 'lucide-react'

export default function RemediationPage() {
  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Wrench className="w-5 h-5 text-faint" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Remediation</h1>
      </div>
      <p className="text-sm text-muted leading-relaxed">
        Track drafted and applied fixes, with approvals and rollback. This view is coming online
        next.
      </p>
    </div>
  )
}
