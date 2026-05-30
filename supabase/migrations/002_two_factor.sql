-- ═══════════════════════════════════════════════════════════════
-- REL Certification Tracker — Migration 002: Email-OTP Two-Factor Auth
-- Run in Supabase dashboard: Settings → SQL Editor → New query
-- (This migration does NOT auto-run — apply it manually at deploy.)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── users: opt-in 2FA flag ──────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;

-- ─── TABLE: otp_codes ────────────────────────────────────────────
-- Codes are stored HASHED (bcrypt) — never plaintext.
CREATE TABLE IF NOT EXISTS otp_codes (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int         NOT NULL DEFAULT 0,
  used        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id    ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ─── RLS: service_role only (matches every other table) ──────────
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON otp_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
