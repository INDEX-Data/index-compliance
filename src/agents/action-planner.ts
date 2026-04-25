// =============================================================================
// INDEX ATLAS — Action Planner (Sprint 1, IND-62)
// ControlAssessment[] → RemediationJob in DB + RemediationAction[] returned
// =============================================================================

import { createHash } from 'crypto'
import type { RemediationDb } from '../types.js'
import { IdentityAgent } from './identity-agent.js'
import type { RemediationAction } from './base-agent.js'
import type { ControlAssessment } from '../types.js'
import type { GraphClient } from '../services/graph-client.js'

export interface PlanResult {
  jobId: string
  actions: RemediationAction[]
}

export async function planRemediation(
  assessments: ControlAssessment[],
  graphClient: GraphClient,
  clientId: string,
  assessmentId: string,
  userId: string,
  supabase: RemediationDb
): Promise<PlanResult> {
  const failed = assessments.filter((a) => a.status === 'fail' || a.status === 'partial')
  if (failed.length === 0) {
    throw new Error('No failed or partial controls to remediate')
  }

  // Sprint 1: Identity agent only. Sprint 4 adds the remaining agents.
  const identityAgent = new IdentityAgent(graphClient)
  const actions = await identityAgent.plan(failed)

  if (actions.length === 0) {
    throw new Error('No remediable actions identified for the failed controls')
  }

  // Insert the remediation job row
  const { data: job, error: jobError } = await supabase
    .from('remediation_jobs')
    .insert({
      user_id: userId,
      client_id: clientId,
      assessment_id: assessmentId,
      status: 'pending_approval',
      agent_types: ['identity'],
    })
    .select('id')
    .single()

  if (jobError || !job) {
    throw new Error(`Failed to create remediation job: ${jobError?.message}`)
  }

  const jobId = job.id as string

  // Insert one agent_actions row per planned action
  const actionRows = actions.map((action) => ({
    job_id: jobId,
    user_id: userId,
    control_id: action.controlId,
    agent_type: action.agentType,
    status: 'pending_approval',
    action_data: action as unknown as Record<string, unknown>,
    idempotency_key: buildIdempotencyKey(clientId, action),
  }))

  const { error: actionsError } = await supabase.from('agent_actions').insert(actionRows)
  if (actionsError) {
    // Clean up the job row if actions failed to insert
    await supabase.from('remediation_jobs').delete().eq('id', jobId)
    throw new Error(`Failed to insert agent actions: ${actionsError.message}`)
  }

  return { jobId, actions }
}

function buildIdempotencyKey(clientId: string, action: RemediationAction): string {
  const raw = `${clientId}:${action.controlId}:${action.graphOperation.endpoint}:${JSON.stringify(action.graphOperation.payload ?? '')}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}
