-- ═══════════════════════════════════════════════════════════════
-- REL Certification Tracker — Migration 003: Buyer Accounts + Approval
-- Run in Supabase dashboard: Settings → SQL Editor → New query
-- (This migration does NOT auto-run — apply it manually at deploy,
--  alongside 001 and 002.)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── buyers: login + approval columns ────────────────────────────
-- email_hash = SHA-256 of the lowercased email, used for efficient
-- duplicate detection and lookup (the email itself is AES-encrypted
-- and non-deterministic, so it can't be queried directly).
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS email_hash    text,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS approved_by   uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_login    timestamptz,
  ADD COLUMN IF NOT EXISTS visible_tags  jsonb NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_buyers_email_hash ON buyers(email_hash);
CREATE INDEX IF NOT EXISTS idx_buyers_status     ON buyers(status);

-- ─── TABLE: buyer_visits ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyer_visits (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    uuid        NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  ip_address  text,                  -- AES-256 encrypted
  geolocation jsonb,
  path        text,
  user_agent  text,
  visited_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_visits_buyer_id   ON buyer_visits(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_visits_visited_at ON buyer_visits(visited_at);

-- ─── RLS: service_role only (matches every other table) ──────────
ALTER TABLE buyer_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON buyer_visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
