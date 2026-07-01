-- =============================================================================
-- INDEX ATLAS — OAuth Connector Framework (Slice 1, follow-up)
-- Migration 007 — allow client rows created via OAuth admin-consent
--
-- The legacy clients table required a per-customer app registration:
-- client_id + client_secret NOT NULL. M365 admin-consent connections have
-- NEITHER — ATLAS uses its own multi-tenant app and mints app-only tokens from
-- the server-side secret. So a client created through the OAuth flow has only a
-- tenant_id. Relax the NOT NULL constraints on client_id / client_secret so an
-- OAuth-created client is valid. Existing (legacy) rows keep their values.
-- Additive + non-breaking.
-- =============================================================================

ALTER TABLE clients ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN client_secret DROP NOT NULL;
