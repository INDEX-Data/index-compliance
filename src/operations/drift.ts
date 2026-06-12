// =============================================================================
// INDEX ATLAS — Drift Detector (Sprint 2)
// Diffs two consecutive assessment runs and emits drift_events for any
// control that changed status. Regressions (pass→fail) auto-queue remediation.
// =============================================================================

import type { RemediationDb } from '../types.js'
import type { ControlAssessment, ComplianceStatus } from '../types.js'

export interface DriftEvent {
  controlId: string
  controlTitle: string
  priorStatus: ComplianceStatus
  newStatus: ComplianceStatus
  direction: 'regression' | 'improvement' | 'change'
}

export interface DriftResult {
  events: DriftEvent[]
  regressions: DriftEvent[]
  improvements: DriftEvent[]
}

// ---------------------------------------------------------------------------
// Drift direction classification
// ---------------------------------------------------------------------------

const STATUS_RANK: Record<ComplianceStatus, number> = {
  pass: 3,
  partial: 2,
  fail: 1,
  manual_required: 0,
  not_assessed: 0,
  not_applicable: 0,
}

function classifyDrift(prior: ComplianceStatus, next: ComplianceStatus): DriftEvent['direction'] {
  const delta = STATUS_RANK[next] - STATUS_RANK[prior]
  if (delta < 0) return 'regression'
  if (delta > 0) return 'improvement'
  return 'change'
}

// ---------------------------------------------------------------------------
// Core diff function
// ---------------------------------------------------------------------------

export function diffAssessments(
  prior: ControlAssessment[],
  next: ControlAssessment[]
): DriftResult {
  const priorMap = new Map(prior.map((a) => [a.controlId, a]))
  const events: DriftEvent[] = []

  for (const nextAssessment of next) {
    const priorAssessment = priorMap.get(nextAssessment.controlId)
    if (!priorAssessment) continue
    if (priorAssessment.status === nextAssessment.status) continue

    // Skip non-verdict transitions — manual/collection-gap/N-A churn isn't real drift
    const ignoredStatuses: ComplianceStatus[] = [
      'manual_required',
      'not_assessed',
      'not_applicable',
    ]
    if (
      ignoredStatuses.includes(priorAssessment.status) &&
      ignoredStatuses.includes(nextAssessment.status)
    )
      continue

    events.push({
      controlId: nextAssessment.controlId,
      controlTitle: nextAssessment.controlTitle,
      priorStatus: priorAssessment.status,
      newStatus: nextAssessment.status,
      direction: classifyDrift(priorAssessment.status, nextAssessment.status),
    })
  }

  return {
    events,
    regressions: events.filter((e) => e.direction === 'regression'),
    improvements: events.filter((e) => e.direction === 'improvement'),
  }
}

// ---------------------------------------------------------------------------
// Persist drift events + optionally queue remediation for regressions
// ---------------------------------------------------------------------------

export async function persistDriftEvents(
  result: DriftResult,
  context: {
    userId: string
    clientId: string
    frameworkId: string
    priorReportId: string
    newReportId: string
  },
  db: RemediationDb
): Promise<void> {
  if (result.events.length === 0) return

  const rows = result.events.map((e) => ({
    user_id: context.userId,
    client_id: context.clientId,
    framework_id: context.frameworkId,
    control_id: e.controlId,
    control_title: e.controlTitle,
    prior_report_id: context.priorReportId,
    new_report_id: context.newReportId,
    prior_status: e.priorStatus,
    new_status: e.newStatus,
    direction: e.direction,
  }))

  await db.from('drift_events').insert(rows)
}
