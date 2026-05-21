-- ═══════════════════════════════════════════════════════════════
-- REL Certification Tracker — Initial Schema
-- Run in Supabase dashboard: Settings → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLE: locations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text        NOT NULL,
  address_line_1  text        NOT NULL,
  address_line_2  text,
  city            text        NOT NULL,
  state           text        NOT NULL,
  pincode         text        NOT NULL,
  country         text        NOT NULL DEFAULT 'India',
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── TABLE: categories ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text        NOT NULL UNIQUE,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categories (name) VALUES
  ('Sustainability'),
  ('Quality'),
  ('Social Compliance'),
  ('Environmental'),
  ('Safety'),
  ('Export Compliance')
ON CONFLICT (name) DO NOTHING;

-- ─── TABLE: users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  display_name  text,
  email         text,
  role          text        NOT NULL DEFAULT 'staff'
                            CHECK (role IN ('admin','staff')),
  active        boolean     NOT NULL DEFAULT true,
  last_login    timestamptz,
  last_action   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Default admin user (password: '1710', bcrypt hash rounds=10)
INSERT INTO users (username, password_hash, display_name, email, role, active)
VALUES (
  'hardik',
  '$2b$10$pQquwYGmbhAkuaVWXijNS.OkJv0u.808zbgvneoZG.KKQyBNMYz8i',
  'Hardik Agarwal',
  'hardik.agarwal@raghuvirexim.com',
  'admin',
  true
)
ON CONFLICT (username) DO NOTHING;

-- ─── TABLE: buyers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyers (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text        NOT NULL,
  company      text,
  email        text        NOT NULL,  -- AES-256 encrypted
  designation  text,
  ip_address   text,                  -- AES-256 encrypted
  geolocation  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── TABLE: certificates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id                          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                        text        NOT NULL,
  cert_number                 text,
  issuing_body                text,
  category                    text,
  issue_date                  date,
  expiry_date                 date        NOT NULL,
  renewal_process_start_date  date,
  renewal_cost                numeric(12,2),
  notes                       text,
  location_id                 uuid        REFERENCES locations(id),
  buyer_tags                  jsonb       NOT NULL DEFAULT '[]',
  buyer_visible               boolean     NOT NULL DEFAULT true,
  status                      text        NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('active','expiring_soon','expired')),
  version_history             jsonb       NOT NULL DEFAULT '[]',
  notification_log            jsonb       NOT NULL DEFAULT '[]',
  google_drive_file_id        text,
  submitted_by_supplier       boolean     NOT NULL DEFAULT false,
  created_by                  uuid        REFERENCES users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certificates_expiry_date_idx  ON certificates(expiry_date);
CREATE INDEX IF NOT EXISTS certificates_status_idx       ON certificates(status);
CREATE INDEX IF NOT EXISTS certificates_location_id_idx  ON certificates(location_id);

-- ─── TABLE: suppliers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 text        NOT NULL,
  tier                 text        CHECK (tier IN ('1','2','3')),
  commodity_tags       jsonb       NOT NULL DEFAULT '[]',
  address_line_1       text,
  address_line_2       text,
  city                 text,
  state                text,
  pincode              text,
  country              text        DEFAULT 'India',
  buyer_links          jsonb       NOT NULL DEFAULT '[]',
  contacts             jsonb       NOT NULL DEFAULT '[]',  -- contact emails/phones encrypted
  required_cert_ids    jsonb       NOT NULL DEFAULT '[]',
  status               text        NOT NULL DEFAULT 'onboarding'
                                   CHECK (status IN ('onboarding','active','inactive','suspended')),
  onboarding_checklist jsonb       NOT NULL DEFAULT '{
    "contacts_added": false,
    "required_certs_defined": false,
    "invite_sent": false,
    "invite_accepted": false,
    "first_cert_uploaded": false
  }',
  portal_login         jsonb       DEFAULT '{}',  -- all fields encrypted
  scorecard            jsonb       NOT NULL DEFAULT '{
    "total_submissions": 0,
    "approved": 0,
    "rejected": 0,
    "submitted_on_time": 0,
    "submitted_late": 0
  }',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── TABLE: supplier_required_certs ──────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_required_certs (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id     uuid        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  required_certs  jsonb       NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id)
);

-- ─── TABLE: supplier_certs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_certs (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id      uuid        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  cert_name        text        NOT NULL,
  cert_number      text,
  issuing_body     text,
  category         text,
  issue_date       date,
  expiry_date      date        NOT NULL,
  notes            text,
  location_id      uuid        REFERENCES locations(id),
  buyer_links      jsonb       NOT NULL DEFAULT '[]',
  status           text        NOT NULL DEFAULT 'pending_review'
                               CHECK (status IN
                                 ('pending_review','approved','rejected','expired','expiring_soon')),
  submission_date  timestamptz DEFAULT now(),
  ocr_result       jsonb       DEFAULT '{}',
  review           jsonb       DEFAULT '{}',
  google_drive_file_id text,
  version_history  jsonb       NOT NULL DEFAULT '[]',
  notification_log jsonb       NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_certs_supplier_id_idx  ON supplier_certs(supplier_id);
CREATE INDEX IF NOT EXISTS supplier_certs_status_idx       ON supplier_certs(status);
CREATE INDEX IF NOT EXISTS supplier_certs_expiry_date_idx  ON supplier_certs(expiry_date);

-- ─── TABLE: audit_log (APPEND ONLY) ──────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_identifier  text,
  action_type      text        NOT NULL,
  target           text,
  detail           text,
  ip_address       text,
  timestamp        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx    ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS audit_log_action_type_idx  ON audit_log(action_type);

-- ─── TABLE: notification_log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cert_id         uuid,
  cert_type       text        DEFAULT 'internal'
                              CHECK (cert_type IN ('internal','supplier')),
  recipient       text,
  subject         text,
  trigger_label   text,
  timestamp_sent  timestamptz DEFAULT now(),
  status          text        CHECK (status IN ('sent','failed')),
  error_message   text
);

-- ─── TABLE: pdf_requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_requests (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cert_id        uuid        REFERENCES certificates(id),
  buyer_name     text,
  buyer_company  text,
  buyer_email    text,       -- AES-256 encrypted
  cert_name      text,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','denied','expired')),
  requested_at   timestamptz DEFAULT now(),
  reviewed_at    timestamptz,
  reviewer       text,
  comment        text
);

-- ─── TABLE: download_tokens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS download_tokens (
  token       text        PRIMARY KEY,
  cert_id     uuid        NOT NULL REFERENCES certificates(id),
  buyer_email text,        -- AES-256 encrypted
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used        boolean     NOT NULL DEFAULT false,
  used_at     timestamptz
);

CREATE INDEX IF NOT EXISTS download_tokens_expires_at_idx  ON download_tokens(expires_at);
CREATE INDEX IF NOT EXISTS download_tokens_used_idx        ON download_tokens(used);


-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_required_certs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_certs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_tokens     ENABLE ROW LEVEL SECURITY;

-- Service role full access on all tables
-- (all server operations use service_role key — RLS prevents direct browser access)
CREATE POLICY "service_role_all" ON locations            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON categories           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON users                FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON buyers               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON certificates         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON suppliers            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON supplier_required_certs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON supplier_certs       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON audit_log            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON notification_log     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON pdf_requests         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON download_tokens      FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only protection for audit_log
-- These policies prevent UPDATE and DELETE even via service_role
CREATE POLICY "no_update_audit_log" ON audit_log
  FOR UPDATE TO service_role USING (false);

CREATE POLICY "no_delete_audit_log" ON audit_log
  FOR DELETE TO service_role USING (false);
