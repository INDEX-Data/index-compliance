// =============================================================================
// INDEX ATLAS — Base Agent Abstract Class
// Concrete implementations built in Sprint 1 (IND-53).
// Defines the plan / dryRun / execute / rollback contract all agents implement.
// =============================================================================

import type { GraphClient } from '../services/graph-client.js'
import type { ControlAssessment } from '../types.js'
import type { AgentType, RiskLevel, WriteOpts } from './types.js'

export interface RemediationAction {
  id: string
  controlId: string
  title: string
  description: string
  agentType: AgentType
  graphOperation: {
    method: 'POST' | 'PATCH' | 'DELETE'
    endpoint: string
    payload?: unknown
    requiredPermissions: string[]
  }
  riskLevel: RiskLevel
  autoApprovable: boolean
  rollback: {
    method: 'POST' | 'PATCH' | 'DELETE'
    endpoint: string
    payload?: unknown
  }
  preconditions?: string[]
  impact: string
}

export type { WriteOpts }

/**
 * Abstract base class for all ATLAS remediation agents.
 * Each concrete agent handles one domain (identity, device, data, etc.)
 * and knows the native test/simulation modes for its policy types.
 *
 * Full implementation in Sprint 1 (IND-53).
 */
export abstract class BaseAgent {
  abstract readonly agentType: AgentType
  abstract readonly requiredScopes: string[]

  constructor(protected graphClient: GraphClient) {}

  /** Convert failed ControlAssessments into structured RemediationActions */
  abstract plan(assessments: ControlAssessment[]): Promise<RemediationAction[]>

  /** Preview what an action would do without writing (uses native test modes) */
  abstract dryRun(action: RemediationAction): Promise<{ preview: unknown; warnings: string[] }>

  /** Execute an approved action */
  abstract execute(action: RemediationAction, approvedBy: string, assessmentId: string): Promise<unknown>

  /** Rollback a previously executed action within the rollback window */
  abstract rollback(action: RemediationAction, approvedBy: string, assessmentId: string): Promise<unknown>
}
