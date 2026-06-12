// =============================================================================
// INDEX ATLAS — Assessment Operations Layer
// Transport-agnostic: called by web routes, MCP tools, and scheduled cron jobs
// =============================================================================

import { assessControl, buildSummary } from '../services/compliance-engine.js'
import { getFramework } from '../data/framework-registry.js'
import { DIBCAC_OBJECTIVES } from '../data/dibcac-objectives.js'
import type { GraphClient } from '../services/graph-client.js'
import type {
  ControlAssessment,
  FullReport,
  ObjectiveStatus,
  ObjectiveStatusValue,
  ObjectiveEvidenceSource,
} from '../types.js'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AssessmentInput {
  /** Accepts both 'cmmc-l2' (web) and 'CMMC_L2' (MCP) — normalized internally */
  frameworkId: string
  graphClient: GraphClient
  clientId?: string
  clientName?: string
  tenantId?: string
}

export interface AssessmentCallbacks {
  onProgress?: (index: number, total: number, controlTitle: string, status: string) => Promise<void>
  onComplete?: (report: FullReport) => Promise<void>
  onError?: (error: Error) => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize 'cmmc-l2' → 'CMMC_L2', 'ai-readiness' → 'AI_READINESS', etc. */
function normalizeFrameworkId(id: string): string {
  return id.toUpperCase().replace(/-/g, '_')
}

function mapControlStatusToObjectiveStatus(
  controlStatus: ControlAssessment['status'],
  objectiveAutomation: string
): { status: ObjectiveStatusValue; evidenceSource: ObjectiveEvidenceSource } {
  if (objectiveAutomation === 'physical') {
    return { status: 'requires_physical', evidenceSource: 'none' }
  }
  if (objectiveAutomation === 'manual') {
    return { status: 'requires_manual', evidenceSource: 'none' }
  }
  switch (controlStatus) {
    case 'pass':
      return { status: 'met', evidenceSource: 'automated_graph' }
    case 'partial':
      return {
        status: objectiveAutomation === 'semi-automated' ? 'partially_met' : 'met',
        evidenceSource: 'automated_graph',
      }
    case 'fail':
      return { status: 'not_met', evidenceSource: 'automated_graph' }
    case 'manual_required':
      return { status: 'requires_manual', evidenceSource: 'none' }
    case 'not_assessed':
    case 'not_applicable':
    default:
      return { status: 'not_assessed', evidenceSource: 'inherited_from_control' }
  }
}

// ---------------------------------------------------------------------------
// Core operation
// ---------------------------------------------------------------------------

export async function runAssessment(
  input: AssessmentInput,
  callbacks?: AssessmentCallbacks
): Promise<FullReport> {
  const normalizedId = normalizeFrameworkId(input.frameworkId)
  const fw = getFramework(normalizedId as any)

  if (!fw || fw.controls.length === 0) {
    const err = new Error(`Framework "${input.frameworkId}" not found or has no controls mapped`)
    await callbacks?.onError?.(err)
    throw err
  }

  const assessments: ControlAssessment[] = []

  try {
    for (let i = 0; i < fw.controls.length; i++) {
      const control = fw.controls[i]
      let assessment: ControlAssessment

      try {
        assessment = await assessControl(control, input.graphClient)
      } catch (err) {
        assessment = {
          controlId: control.controlId,
          controlTitle: control.title,
          frameworkId: control.frameworkId,
          family: control.family,
          status: 'not_assessed',
          evidenceCollected: [],
          findings: [`Error: ${err instanceof Error ? err.message : String(err)}`],
          recommendations: [],
          assessedAt: new Date().toISOString(),
        }
      }

      assessments.push(assessment)
      await callbacks?.onProgress?.(i, fw.controls.length, control.title, assessment.status)
    }

    // Build summary and base report
    const summary = buildSummary(assessments)
    const reportId = `RPT-${Date.now()}`
    const report = {
      reportId,
      tenantId: input.tenantId ?? '',
      tenantDisplayName: input.clientName ?? '',
      frameworkId: fw.id,
      frameworkName: fw.name,
      generatedAt: new Date().toISOString(),
      generatedBy: 'Atlas Compliance Assessment Engine v1.0',
      summary,
      controlAssessments: assessments,
      clientId: input.clientId,
      clientName: input.clientName,
    }

    // Map 320 DIBCAC objectives to control results
    const assessmentMap = new Map<string, ControlAssessment>()
    for (const a of assessments) {
      assessmentMap.set(a.controlId, a)
    }

    const objectiveStatuses: ObjectiveStatus[] = DIBCAC_OBJECTIVES.map((obj) => {
      const controlAssessment = assessmentMap.get(obj.controlId)
      if (!controlAssessment) {
        return {
          objectiveId: obj.objectiveId,
          status:
            obj.automation === 'physical'
              ? ('requires_physical' as const)
              : obj.automation === 'manual'
                ? ('requires_manual' as const)
                : ('not_assessed' as const),
          evidenceSource: 'none' as const,
          assessedAt: new Date().toISOString(),
          assessedBy: 'automated',
        }
      }
      const mapped = mapControlStatusToObjectiveStatus(controlAssessment.status, obj.automation)
      return {
        objectiveId: obj.objectiveId,
        status: mapped.status,
        evidenceSource: mapped.evidenceSource,
        assessedAt: new Date().toISOString(),
        assessedBy: 'automated',
      }
    })

    // DIBCAC summary
    const dibcacSummary = {
      total: objectiveStatuses.length,
      met: objectiveStatuses.filter((o) => o.status === 'met').length,
      partiallyMet: objectiveStatuses.filter((o) => o.status === 'partially_met').length,
      notMet: objectiveStatuses.filter((o) => o.status === 'not_met').length,
      requiresManual: objectiveStatuses.filter((o) => o.status === 'requires_manual').length,
      requiresPhysical: objectiveStatuses.filter((o) => o.status === 'requires_physical').length,
      notAssessed: objectiveStatuses.filter((o) => o.status === 'not_assessed').length,
      coveragePercentage: 0,
    }
    const assessableObjectives = dibcacSummary.total - dibcacSummary.requiresPhysical
    dibcacSummary.coveragePercentage =
      assessableObjectives > 0
        ? Math.round(
            ((dibcacSummary.met + dibcacSummary.partiallyMet * 0.5) / assessableObjectives) * 100
          )
        : 0

    const fullReport: FullReport = { ...report, objectiveStatuses, dibcacSummary }

    await callbacks?.onComplete?.(fullReport)
    return fullReport
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    await callbacks?.onError?.(error)
    throw error
  }
}
