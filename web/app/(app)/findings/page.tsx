import { AlertTriangle } from 'lucide-react'

export default function FindingsPage() {
  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="flex items-center gap-2.5 mb-1.5">
        <AlertTriangle className="w-5 h-5 text-faint" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Findings</h1>
      </div>
      <p className="text-sm text-muted leading-relaxed">
        Open findings across your frameworks, ranked by severity, with one-click remediation. This
        view is coming online next.
      </p>
    </div>
  )
}
