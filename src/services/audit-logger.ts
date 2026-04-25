// =============================================================================
// INDEX ATLAS — Audit Logger (Sprint 1, IND-59)
// Records agent action lifecycle events to agent_actions rows.
// No separate audit table — the agent_actions table IS the audit trail.
// =============================================================================

import type { RemediationDb } from '../types.js'
import type { RemediationAction, WriteOpts } from '../agents/index.js'

export class AuditLogger {
  constructor(private supabase: RemediationDb) {}

  async logActionStart(actionId: string, action: RemediationAction, opts: WriteOpts): Promise<void> {
    await this.supabase
      .from('agent_actions')
      .update({
        status: 'executing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
  }

  async logActionComplete(actionId: string, result: unknown): Promise<void> {
    await this.supabase
      .from('agent_actions')
      .update({
        status: 'complete',
        result,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
  }

  async logActionFailed(actionId: string, error: Error): Promise<void> {
    await this.supabase
      .from('agent_actions')
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
  }

  async logActionRolledBack(actionId: string, rolledBackBy: string): Promise<void> {
    await this.supabase
      .from('agent_actions')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
        approved_by: rolledBackBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
  }

  async storeDryRunResult(actionId: string, preview: unknown, warnings: string[]): Promise<void> {
    await this.supabase
      .from('agent_actions')
      .update({
        dry_run_result: { preview, warnings },
        status: 'pending_approval',
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
  }
}
