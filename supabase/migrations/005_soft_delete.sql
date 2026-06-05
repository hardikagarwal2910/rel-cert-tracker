-- ════════════════════════════════════════════════════════════════════════════
-- Migration 005 — Soft delete / archive (v1.1.1)
--
-- ⚠️  RUN MANUALLY in the Supabase SQL editor. This migration does NOT auto-run.
--
-- Design decision (documented intentionally):
--   • certificates → NEW `archived` columns. Certificates had no existing
--     deactivation flag, so we add a dedicated soft-delete marker plus an audit
--     trail of who archived it and when.
--   • suppliers    → REUSE the existing `status` enum. Archiving a supplier sets
--     status='inactive' (reactivate → 'active' or 'onboarding'). No new columns —
--     adding `archived` here would duplicate `status` and create two sources of
--     truth.
--   • locations    → REUSE the existing `active` boolean. Deactivating sets
--     active=false (reactivate → active=true). No new columns.
--
-- This keeps the schema clean: each entity has exactly one retire/restore flag.
-- The UI behaviour (hide from active lists, keep the record, restore on demand)
-- is identical across all three.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── certificates: dedicated soft-delete columns ─────────────────────────────
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS archived     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid        REFERENCES users(id);

-- Default-list queries always filter on archived; index the common path.
CREATE INDEX IF NOT EXISTS certificates_archived_idx ON certificates(archived);

-- No changes to suppliers (uses status) or locations (uses active) — see header.
