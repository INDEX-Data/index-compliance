-- =============================================================================
-- INDEX ATLAS — Continuous Operations Schema (Sprint 2)
-- Migration 004 — assessment_schedules, drift_events, maturity_snapshots
-- =============================================================================

-- ─── Assessment Schedules ────────────────────────────────────────────────────
-- Per-client recurring assessment schedule.
-- cron_expression follows standard cron syntax (e.g. '0 2 * * 1' = Mon 2am).

CREATE TABLE assessment_schedules (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  framework_id     text NOT NULL,
  cron_expression  text NOT NULL DEFAULT '0 2 * * 1',  -- weekly Monday 2am
  enabled          boolean NOT NULL DEFAULT true,
  last_run_at      timestamptz,
  next_run_at      timestamptz,
  last_report_id   text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (client_id, framework_id)
);

ALTER TABLE assessment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedules"
  ON assessment_schedules FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_schedules_next_run ON assessment_schedules(next_run_at)
  WHERE enabled = true;
CREATE INDEX idx_schedules_client ON assessment_schedules(client_id);

-- ─── Drift Events ────────────────────────────────────────────────────────────
-- Recorded when a control changes status between two consecutive assessments.
-- direction: 'regression' (pass→fail/partial) | 'improvement' (fail→pass)

CREATE TABLE drift_events (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  framework_id     text NOT NULL,
  control_id       text NOT NULL,
  control_title    text NOT NULL,
  prior_report_id  text NOT NULL,  -- references reports.id
  new_report_id    text NOT NULL,  -- references reports.id
  prior_status     text NOT NULL,
  new_status       text NOT NULL,
  direction        text NOT NULL,  -- 'regression' | 'improvement' | 'change'
  remediation_job_id uuid REFERENCES remediation_jobs(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE drift_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drift events"
  ON drift_events FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE drift_events;

CREATE INDEX idx_drift_client ON drift_events(client_id);
CREATE INDEX idx_drift_direction ON drift_events(direction);
CREATE INDEX idx_drift_created ON drift_events(created_at DESC);

-- ─── Maturity Snapshots ──────────────────────────────────────────────────────
-- One row per assessment run — captures the compliance percentage for trending.
-- Enables month-over-month maturity chart with a simple time-series query.

CREATE TABLE maturity_snapshots (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id             uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  framework_id          text NOT NULL,
  report_id             text NOT NULL,  -- references reports.id
  compliance_percentage integer NOT NULL,  -- 0–100
  passed                integer NOT NULL DEFAULT 0,
  failed                integer NOT NULL DEFAULT 0,
  partial               integer NOT NULL DEFAULT 0,
  not_assessed          integer NOT NULL DEFAULT 0,
  total_controls        integer NOT NULL DEFAULT 0,
  risk_score            text NOT NULL,  -- low | medium | high | critical
  snapshotted_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maturity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own maturity snapshots"
  ON maturity_snapshots FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_maturity_client_fw ON maturity_snapshots(client_id, framework_id);
CREATE INDEX idx_maturity_snapshotted ON maturity_snapshots(snapshotted_at DESC);
