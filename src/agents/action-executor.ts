// =============================================================================
// INDEX ATLAS — Action Executor (Sprint 1, IND-58)
// Executes a single approved RemediationAction with full audit trail.
// Guards: 24h rollback window, kill-switch check, dryRun-first contract.
// =============================================================================

import type { RemediationDb } from '../types.js'
import { AuditLogger } from '../services/audit-logger.js'
import { IdentityAgent } from './identity-agent.js'
import { BaseAgent } from './base-agent.js'
import type { RemediationAction, WriteOpts } from '../agents/index.js'
import type { GraphClient } from '../services/graph-client.js'

const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface AgentActionRow {
  id: string
  job_id: string
  control_id: string
  agent_type: string
  status: string
  action_data: RemediationAction
  approved_by: string | null
  approved_at: string | null
  executed_at: string | null
  idempotency_key: string | null
}

export async function executeSingleAction(
  actionRow: AgentActionRow,
  graphClient: GraphClient,
  approvedBy: string,
  assessmentId: string,
  supabase: RemediationDb
): Promise<void> {
  const logger = new AuditLogger(supabase)
  const action = actionRow.action_data

  await checkKillSwitch(supabase, actionRow.job_id)

  const agent = resolveAgent(action, graphClient)
  const opts = buildWriteOpts(action, approvedBy, assessmentId, false)

  await logger.logActionStart(actionRow.id, action, opts)

  try {
    const result = await agent.execute(action, approvedBy, assessmentId)
    await logger.logActionComplete(actionRow.id, result)

    // Update the job status to 'running' if still 'pending_approval'
    await supabase
      .from('remediation_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', actionRow.job_id)
      .eq('status', 'pending_approval')
  } catch (err) {
    await logger.logActionFailed(actionRow.id, err instanceof Error ? err : new Error(String(err)))
    throw err
  }
}

export async function rollbackSingleAction(
  actionRow: AgentActionRow,
  graphClient: GraphClient,
  rolledBackBy: string,
  assessmentId: string,
  supabase: RemediationDb
): Promise<void> {
  if (!actionRow.executed_at) {
    throw new Error('Action has not been executed — nothing to roll back')
  }
  const executedAt = new Date(actionRow.executed_at).getTime()
  if (Date.now() - executedAt > ROLLBACK_WINDOW_MS) {
    throw new Error('Rollback window (24h) has expired for this action')
  }

  const logger = new AuditLogger(supabase)
  const action = actionRow.action_data
  const agent = resolveAgent(action, graphClient)

  try {
    await agent.rollback(action, rolledBackBy, assessmentId)
    await logger.logActionRolledBack(actionRow.id, rolledBackBy)
  } catch (err) {
    await logger.logActionFailed(actionRow.id, err instanceof Error ? err : new Error(String(err)))
    throw err
  }
}

export async function dryRunSingleAction(
  actionRow: AgentActionRow,
  graphClient: GraphClient,
  supabase: RemediationDb
): Promise<{ preview: unknown; warnings: string[] }> {
  const action = actionRow.action_data
  const agent = resolveAgent(action, graphClient)
  const logger = new AuditLogger(supabase)

  const result = await agent.dryRun(action)
  await logger.storeDryRunResult(actionRow.id, result.preview, result.warnings)
  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveAgent(action: RemediationAction, graphClient: GraphClient): BaseAgent {
  switch (action.agentType) {
    case 'identity':
      return new IdentityAgent(graphClient)
    default:
      throw new Error(`No agent registered for type: ${action.agentType}`)
  }
}

function buildWriteOpts(
  action: RemediationAction,
  approvedBy: string,
  assessmentId: string,
  dryRun: boolean
): WriteOpts {
  return {
    dryRun,
    requiredScopes: action.graphOperation.requiredPermissions,
    idempotencyKey: action.id,
    auditContext: {
      agentType: action.agentType,
      actionId: action.id,
      approvedBy,
      assessmentId,
    },
  }
}

async function checkKillSwitch(supabase: RemediationDb, jobId: string): Promise<void> {
  const { data: job } = await supabase
    .from('remediation_jobs')
    .select('client_id')
    .eq('id', jobId)
    .single()

  if (!job) return

  const { data: agentRow } = await supabase
    .from('client_agents')
    .select('kill_switch')
    .eq('client_id', job.client_id)
    .eq('agent_type', 'identity')
    .single()

  if (agentRow?.kill_switch) {
    throw new Error('Agent kill-switch is active for this client — all agent actions are halted')
  }
}
