// =============================================================================
// INDEX ATLAS — Agent Types
// =============================================================================

export type AgentType =
  | 'identity'
  | 'privileged_access'
  | 'device_compliance'
  | 'data_protection'
  | 'audit_monitoring'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type RemediationJobStatus =
  | 'planning'
  | 'pending_approval'
  | 'running'
  | 'complete'
  | 'failed'
  | 'rolled_back'

export type AgentActionStatus =
  | 'planned'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'complete'
  | 'failed'
  | 'rolled_back'
  | 'skipped'

export interface WriteOpts {
  dryRun: boolean
  requiredScopes: string[]
  idempotencyKey?: string
  auditContext: {
    agentType: AgentType
    actionId: string
    approvedBy: string
    assessmentId: string
  }
}
