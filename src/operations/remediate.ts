// =============================================================================
// INDEX ATLAS — Remediation Operations Layer (Sprint 1, IND-62)
// Transport-agnostic: called by web routes and MCP tools.
// =============================================================================

import type { RemediationDb } from '../types.js'
import { planRemediation } from '../agents/action-planner.js'
import type { RemediationAction } from '../agents/index.js'
import type { PlanResult } from '../agents/action-planner.js'
import type { ControlAssessment } from '../types.js'
import type { GraphClient } from '../services/graph-client.js'

export interface RemediationInput {
  assessments: ControlAssessment[]
  clientId: string
  assessmentId: string
  userId: string
  graphClient: GraphClient
  supabase: RemediationDb
}

export async function runRemediation(input: RemediationInput): Promise<PlanResult> {
  return planRemediation(
    input.assessments,
    input.graphClient,
    input.clientId,
    input.assessmentId,
    input.userId,
    input.supabase
  )
}

export type { PlanResult, RemediationAction }
