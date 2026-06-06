-- ════════════════════════════════════════════════════════════════════════════
-- Migration 008 — Four-tier role system (v1.2.0)
--
-- ⚠️  RUN MANUALLY in the Supabase SQL editor. This migration does NOT auto-run.
--
-- Widens the users.role CHECK constraint from ('admin','staff') to the four
-- tiers: admin · manager · staff · viewer. Existing 'admin'/'staff' rows stay
-- valid; no roles are dropped. (Buyer and supplier auth are entirely separate
-- systems and are untouched.)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'staff', 'viewer'));
