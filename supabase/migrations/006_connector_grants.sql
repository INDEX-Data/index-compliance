-- =============================================================================
-- INDEX ATLAS — OAuth Connector Framework (Slice 1)
-- Migration 006 — connector_grants, oauth_states
--
-- Replaces the static-secret connector model with real OAuth grants. M365 uses
-- admin-consent (app-only, multi-tenant app): we store ONLY the customer tenant
-- id and mint app-only tokens on demand from OUR server-side secret — no token,
-- no customer secret. Third-party connectors use Auth-Code + PKCE and store
-- encrypted access/refresh tokens here.
--
-- NON-BREAKING: this migration adds tables only. The legacy clients.client_secret
-- and client_integrations.config columns are NOT touched — the resolver falls
-- back to them until a tenant re-consents. Do not drop legacy columns in Slice 1.
-- =============================================================================

-- ─── Connector Grants (the token vault) ──────────────────────────────────────
-- One row per (client, platform). For M365 (grant_type='app_consent') tokens are
-- null — runtime tokens are minted from OUR AZURE_CLIENT_SECRET against
-- external_tenant_id. For third-party (grant_type='auth_code_pkce') the
-- access/refresh tokens are stored ENCRYPTED (web/lib/crypto.ts, enc:v1:).

CREATE TABLE connector_grants (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform           text NOT NULL,                    -- 'm365' | 'jira' | ...
  grant_type         text NOT NULL,                    -- 'app_consent' | 'auth_code_pkce'
  external_tenant_id text,                              -- M365 customer tenant id (app_consent)
  access_token       text,                             -- ENCRYPTED; null for app_consent
  refresh_token      text,                             -- ENCRYPTED; null for app_consent
  access_expires_at  timestamptz,
  scopes             jsonb NOT NULL DEFAULT '[]'::jsonb,
  consented_tier     text NOT NULL DEFAULT 'read',     -- 'read' | 'write'
  status             text NOT NULL DEFAULT 'pending',  -- pending|connected|expired|error|revoked
  last_refresh_at    timestamptz,
  error_message      text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. jira cloud_id, sovereign cloud
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (client_id, platform)
);

ALTER TABLE connector_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own connector grants"
  ON connector_grants FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_connector_grants_client ON connector_grants(client_id);
CREATE INDEX idx_connector_grants_platform ON connector_grants(platform);

-- ─── OAuth States (CSRF + PKCE, transient, server-only) ──────────────────────
-- Bridges the authorize → callback round-trip. Keyed by the random `state` we
-- send to the provider and validate on return. code_verifier (PKCE) is stored
-- ENCRYPTED and never leaves the server. No RLS: accessed only via the
-- service-role key in the OAuth routes. Rows are short-lived (~10 min) and
-- consumed/deleted on callback.

CREATE TABLE oauth_states (
  state         text PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES clients(id) ON DELETE CASCADE,
  onboard_token text,                                  -- set instead of user_id during onboarding
  platform      text NOT NULL,
  tier          text NOT NULL DEFAULT 'read',          -- 'read' | 'write'
  code_verifier text,                                  -- ENCRYPTED; PKCE (auth_code_pkce) only
  redirect_uri  text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);
