-- =============================================================================
-- INDEX ATLAS — Remediation Agents Schema (Sprint 1)
-- Migration 003 — remediation_jobs, agent_actions, client_agents
-- =============================================================================

-- ─── Remediation Jobs ────────────────────────────────────────────────────────
-- One job per assessment → remediation cycle.
-- Frontend subscribes via Realtime for live status updates.

CREATE TABLE remediation_jobs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessment_id   text NOT NULL,  -- references reports.id
  status          text NOT NULL DEFAULT 'planning',
  -- planning | pending_approval | running | complete | failed | rolled_back
  agent_types     text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE remediation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own remediation jobs"
  ON remediation_jobs FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE remediation_jobs;

-- ─── Agent Actions ───────────────────────────────────────────────────────────
-- One row per planned RemediationAction within a job.
-- Stores the full action payload, dry-run result, approval, execution result.

CREATE TABLE agent_actions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id           uuid NOT NULL REFERENCES remediation_jobs(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  control_id       text NOT NULL,
  agent_type       text NOT NULL,
  status           text NOT NULL DEFAULT 'planned',
  -- planned | pending_approval | approved | executing | complete | failed | rolled_back | skipped
  action_data      jsonb NOT NULL,       -- full RemediationAction serialized
  dry_run_result   jsonb,                -- preview returned by dryRun()
  approved_by      text,                 -- user email
  approved_at      timestamptz,
  executed_at      timestamptz,
  result           jsonb,
  error_message    text,
  rolled_back_at   timestamptz,
  idempotency_key  text UNIQUE,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent actions"
  ON agent_actions FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE agent_actions;

-- ─── Client Agents ───────────────────────────────────────────────────────────
-- Tracks which agents are consented and enabled per client.
-- kill_switch = true immediately halts all agent activity for that client.

CREATE TABLE client_agents (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type        text NOT NULL,
  enabled           boolean NOT NULL DEFAULT false,
  scopes_consented  text[] NOT NULL DEFAULT '{}',
  consented_at      timestamptz,
  kill_switch       boolean NOT NULL DEFAULT false,
  UNIQUE (client_id, agent_type)
);

ALTER TABLE client_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent consents"
  ON client_agents FOR ALL USING (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_remediation_jobs_client ON remediation_jobs(client_id);
CREATE INDEX idx_remediation_jobs_status ON remediation_jobs(status);
CREATE INDEX idx_agent_actions_job ON agent_actions(job_id);
CREATE INDEX idx_agent_actions_status ON agent_actions(status);
CREATE INDEX idx_client_agents_client ON client_agents(client_id);
