import { FileCheck } from 'lucide-react'

export default function EvidencePage() {
  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="flex items-center gap-2.5 mb-1.5">
        <FileCheck className="w-5 h-5 text-faint" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Evidence</h1>
      </div>
      <p className="text-sm text-muted leading-relaxed">
        Collected evidence and attestations, audit-ready for export. This view is coming online
        next.
      </p>
    </div>
  )
}
