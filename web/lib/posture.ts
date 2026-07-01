// =============================================================================
// INDEX ATLAS — Posture aggregation (pure, serializable)
//
// Extracted from the dashboard page so BOTH the (legacy) dashboard and the
// agent's render_artifact(posture) path share one aggregation. Returns plain
// JSON (no React) so it can be computed server-side and streamed to the client
// as an artifact, where ArtifactRenderer adapts it into PostureView's props.
// =============================================================================

import { FRAMEWORK_CATALOG } from '@/lib/framework-catalog'
import type { ComplianceSummary } from '@/lib/types'

export interface PostureReportInput {
  frameworkId: string
  generatedAt: string
  summary: ComplianceSummary
}

export interface PostureArtifactData {
  score: number
  status: string
  statusTone: 'pass' | 'warn' | 'fail'
  controls: number
  openFindings: number
  needsReview: number
  frameworkNames: string[]
  frameworkCount: number
  syncedLabel: string
  topFinding?: { title: string; frameworkName?: string }
}

export function frameworkName(id: string): string {
  const norm = id.toLowerCase().replace(/_/g, '-')
  return FRAMEWORK_CATALOG.find((f) => f.id === norm)?.name ?? id
}

export function relativeDate(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

/**
 * Aggregate the latest report per framework into a single posture snapshot.
 * Returns null when there are no reports (caller renders an empty/connect state).
 */
export function buildPostureArtifact(reports: PostureReportInput[]): PostureArtifactData | null {
  if (!reports || reports.length === 0) return null

  // Latest report per framework.
  const byFramework: Record<string, PostureReportInput[]> = {}
  for (const r of reports) (byFramework[r.frameworkId] ??= []).push(r)
  const latest = Object.values(byFramework).map(
    (arr) =>
      arr
        .slice()
        .sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime())
        .at(-1)!
  )
  if (latest.length === 0) return null

  const totals = latest.reduce(
    (a, r) => ({
      passed: a.passed + (r.summary.passed ?? 0),
      failed: a.failed + (r.summary.failed ?? 0),
      partial: a.partial + (r.summary.partial ?? 0),
      manual: a.manual + (r.summary.manualRequired ?? 0),
      notAssessed: a.notAssessed + (r.summary.notAssessed ?? 0),
    }),
    { passed: 0, failed: 0, partial: 0, manual: 0, notAssessed: 0 }
  )
  const controls =
    totals.passed + totals.failed + totals.partial + totals.manual + totals.notAssessed
  const score = Math.round(
    latest.reduce((s, r) => s + (r.summary.compliancePercentage ?? 0), 0) / latest.length
  )
  const statusTone: 'pass' | 'warn' | 'fail' = score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail'
  const status = score >= 80 ? 'Secure' : score >= 50 ? 'Needs attention' : 'At risk'

  const mostRecent = latest
    .slice()
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0]

  const topFindings = mostRecent.summary.topFindings
  const topFinding =
    topFindings && topFindings.length > 0
      ? { title: topFindings[0], frameworkName: frameworkName(mostRecent.frameworkId) }
      : undefined

  return {
    score,
    status,
    statusTone,
    controls,
    openFindings: totals.failed,
    needsReview: totals.partial,
    frameworkNames: latest.map((r) => frameworkName(r.frameworkId)),
    frameworkCount: latest.length,
    syncedLabel: `assessed ${relativeDate(mostRecent.generatedAt)}`,
    topFinding,
  }
}
