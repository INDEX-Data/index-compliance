-- =============================================================================
-- INDEX ATLAS — Coverage Metrics on Maturity Snapshots
-- Migration 005 — split manual controls out of "not assessed" and record the
-- coverage metrics so the maturity time-series can surface the progression
-- guard (a score that "improves" only because collection health dropped).
--
-- Columns are nullable so existing snapshots remain valid.
-- =============================================================================

ALTER TABLE maturity_snapshots
  ADD COLUMN IF NOT EXISTS manual_required    integer,   -- controls needing attestation
  ADD COLUMN IF NOT EXISTS automated_coverage integer,   -- % of framework auto-assessable
  ADD COLUMN IF NOT EXISTS collection_health  integer;   -- % of automatable controls collected this run
