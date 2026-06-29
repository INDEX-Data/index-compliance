import { Waves } from 'lucide-react'

export default function DriftPage() {
  return (
    <div className="px-8 py-10 max-w-2xl">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Waves className="w-5 h-5 text-faint" strokeWidth={1.7} />
        <h1 className="text-xl font-semibold text-ink tracking-[-0.01em]">Drift</h1>
      </div>
      <p className="text-sm text-muted leading-relaxed">
        Configuration drift between assessments — regressions, improvements, and changes over time.
        This view is coming online next.
      </p>
    </div>
  )
}
