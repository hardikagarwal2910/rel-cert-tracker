-- ═══════════════════════════════════════════════════════════════
-- REL Certification Tracker — Migration 004 (v1.1.0)
-- Renewal stages · cert_documents · audit_log RESTRICTIVE RLS
-- Run in Supabase dashboard: Settings → SQL Editor → New query
-- (Does NOT auto-run — apply manually at deploy, after 001–003.)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Renewal stage on certificates + supplier_certs ──────────────
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS renewal_stage text NOT NULL DEFAULT 'not_started'
    CHECK (renewal_stage IN ('not_started','in_progress','awaiting_issuer','renewed'));

ALTER TABLE supplier_certs
  ADD COLUMN IF NOT EXISTS renewal_stage text NOT NULL DEFAULT 'not_started'
    CHECK (renewal_stage IN ('not_started','in_progress','awaiting_issuer','renewed'));

-- ─── TABLE: cert_documents (multiple docs per certificate) ───────
CREATE TABLE IF NOT EXISTS cert_documents (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cert_id              uuid        NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  cert_type            text        NOT NULL DEFAULT 'internal'
                                   CHECK (cert_type IN ('internal','supplier')),
  doc_type             text        NOT NULL DEFAULT 'certificate'
                                   CHECK (doc_type IN ('certificate','test_report','scope_annex','other')),
  file_name            text        NOT NULL,
  google_drive_file_id text        NOT NULL,
  uploaded_by          uuid        REFERENCES users(id),
  uploaded_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_documents_cert_id ON cert_documents(cert_id);

ALTER TABLE cert_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON cert_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Harden audit_log append-only (TRIGGER — RLS is bypassed) ─────
-- NOTE: Supabase's service_role has BYPASSRLS, so RLS policies (permissive OR
-- restrictive) do NOT block it. The app uses the service_role key, so the only
-- reliable DB-level enforcement is a trigger, which fires even for BYPASSRLS
-- roles. We keep RESTRICTIVE policies for non-bypass roles and add the trigger
-- as the real guard.
DROP POLICY IF EXISTS "no_update_audit_log" ON audit_log;
DROP POLICY IF EXISTS "no_delete_audit_log" ON audit_log;
CREATE POLICY "no_update_audit_log" ON audit_log
  AS RESTRICTIVE FOR UPDATE TO service_role USING (false);
CREATE POLICY "no_delete_audit_log" ON audit_log
  AS RESTRICTIVE FOR DELETE TO service_role USING (false);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_update_audit_log ON audit_log;
DROP TRIGGER IF EXISTS trg_no_delete_audit_log ON audit_log;
CREATE TRIGGER trg_no_update_audit_log BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
CREATE TRIGGER trg_no_delete_audit_log BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
