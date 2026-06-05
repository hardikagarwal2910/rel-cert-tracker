-- ════════════════════════════════════════════════════════════════════════════
-- Migration 006 — Location nickname / internal label (v1.1.3)
--
-- ⚠️  RUN MANUALLY in the Supabase SQL editor. This migration does NOT auto-run.
--
-- Problem: Raghuvir Exim Limited has multiple sites, but every location row was
-- created with the same `name` ("Raghuvir Exim Limited"), so they were
-- indistinguishable in lists and dropdowns.
--
-- Decision (documented):
--   • name      = legal / company entity name. May repeat across locations.
--   • nickname  = short internal label (e.g. "Shilaj Unit", "Towel Plant",
--                 "Head Office"). The human, distinguishing name.
--
-- nickname is NULLABLE so existing rows keep working. The UI falls back to
-- "Company — City" until a nickname is set (see src/lib/location-label.ts).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS nickname text;
