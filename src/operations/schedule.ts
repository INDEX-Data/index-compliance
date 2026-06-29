// =============================================================================
// INDEX ATLAS — Scheduler (Sprint 2)
// Determines which assessment schedules are due and computes next_run_at.
// Called by the cron endpoint; no external cron library needed.
// =============================================================================

import cronParser from 'cron-parser'
import type { RemediationDb } from '../types.js'

export interface AssessmentSchedule {
  id: string
  userId: string
  clientId: string
  frameworkId: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastReportId: string | null
}

// ---------------------------------------------------------------------------
// Cron next-run calculator — full 5-field cron via cron-parser, evaluated in
// UTC. Falls back to "+1 day at the same time" only if the expression cannot
// be parsed, so a malformed schedule never throws inside the cron runner.
// ---------------------------------------------------------------------------

/** True if `cronExpression` is a valid 5-field cron expression. */
export function isValidCron(cronExpression: string): boolean {
  try {
    cronParser.parseExpression(cronExpression, { tz: 'UTC' })
    return true
  } catch {
    return false
  }
}

export function nextRunAfter(cronExpression: string, from: Date = new Date()): Date {
  try {
    const interval = cronParser.parseExpression(cronExpression, { currentDate: from, tz: 'UTC' })
    return interval.next().toDate()
  } catch {
    // Defensive fallback — should not happen once schedules are validated on save.
    const next = new Date(from)
    next.setUTCDate(next.getUTCDate() + 1)
    return next
  }
}

// ---------------------------------------------------------------------------
// Fetch schedules that are due (next_run_at <= now)
// ---------------------------------------------------------------------------

export async function getDueSchedules(db: RemediationDb): Promise<AssessmentSchedule[]> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('assessment_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', now)

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map(rowToSchedule)
}

// ---------------------------------------------------------------------------
// Mark a schedule as run and compute the next fire time
// ---------------------------------------------------------------------------

export async function markScheduleRun(
  scheduleId: string,
  reportId: string,
  cronExpression: string,
  db: RemediationDb
): Promise<void> {
  const now = new Date()
  const nextRun = nextRunAfter(cronExpression, now)

  await db
    .from('assessment_schedules')
    .update({
      last_run_at: now.toISOString(),
      last_report_id: reportId,
      next_run_at: nextRun.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', scheduleId)
}

// ---------------------------------------------------------------------------
// CRUD helpers called by the schedules API route
// ---------------------------------------------------------------------------

export async function upsertSchedule(
  input: {
    userId: string
    clientId: string
    frameworkId: string
    cronExpression?: string
    enabled?: boolean
  },
  db: RemediationDb
): Promise<AssessmentSchedule> {
  const cron = input.cronExpression ?? '0 2 * * 1'
  const nextRun = nextRunAfter(cron)

  const { data, error } = await db
    .from('assessment_schedules')
    .upsert(
      {
        user_id: input.userId,
        client_id: input.clientId,
        framework_id: input.frameworkId,
        cron_expression: cron,
        enabled: input.enabled ?? true,
        next_run_at: nextRun.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,framework_id' }
    )
    .select('*')
    .single()

  if (error || !data) throw new Error(`Failed to upsert schedule: ${error?.message}`)
  return rowToSchedule(data as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function rowToSchedule(row: Record<string, unknown>): AssessmentSchedule {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    clientId: row.client_id as string,
    frameworkId: row.framework_id as string,
    cronExpression: row.cron_expression as string,
    enabled: row.enabled as boolean,
    lastRunAt: (row.last_run_at as string) ?? null,
    nextRunAt: (row.next_run_at as string) ?? null,
    lastReportId: (row.last_report_id as string) ?? null,
  }
}
