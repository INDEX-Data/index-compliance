// =============================================================================
// INDEX ATLAS — Maturity Tracker (Sprint 2)
// Records one maturity_snapshot per assessment run and queries the time series.
// =============================================================================

import type { RemediationDb } from '../types.js'
import type { ComplianceSummary } from '../types.js'

export interface MaturitySnapshot {
  id: string
  clientId: string
  frameworkId: string
  reportId: string
  compliancePercentage: number
  passed: number
  failed: number
  partial: number
  notAssessed: number
  /** May be null for snapshots recorded before migration 005. */
  manualRequired: number | null
  automatedCoverage: number | null
  collectionHealth: number | null
  totalControls: number
  riskScore: string
  snapshottedAt: string
}

// ---------------------------------------------------------------------------
// Write a snapshot for a completed assessment
// ---------------------------------------------------------------------------

export async function recordMaturitySnapshot(
  context: {
    userId: string
    clientId: string
    frameworkId: string
    reportId: string
    summary: ComplianceSummary
  },
  db: RemediationDb
): Promise<void> {
  await db.from('maturity_snapshots').insert({
    user_id: context.userId,
    client_id: context.clientId,
    framework_id: context.frameworkId,
    report_id: context.reportId,
    compliance_percentage: Math.round(context.summary.compliancePercentage),
    passed: context.summary.passed,
    failed: context.summary.failed,
    partial: context.summary.partial,
    not_assessed: context.summary.notAssessed,
    manual_required: context.summary.manualRequired,
    automated_coverage: context.summary.automatedCoverage,
    collection_health: context.summary.collectionHealth,
    total_controls: context.summary.totalControls,
    risk_score: context.summary.riskScore,
    snapshotted_at: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Query the maturity time series for a client + framework
// ---------------------------------------------------------------------------

export async function getMaturityTimeSeries(
  clientId: string,
  frameworkId: string,
  userId: string,
  db: RemediationDb,
  limit = 24
): Promise<MaturitySnapshot[]> {
  const { data, error } = await db
    .from('maturity_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .eq('framework_id', frameworkId)
    .eq('user_id', userId)
    .order('snapshotted_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    clientId: row.client_id as string,
    frameworkId: row.framework_id as string,
    reportId: row.report_id as string,
    compliancePercentage: row.compliance_percentage as number,
    passed: row.passed as number,
    failed: row.failed as number,
    partial: row.partial as number,
    notAssessed: row.not_assessed as number,
    manualRequired: (row.manual_required as number) ?? null,
    automatedCoverage: (row.automated_coverage as number) ?? null,
    collectionHealth: (row.collection_health as number) ?? null,
    totalControls: row.total_controls as number,
    riskScore: row.risk_score as string,
    snapshottedAt: row.snapshotted_at as string,
  }))
}

// ---------------------------------------------------------------------------
// Query all frameworks for a client (summary view)
// ---------------------------------------------------------------------------

export async function getClientMaturitySummary(
  clientId: string,
  userId: string,
  db: RemediationDb
): Promise<Record<string, MaturitySnapshot | null>> {
  const { data, error } = await db
    .from('maturity_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .order('snapshotted_at', { ascending: false })

  if (error || !data) return {}

  // Keep only the latest snapshot per framework
  const latest: Record<string, MaturitySnapshot> = {}
  for (const row of data as Record<string, unknown>[]) {
    const fwId = row.framework_id as string
    if (!latest[fwId]) {
      latest[fwId] = {
        id: row.id as string,
        clientId: row.client_id as string,
        frameworkId: fwId,
        reportId: row.report_id as string,
        compliancePercentage: row.compliance_percentage as number,
        passed: row.passed as number,
        failed: row.failed as number,
        partial: row.partial as number,
        notAssessed: row.not_assessed as number,
        manualRequired: (row.manual_required as number) ?? null,
        automatedCoverage: (row.automated_coverage as number) ?? null,
        collectionHealth: (row.collection_health as number) ?? null,
        totalControls: row.total_controls as number,
        riskScore: row.risk_score as string,
        snapshottedAt: row.snapshotted_at as string,
      }
    }
  }
  return latest
}
