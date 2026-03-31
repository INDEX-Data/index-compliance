-- =============================================================================
-- INDEX DSaaS — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================

-- ─── Clients (Azure tenants) ─────────────────────────────────────────────────

CREATE TABLE clients (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name        text NOT NULL,
  tenant_id   text NOT NULL,
  client_id   text NOT NULL,
  client_secret text NOT NULL,
  added_at    timestamptz DEFAULT now(),
  notes       text
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own clients"
  ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own clients"
  ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own clients"
  ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own clients"
  ON clients FOR DELETE USING (auth.uid() = user_id);

-- ─── Reports ─────────────────────────────────────────────────────────────────

CREATE TABLE reports (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  framework_id  text NOT NULL,
  data          jsonb NOT NULL,
  generated_at  timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reports"
  ON reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reports"
  ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reports"
  ON reports FOR DELETE USING (auth.uid() = user_id);

-- ─── DIBCAC Objective Statuses ───────────────────────────────────────────────

CREATE TABLE objective_statuses (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id        text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  objective_id     text NOT NULL,
  status           text NOT NULL,
  evidence_source  text,
  attestation_text text,
  document_ref     text,
  document_name    text,
  assessed_at      timestamptz,
  assessed_by      text,
  UNIQUE (report_id, objective_id)
);

ALTER TABLE objective_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage objectives via report ownership"
  ON objective_statuses FOR ALL
  USING (EXISTS (SELECT 1 FROM reports WHERE reports.id = objective_statuses.report_id AND reports.user_id = auth.uid()));

-- ─── Client Invitations ──────────────────────────────────────────────────────

CREATE TABLE client_invitations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  token       text NOT NULL UNIQUE,
  client_name text NOT NULL,
  email       text,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invitations"
  ON client_invitations FOR ALL USING (auth.uid() = user_id);

-- Public read for onboarding (token-based lookup, no auth required)
CREATE POLICY "Public read by token"
  ON client_invitations FOR SELECT USING (true);

-- ─── Client Integrations ─────────────────────────────────────────────────────

CREATE TABLE client_integrations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  config        jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  connected_at  timestamptz,
  last_tested_at timestamptz,
  error_message text,
  UNIQUE (client_id, platform)
);

ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations"
  ON client_integrations FOR ALL USING (auth.uid() = user_id);

-- ─── Team Invitations ────────────────────────────────────────────────────────

CREATE TABLE team_invitations (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  token      text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own team invitations"
  ON team_invitations FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public read by token"
  ON team_invitations FOR SELECT USING (true);

-- ─── Team Memberships ────────────────────────────────────────────────────────

CREATE TABLE team_memberships (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES team_invitations(id) ON DELETE SET NULL,
  joined_at     timestamptz DEFAULT now(),
  UNIQUE (owner_id, member_id)
);

ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners see their team"
  ON team_memberships FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = member_id);
CREATE POLICY "Owners manage their team"
  ON team_memberships FOR INSERT WITH CHECK (auth.uid() = owner_id OR auth.uid() = member_id);
CREATE POLICY "Owners remove members"
  ON team_memberships FOR DELETE USING (auth.uid() = owner_id);

-- ─── User Profiles ───────────────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL DEFAULT 'msp',
  company_name text NOT NULL,
  role         text,
  org_size     text,
  industry     text,
  onboarded_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON user_profiles FOR ALL USING (auth.uid() = user_id);

-- ─── Asset Scoping ───────────────────────────────────────────────────────────

CREATE TABLE client_scoping (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  uuid NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scoping    jsonb NOT NULL DEFAULT '{"cui":true,"spa":true,"iot":false,"ot_scada":false}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_scoping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scoping"
  ON client_scoping FOR ALL USING (auth.uid() = user_id);

-- ─── CA Exclusion Snapshots ──────────────────────────────────────────────────

CREATE TABLE ca_exclusion_snapshots (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id       text NOT NULL,
  policy_name     text NOT NULL,
  excluded_users  jsonb NOT NULL DEFAULT '[]',
  excluded_groups jsonb NOT NULL DEFAULT '[]',
  justification   text,
  changed         text NOT NULL DEFAULT 'no',
  scanned_at      timestamptz DEFAULT now(),
  UNIQUE (client_id, policy_id)
);

ALTER TABLE ca_exclusion_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CA snapshots"
  ON ca_exclusion_snapshots FOR ALL USING (auth.uid() = user_id);

-- ─── Ticket Nominations ──────────────────────────────────────────────────────

CREATE TABLE ticket_nominations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  ticket_id     text NOT NULL,
  ticket_title  text NOT NULL,
  ticket_url    text,
  control_id    text NOT NULL,
  control_title text NOT NULL,
  framework_id  text NOT NULL,
  confidence    integer NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE ticket_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nominations"
  ON ticket_nominations FOR ALL USING (auth.uid() = user_id);

-- ─── Evidence Files ──────────────────────────────────────────────────────────

CREATE TABLE evidence_files (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id     text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  objective_id  text NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  original_name text NOT NULL,
  file_size     integer NOT NULL,
  mime_type     text NOT NULL,
  content       text NOT NULL,
  uploaded_at   timestamptz DEFAULT now()
);

ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own evidence files"
  ON evidence_files FOR ALL USING (auth.uid() = user_id);

-- ─── Assessment Jobs (for realtime progress tracking) ────────────────────────
-- Replaces SSE streaming. Frontend subscribes to Supabase Realtime on this table.

CREATE TABLE assessment_jobs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  framework_id   text NOT NULL,
  status         text NOT NULL DEFAULT 'pending',  -- pending | running | complete | error
  total_controls integer NOT NULL DEFAULT 0,
  current_index  integer NOT NULL DEFAULT 0,
  current_title  text,
  report_id      text,
  error_message  text,
  progress       jsonb DEFAULT '[]',  -- array of {controlId, title, status, done}
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE assessment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own jobs"
  ON assessment_jobs FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime on assessment_jobs so frontend gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE assessment_jobs;

-- ─── Indexes for common queries ──────────────────────────────────────────────

CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_framework ON reports(framework_id);
CREATE INDEX idx_reports_generated ON reports(generated_at DESC);
CREATE INDEX idx_objective_statuses_report ON objective_statuses(report_id);
CREATE INDEX idx_client_integrations_client ON client_integrations(client_id);
CREATE INDEX idx_assessment_jobs_user ON assessment_jobs(user_id);
CREATE INDEX idx_assessment_jobs_status ON assessment_jobs(status);
