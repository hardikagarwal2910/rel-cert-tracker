# REL Certification Tracker — App Reference

> **Single source of truth.** This document describes the application *as it actually is in the code* (v1.1.1), derived by auditing the real source, schema, routes, and tests. Read this first in any future session.

- **Current version:** `1.1.1` (`package.json`, `src/lib/version.ts`)
- **Production URL:** https://rel-cert-tracker.vercel.app
- **Working directory:** `/Users/hardikagarwal/Downloads/rel-cert-tracker` (this repo is the *only* live codebase)
- ⚠️ **NEVER read or use** `~/Downloads/OLD_prototypes_DO_NOT_USE` — it is a retired prototype, not the live app.

---

## 1. Overview

The REL Certification Tracker is a compliance-certificate management system for **Raghuvir Exim Limited (REL)**, a textile exporter in Ahmedabad. It tracks three classes of data and serves three distinct user surfaces:

**What it manages**
1. **Internal compliance certificates** — REL's own certifications (ISO, OEKO-TEX, etc.): expiry tracking, renewal workflow, versioned history, document storage, buyer visibility.
2. **Supplier certificates** — suppliers upload their certs through a self-service portal; REL reviews them (with AI/OCR cross-check) and scores supplier performance.
3. **Buyer access** — external buyers register (admin-approved) and view only the certificates REL has explicitly marked visible to them.

**Who uses it (four roles / three portals)**
- **admin** — full control (dashboard surface).
- **staff** — most dashboard operations; cannot manage users, buyers, locations, categories, or delete (those are admin-only).
- **supplier** — isolated supplier portal; sees and uploads only their own certs.
- **buyer** — isolated buyer portal; sees only `buyer_visible`, non-supplier, non-archived certs.

**Three portal surfaces**
- **Admin/Staff Dashboard** — `(dashboard)` route group, NextAuth session.
- **Supplier Portal** — `(supplier-portal)` route group, `rel_supplier_token` JWT cookie.
- **Buyer Portal** — `buyer-portal/`, `rel_buyer_token` JWT cookie.

---

## 2. Tech Stack

| Concern | Technology | Package / version |
|---|---|---|
| Framework | Next.js 14 App Router | `next@14.2.35` |
| Language | TypeScript | `typescript@^5` (strict) |
| UI | React 18 + Tailwind | `react@^18`, `tailwindcss@^3.4.1` |
| Database | Supabase (PostgreSQL) | `@supabase/supabase-js@^2.106.1`, `@supabase/ssr@^0.10.3` |
| Hosting / CI | Vercel | `vercel.json` (crons + function timeouts) |
| Admin auth | NextAuth / Auth.js v5 (JWT sessions) | `next-auth@^5.0.0-beta.31`, `@auth/supabase-adapter` |
| Supplier/buyer auth | Stateless signed JWTs (JOSE) | `jose` (via next-auth), `jsonwebtoken@^9` |
| Password hashing | bcrypt | `bcryptjs@^3.0.3` |
| Field encryption | AES-256-CBC | `crypto-js@^4.2.0` |
| Email | Resend | `resend@^6.12.3` |
| File storage | Google Drive (service account) | `googleapis@^172.0.0` |
| OCR / AI cross-check | Anthropic Claude (vision) | `@anthropic-ai/sdk@^0.97.1`, model `claude-sonnet-4-20250514` |
| PDF generation | jsPDF | `jspdf@^4.2.1`, `jspdf-autotable@^5.0.8` |
| ZIP (backup) | **fflate** (`zipSync`) | `fflate` (backup route) |
| ZIP (audit pack) | **archiver** | `archiver@^8.0.0` |
| Spreadsheet import | SheetJS | `xlsx@^0.18.5` |
| Fuzzy search | Fuse.js | `fuse.js@^7.3.0` |
| Validation | Zod | `zod@^4.4.3` |
| Dates | date-fns | `date-fns@^4.2.1` |
| Tests | Jest + ts-jest + supertest | `jest@^30`, `ts-jest@^29`, `supertest@^7` |

> Note: `express-rate-limit` is a dependency but rate limiting is implemented as a **custom in-memory per-IP limiter** in `src/lib/rate-limit/index.ts`.

---

## 3. Architecture

### Route groups & surface separation
Next.js route groups separate the three surfaces (`src/app`):
- `(dashboard)/` → admin/staff pages, served at root paths (`/`, `/certificates`, `/suppliers`, …).
- `(supplier-portal)/` → supplier pages at root paths (`/dashboard`, `/my-certs`, `/upload`, `/required`).
- `buyer-portal/` → buyer pages (`/buyer-portal/...`).
- `(auth)/` → login/register/invite pages for all three surfaces.
- `api/` → all API routes.

### Auth model
| Surface | Mechanism | Cookie | Verified by |
|---|---|---|---|
| Admin / staff | NextAuth (Auth.js v5), **JWT session strategy** (no DB sessions) | `__Secure-authjs.session-token` (HTTPS) / `authjs.session-token` (HTTP) | `getSessionToken()` (`src/lib/auth/session-token.ts`) |
| Supplier | Stateless signed JWT (HS256, JOSE) | `rel_supplier_token` (httpOnly) | `verifySupplierToken()` |
| Buyer | Stateless signed JWT (HS256, JOSE) | `rel_buyer_token` (httpOnly) | `verifyBuyerToken()` |

- **NextAuth config** (`src/lib/auth/config.ts`): Credentials provider (username + password + optional OTP token); validates active user, bcrypt-verifies password, then enforces 2FA via OTP token if `two_factor_enabled`; JWT callback enriches token with `id`, `role`, `username`. Sign-in page `/login`.

### Request protection
1. **`src/middleware.ts`** runs first. It:
   - Allows `PUBLIC_ROUTES` (login pages, `/api/auth`, `/api/supplier-auth`, `/api/buyer-auth`, `/api/download`, `/api/pdf-requests`, `/api/cron`). **Exception:** `/api/auth/me` is explicitly *not* public.
   - Verifies supplier cookie for `/supplier/*` and `/api/supplier-certs`, injecting `x-supplier-id` / `x-supplier-email` headers.
   - Verifies buyer cookie for `/buyer-portal`, injecting `x-buyer-id` / `x-buyer-email`.
   - Lets supplier-portal pages (`/dashboard`, `/my-certs`, `/required`, `/upload`) self-authenticate.
   - For everything else (dashboard + admin APIs) requires a NextAuth session, injecting `x-user-id` / `x-user-role` / `x-user-name`.
2. **`requireAuth(req, [roles])`** (`src/lib/auth/middleware.ts`) re-checks the session inside each API route handler and enforces the allowed-roles array; returns 401/403 otherwise. `isAuthResult()` is the type guard used after it.

### CORS
In `src/middleware.ts`: credentialed CORS is granted **only** when `Origin === process.env.NEXT_PUBLIC_APP_URL` (never wildcard-with-credentials). Preflight `OPTIONS` on API routes returns 204 with CORS headers; allowed methods `GET, POST, PUT, DELETE, PATCH, OPTIONS`; `Vary: Origin`.

### Data-layer pattern
- All DB access goes through `src/lib/db/*.ts` modules using the **service-role admin client** (`src/lib/supabase/admin.ts`, a lazy singleton Proxy). Routes never write raw SQL — they call typed data-layer functions.
- Encryption/decryption of sensitive fields happens in the **application layer** (data-layer functions), not in the DB.
- `appendAuditLog()` is fire-and-forget (`setImmediate`) so audit writes never block responses.

---

## 4. Data Model (current schema)

Derived from `supabase/migrations/001`–`005` and `src/types/database.ts`. **15 tables.** All tables have RLS enabled with a permissive `service_role_all` policy; `audit_log` additionally has RESTRICTIVE no-update/no-delete policies **and** a trigger.

### Migrations
| Migration | Adds / changes |
|---|---|
| `001_initial_schema.sql` | Core 12 tables: `locations`, `categories`, `users`, `buyers`, `certificates`, `suppliers`, `supplier_required_certs`, `supplier_certs`, `audit_log`, `notification_log`, `pdf_requests`, `download_tokens`. RLS + `service_role_all`. Seeds 6 categories and the `hardik` admin user. |
| `002_two_factor.sql` | `users.two_factor_enabled` (bool); new `otp_codes` table (bcrypt `code_hash`, `expires_at`, `attempts`, `used`) + 2 indexes. |
| `003_buyer_accounts.sql` | Buyer accounts: adds `password_hash`, `email_hash`, `status` enum, `approved_by/at`, `last_login`, `visible_tags` to `buyers`; new `buyer_visits` table; indexes. |
| `004_renewal_docs_audit.sql` | `renewal_stage` enum on `certificates` and `supplier_certs`; new `cert_documents` table (multi-doc per cert); hardens `audit_log` to **append-only** via RESTRICTIVE RLS + `prevent_audit_log_mutation()` function + `trg_no_update_audit_log` / `trg_no_delete_audit_log` triggers. |
| `005_soft_delete.sql` | Soft-delete: adds `archived` / `archived_at` / `archived_by` (+ `certificates_archived_idx`) to **certificates only**. Suppliers reuse `status='inactive'`; locations reuse `active=false` (documented decision — no redundant columns). |

### Tables (final shape)
- **locations** — `id`, `name`, `address_line_1/2`, `city`, `state`, `pincode`, `country`(def 'India'), `active`(bool), timestamps. *Soft-delete via `active`.*
- **categories** — `id`, `name`(UNIQUE), `active`, timestamps. Seeds: Sustainability, Quality, Social Compliance, Environmental, Safety, Export Compliance.
- **users** — `id`, `username`(UNIQUE), `password_hash`, `display_name`, `email`, `role`(CHECK admin|staff), `active`, `two_factor_enabled`, `last_login`, `last_action`, timestamps.
- **buyers** — `id`, `name`, `company`, **`email`(🔒 AES-256)**, `email_hash`(SHA-256 lookup), `designation`, **`ip_address`(🔒)**, `geolocation`(jsonb), `password_hash`, `status`(CHECK pending|approved|rejected|suspended), `approved_by`→users, `approved_at`, `last_login`, `visible_tags`(jsonb), timestamps. Indexes on `email_hash`, `status`.
- **buyer_visits** — `id`, `buyer_id`→buyers (CASCADE), **`ip_address`(🔒)**, `geolocation`(jsonb), `path`, `user_agent`, `visited_at`. Indexes on `buyer_id`, `visited_at`.
- **certificates** — `id`, `name`, `cert_number`, `issuing_body`, `category`, `issue_date`, `expiry_date`(NOT NULL), `renewal_process_start_date`, `renewal_cost`(numeric 12,2), `renewal_stage`(CHECK not_started|in_progress|awaiting_issuer|renewed), `notes`, `location_id`→locations, `buyer_tags`(jsonb), `buyer_visible`(bool def true), `status`(CHECK active|expiring_soon|expired), **`archived`(bool def false)**, **`archived_at`**, **`archived_by`→users**, `version_history`(jsonb), `notification_log`(jsonb), `google_drive_file_id`, `submitted_by_supplier`(bool), `created_by`→users, timestamps. Indexes: expiry_date, status, location_id, archived.
- **suppliers** — `id`, `name`, `tier`(CHECK 1|2|3), `commodity_tags`(jsonb), address fields, `country`, `buyer_links`(jsonb), **`contacts`(jsonb — email/phone 🔒 per-contact)**, `required_cert_ids`(jsonb), `status`(CHECK onboarding|active|inactive|suspended), `onboarding_checklist`(jsonb, 5 bools), **`portal_login`(jsonb — all fields 🔒)**, `scorecard`(jsonb), timestamps. *Soft-delete via `status='inactive'`.*
- **supplier_required_certs** — `id`, `supplier_id`→suppliers (CASCADE, UNIQUE), `required_certs`(jsonb), timestamps. (1:1 with supplier.)
- **supplier_certs** — `id`, `supplier_id`→suppliers (CASCADE), `cert_name`, `cert_number`, `issuing_body`, `category`, `issue_date`, `expiry_date`(NOT NULL), `renewal_stage`(enum), `notes`, `location_id`→locations, `buyer_links`(jsonb), `status`(CHECK pending_review|approved|rejected|expired|expiring_soon), `submission_date`, `ocr_result`(jsonb), `review`(jsonb), `google_drive_file_id`, `version_history`(jsonb), `notification_log`(jsonb), timestamps. Indexes: supplier_id, status, expiry_date.
- **audit_log** *(APPEND-ONLY)* — `id`, `user_identifier`, `action_type`(NOT NULL), `target`, `detail`, `ip_address`, `timestamp`. Indexes: timestamp, action_type. **UPDATE/DELETE blocked** by RESTRICTIVE RLS policies (`no_update_audit_log`, `no_delete_audit_log`) **and** triggers `trg_no_update_audit_log` / `trg_no_delete_audit_log` → `prevent_audit_log_mutation()` (fires even for BYPASSRLS service_role).
- **notification_log** — `id`, `cert_id`, `cert_type`(CHECK internal|supplier), `recipient`, `subject`, `trigger_label`, `timestamp_sent`, `status`(CHECK sent|failed), `error_message`.
- **pdf_requests** — `id`, `cert_id`→certificates, `buyer_name`, `buyer_company`, **`buyer_email`(🔒)**, `cert_name`, `status`(CHECK pending|approved|denied|expired), `requested_at`, `reviewed_at`, `reviewer`, `comment`.
- **download_tokens** — `token`(PK), `cert_id`→certificates, **`buyer_email`(🔒)**, `created_at`, `expires_at`, `used`, `used_at`. Indexes: expires_at, used. (48-hour single-use links.)
- **otp_codes** — `id`, `user_id`→users (CASCADE), **`code_hash`(bcrypt)**, `expires_at`, `attempts`, `used`, `created_at`. Indexes: user_id, expires_at.
- **cert_documents** — `id`, `cert_id`→certificates (CASCADE), `cert_type`(CHECK internal|supplier), `doc_type`(CHECK certificate|test_report|scope_annex|other), `file_name`, `google_drive_file_id`, `uploaded_by`→users, `uploaded_at`. Index: cert_id.

🔒 = AES-256-CBC ciphertext at rest (decrypted in the app layer). `otp_codes.code_hash` and all `password_hash` columns are one-way **bcrypt** hashes.

---

## 5. Feature Catalogue

Status legend: **WORKING** (verified in code + tests) · **PARTIAL** (works but degraded) · **KNOWN-ISSUE** (currently blocked — see §9).

### Internal certificate tracking
| Feature | Pages | API | Data layer | Roles | Status |
|---|---|---|---|---|---|
| Dashboard + action queue + annual cost | `/` | — | `getActionQueue()` (`db/action-queue.ts`) | admin/staff | WORKING |
| Certificate CRUD | `/certificates`, `/certificates/new`, `/certificates/[id]`, `/edit` | `GET/POST /api/certificates`, `GET/PUT/DELETE /api/certificates/[id]` | `getCertificates`, `getCertificateById`, `createCertificate`, `updateCertificate`, `deleteCertificate` | read admin/staff/guest; write admin/staff; delete admin | WORKING |
| Archive / soft-delete + Archived view + Restore | cert detail `Archive` btn, list `?archived=true` | `PATCH /api/certificates/[id]` `{action:'archive'\|'unarchive'}` | `archiveCertificate` (forces `buyer_visible=false`), `unarchiveCertificate`; `getCertificates` excludes archived by default | admin/staff | WORKING (v1.1.1) |
| Renewal + version history | cert detail | `POST /api/certificates/[id]/renew` | `renewCertificate` (snapshots into `version_history`) | admin/staff | WORKING |
| Renewal stage workflow (not_started→in_progress→awaiting_issuer→renewed) | cert detail (`RenewalStageControl`), list | `PUT /api/certificates/[id]` `{renewal_stage}` | `updateCertificate` | admin/staff | WORKING |
| Renewal workload (90-day buckets + cost) | `/renewal-workload` | — | `getCertificates` + `bucketRenewals`/`bucketCost` (`lib/renewal-workload.ts`) | admin/staff | WORKING |
| Categories (create / deactivate) | `/settings` | `GET/POST/PUT /api/categories` | `getCategories`, `createCategory`, `deactivateCategory` | read all; write admin | WORKING (deactivate UI v1.1.1) |
| Calendar | `/calendar` (`CalendarClient`) | — | `getCertificates` | admin/staff | WORKING |
| Global search | header `SearchBox` | `GET /api/search` | `globalSearch()` (certificates + suppliers + locations; `db/search.ts`) | admin/staff | WORKING |
| Bulk import (CSV/XLSX preview+import) | `/bulk-import` | `GET/POST /api/bulk-import` | xlsx + `createCertificate` | template public; import admin/staff | WORKING |
| Audit-readiness PDF export | `/audit-pack` | `GET /api/audit-report` | `lib/pdf-generator/audit-report.ts` (jsPDF) | admin/staff | WORKING |
| Audit trail (append-only) | `/audit-log` | `GET /api/audit-log`, `GET /api/audit-log/export` | `appendAuditLog`, `getAuditLog`, `exportAuditLogCsv` | admin | WORKING |

### Documents
| Feature | Pages | API | Data layer | Roles | Status |
|---|---|---|---|---|---|
| Multiple typed documents per cert | `/certificates/[id]/upload-pdf` | `POST /api/certificates/[id]/upload-pdf` | `createCertDocument`, `getCertDocuments` (`db/cert-documents.ts`) | admin/staff | WORKING |
| Google Drive storage + versioning | — | upload routes | `lib/google-drive`: `uploadFile`, `getCertFolderStructure`, `getSupplierFolderStructure`, `renameFile`, `getOrCreateFolder`, `generateDownloadLink` | service account | WORKING (requires Drive creds) |
| Buyer PDF request → approve/deny → 48h link | buyer portal `RequestPdfButton`, `/pdf-requests` | `POST /api/pdf-requests`, `POST /api/pdf-requests/[id]/approve\|deny`, `GET /api/download/[token]` | `createPdfRequest`, `getPdfRequests`, `approve/denyPdfRequest`, `createDownloadToken` (48h), `validateAndUseToken` | request public; review token-gated; list admin/staff | WORKING (approval email delivery blocked — see §9) |

### Access & users
| Feature | Pages | API | Data layer | Roles | Status |
|---|---|---|---|---|---|
| Roles admin/staff/guest | — | `requireAuth` | — | — | WORKING |
| Staff user management + active toggle | `/users` (`UserActiveToggle`) | `GET/POST /api/users`, `PUT/DELETE /api/users/[id]` | `getUsers`, `createUser` (bcrypt 12), `updateUser`, `deactivateUser`, `reactivateUser` | admin | WORKING |
| 2FA (email OTP) | `/settings` | `GET/PATCH /api/users/me/2fa`, `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` | `setTwoFactor`, `createOtp` (6-digit, 10-min TTL, bcrypt-10, max 5 attempts), `verifyOtp` | self | WORKING logic; OTP email delivery blocked — see §9 |

### Locations
| Feature | Pages | API | Data layer | Roles | Status |
|---|---|---|---|---|---|
| Address master + cert↔location + filter | `/locations`, cert form dropdown | `GET/POST /api/locations`, `PUT/PATCH/DELETE /api/locations/[id]` | `getLocations`, `getLocationById`, `createLocation`, `updateLocation`, `getCertCountByLocation` | read all; write admin | WORKING |
| Deactivate / reactivate (keeps cert refs) | `/locations` (`LocationActiveControl`) | `PATCH /api/locations/[id]` `{action:'deactivate'\|'reactivate'}` | `deactivateLocation`, `reactivateLocation` | admin | WORKING (v1.1.1) |
| Buyer "by location" view | `/buyer-portal/certificates/by-location` | — | `getBuyerVisibleCertificates` | buyer | WORKING |

### Suppliers
| Feature | Pages | API | Data layer | Roles | Status |
|---|---|---|---|---|---|
| Supplier master (tier/commodity/contacts 🔒) | `/suppliers`, `/suppliers/[id]` | `GET/POST /api/suppliers`, `GET/PUT/PATCH/DELETE /api/suppliers/[id]` | `getSuppliers`, `getSupplierById`, `createSupplier`, `updateSupplier` (contacts encrypted) | read/write admin/staff; archive/delete admin | WORKING |
| Supplier portal (invite-only, isolated) | `/dashboard`, `/my-certs`, `/upload`, `/required` | `POST /api/supplier-auth/login`, `/accept-invite`, `POST /api/suppliers/[id]/invite` | `sendPortalInvite`, supplier JWT | supplier | WORKING (invite email delivery blocked — see §9) |
| Cert upload + Claude OCR cross-check | `/upload` | `POST /api/supplier-certs`, `POST /api/supplier-certs/[id]/ocr` | `createSupplierCert`, `extractCertFields`/`compareCertFields` (`lib/ocr`), `saveOcrResult` | supplier upload; OCR admin/staff | **KNOWN-ISSUE** — OCR auto-verify returns 401 (invalid Anthropic key); upload + manual review unaffected |
| Review queue (approve/reject) | `/review-queue` | `PATCH /api/supplier-certs/[id]` | `getPendingReviewQueue` (excludes inactive suppliers), `updateSupplierCertStatus` | admin/staff | WORKING |
| Scorecards (computed on_time_rate) | `/suppliers/[id]` | — | `getSupplierScorecard` (40% compliance + 30% quality + 30% on-time) | admin/staff | WORKING |
| Required certs | `/suppliers/[id]`, `/required` | — | `required_cert_ids` / `supplier_required_certs` | admin/staff/supplier | WORKING |
| Supplier renewal reminders | cron | `GET /api/cron/notifications` | `getExpiringSupplierCerts`, `sendSupplierExpiryReminder` | CRON_SECRET | WORKING logic; email delivery blocked — see §9 |
| Supplier archive / reactivate | `/suppliers` + detail (`SupplierArchiveControl`) | `PATCH /api/suppliers/[id]` `{action:'archive'\|'reactivate'}` | `archiveSupplier` (status=inactive), `reactivateSupplier` | admin | WORKING (v1.1.1) |
| Bulk supplier onboarding | `/bulk-import/suppliers` | `GET/POST /api/bulk-import/suppliers` | xlsx + `createSupplier` | template public; import admin/staff | WORKING |
| Buyer audit pack PDF | `/audit-pack` | `GET /api/audit-pack/generate` | `lib/pdf-generator/supplier-audit-pack.ts` (jsPDF + archiver) | admin/staff | WORKING |

### Buyers
| Feature | Pages | API | Data layer | Roles | Status |
|---|---|---|---|---|---|
| Admin-approved registration | `/buyer/register`, `/buyer/set-password`, `/buyer-activity` | `POST /api/buyer-auth/register`, `/set-password`, `POST /api/buyers/[id]/approve` | `registerBuyer`, `approveBuyer` (7-day set-password JWT), `setBuyerPassword` | register public; approve admin | WORKING (approval/set-password email delivery blocked — see §9) |
| Visit log | `/buyer-activity` | `GET /api/buyers/[id]/visits` | `logBuyerVisit`, `getBuyerVisits` | admin | WORKING |
| Visibility controls (visible_tags) | `/buyer-activity` | `PATCH /api/buyers/[id]` | `setBuyerVisibleTags` | admin | WORKING |
| Suspend / reject / reactivate (UI) | `/buyer-activity` (`BuyerActivityClient`, confirm dialogs) | `POST /api/buyers/[id]/suspend\|reject\|approve` | `suspendBuyer`, `rejectBuyer`, `approveBuyer` (reactivate = re-approve) | admin | WORKING (v1.1.1) |
| Buyer portal (only buyer_visible, non-supplier, non-archived) | `/buyer-portal/*` | `POST /api/buyer-auth/login` | `getBuyerVisibleCertificates` (`buyer_visible=true AND submitted_by_supplier=false AND archived=false`); suspended/non-approved blocked at login (403) | buyer | WORKING |

### Notifications
| Feature | API | Data layer | Status |
|---|---|---|---|
| Expiry emails 60/30/15/7 + delivery log | `GET /api/cron/notifications` | `getExpiringSoon`, `sendCertExpiryReminder`, `logNotification` | WORKING logic; delivery blocked — see §9 |
| Weekly digest cron | `GET /api/cron/digest` | `sendWeeklyDigest` | WORKING logic; delivery blocked — see §9 |
| Manual trigger | `POST /api/cron/notifications` / `digest` (admin) | same | WORKING (admin-gated) |

### Backup
| Feature | API | Library | Roles | Status |
|---|---|---|---|---|
| Full DB ZIP export (passwords stripped) | `GET /api/backup` | **fflate** `zipSync` | admin (rate-limited 1/hr) | WORKING |

### Security (implemented)
- httpOnly + `SameSite=strict` cookies for supplier/buyer JWTs; NextAuth encrypted session cookie.
- **AES-256-CBC** field encryption at rest (`lib/encryption`): random 16-byte IV, format `<iv-hex>:<ciphertext>`, key from `ENCRYPTION_KEY` (≥32 chars). Returns `null` on decrypt failure.
- bcrypt password hashing (users **12 rounds**; OTP codes **10 rounds**).
- Custom per-IP rate limiting (`lib/rate-limit`): `loginLimiter` 5/15min, `backupLimiter` 1/hr, `ocrLimiter` 20/hr, `downloadLimiter` 10/min, `adminLimiter` 100/15min → 429 + `Retry-After`.
- Supplier/buyer isolation (separate JWT cookies, middleware-injected ids, ownership checks).
- Download-token expiry enforced **in the DB query**; single-use (`used` flag).
- Append-only `audit_log` (RESTRICTIVE RLS + trigger).
- Strict-origin CORS (no wildcard-with-credentials).
- Secret-length validation (NEXTAUTH_SECRET / ENCRYPTION_KEY ≥32).
- `sanitiseError()` (`lib/security/sanitise-error.ts`) scrubs API keys, PEM keys, JWTs, and secrets from error output and strips stack traces; all API error responses return generic messages.

---

## 6. API Reference

Roles: **A**=admin, **S**=staff, **G**=guest(read), **Sup**=supplier JWT, **Buyer**=buyer JWT, **Token**=signed/one-time token, **Cron**=CRON_SECRET, **Public**=no auth.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET/POST | `/api/certificates` | A/S/G (GET), A/S (POST) | List / create internal certs |
| GET | `/api/certificates/[id]` | A/S/G | Get cert (guest only if buyer_visible) |
| PUT | `/api/certificates/[id]` | A/S | Update cert (incl. renewal_stage) |
| PATCH | `/api/certificates/[id]` | A/S | Archive / unarchive |
| DELETE | `/api/certificates/[id]` | A | Hard delete |
| POST | `/api/certificates/[id]/renew` | A/S | Renew (version snapshot) |
| POST | `/api/certificates/[id]/upload-pdf` | A/S | Upload typed document(s) to Drive |
| GET/POST | `/api/suppliers` | A/S | List / create suppliers |
| GET/PUT | `/api/suppliers/[id]` | A/S | Get (with scorecard) / update |
| PATCH | `/api/suppliers/[id]` | A | Archive / reactivate |
| DELETE | `/api/suppliers/[id]` | A | Deactivate (status=inactive) |
| POST | `/api/suppliers/[id]/invite` | A | Send supplier portal invite |
| GET | `/api/supplier-certs` | A/S | List / pending review queue |
| POST | `/api/supplier-certs` | Sup | Supplier uploads a cert |
| GET | `/api/supplier-certs/[id]` | A/S/Sup | Get (ownership-checked for supplier) |
| PUT/PATCH | `/api/supplier-certs/[id]` | A/S | Update / approve-reject |
| POST | `/api/supplier-certs/[id]/ocr` | A/S | Run Claude OCR cross-check |
| GET/POST | `/api/locations` | A/S/G (GET), A (POST) | List / create locations |
| PUT/PATCH/DELETE | `/api/locations/[id]` | A | Update / deactivate-reactivate / delete-or-deactivate |
| GET/POST/PUT | `/api/categories` | A/S/G (GET), A (POST/PUT) | List / create / deactivate |
| GET/POST | `/api/users` | A | List / create staff users |
| PUT/DELETE | `/api/users/[id]` | A | Update / deactivate user |
| GET/PATCH/POST | `/api/users/me/2fa`, `/me/password` | A/S (self) | 2FA status/toggle; change password |
| GET | `/api/buyers` | A | List buyers (status filter) |
| GET/PATCH | `/api/buyers/[id]` | A | Get / set visible_tags |
| POST | `/api/buyers/[id]/approve\|reject\|suspend` | A | Buyer lifecycle transitions |
| GET | `/api/buyers/[id]/visits` | A | Buyer visit log |
| GET | `/api/search` | A/S | Global search (certs/suppliers/locations) |
| GET | `/api/audit-log` | A | Paginated audit log |
| GET | `/api/audit-log/export` | A | CSV export (rate-limited) |
| GET | `/api/pdf-requests` | A/S | List buyer PDF requests |
| POST | `/api/pdf-requests` | Public | Buyer submits PDF request |
| POST | `/api/pdf-requests/[id]/approve\|deny` | Token | Approve/deny via emailed link |
| GET | `/api/download/[token]` | Token (one-time, 48h) | Download approved cert PDF |
| GET/POST | `/api/bulk-import` | Public (GET template), A/S (POST) | Cert import template / import |
| GET/POST | `/api/bulk-import/suppliers` | Public (GET), A/S (POST) | Supplier import template / import |
| GET | `/api/backup` | A | Full DB ZIP backup (fflate) |
| GET | `/api/audit-report` | A/S | Certificates audit PDF |
| GET | `/api/audit-pack/generate` | A/S | Supplier audit pack PDF by buyer |
| GET | `/api/cron/notifications` | Cron | Expiry reminders (REL + suppliers) |
| POST | `/api/cron/notifications` | A | Manual trigger |
| GET | `/api/cron/digest` | Cron | Weekly digest |
| POST | `/api/cron/digest` | A | Manual trigger |
| POST | `/api/auth/[...nextauth]` | NextAuth | Login/session/callback |
| GET | `/api/auth/me` | Session (A/S) | Current user (reads injected headers; **not** public) |
| POST | `/api/auth/logout` | Public | Clear all session/portal cookies |
| POST | `/api/auth/otp/request` | Public (rate-limited) | Request 2FA OTP after password check |
| POST | `/api/auth/otp/verify` | Public | Verify OTP → OTP token |
| POST | `/api/buyer-auth/login\|register\|set-password\|logout` | Public / rate-limited / token | Buyer auth flows |
| POST | `/api/supplier-auth/login\|accept-invite` | Public / token | Supplier auth flows |

---

## 7. Cron Jobs

Defined in `vercel.json` (UTC schedules; IST = UTC+5:30). Both have `maxDuration: 60`.

| Path | Schedule (UTC) | IST equivalent | Does | Secured by |
|---|---|---|---|---|
| `/api/cron/notifications` | `30 2 * * *` (daily 02:30) | **08:00 IST daily** | Sends cert-expiry reminders to REL (60/30/15/7-day) and supplier renewal reminders; logs to `notification_log` | `CRON_SECRET` (Bearer); route returns 401 without it. POST manual-trigger requires admin session. |
| `/api/cron/digest` | `30 2 * * 1` (Mon 02:30) | **08:00 IST Monday** | Sends weekly compliance digest email to REL admin | `CRON_SECRET`; POST manual-trigger admin-only |

---

## 8. Environment Variables

Names + purpose only (from `.env.example`). **Never commit values.**

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public app URL; also the sole allowed CORS origin |
| `NODE_ENV` | Runtime environment |
| `NEXTAUTH_URL` | Canonical URL for NextAuth (must match app URL in prod) |
| `NEXTAUTH_SECRET` | NextAuth JWT signing/encryption secret (≥32 chars); also signs supplier/buyer JWTs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client/SSR) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only; all DB writes) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Drive service-account identity |
| `GOOGLE_PRIVATE_KEY` | Service-account private key (PEM; `\n` escaped) |
| `GOOGLE_DRIVE_FOLDER_ID` | Root Drive folder for stored PDFs |
| `RESEND_API_KEY` | Resend email API key |
| `EMAIL_FROM` | From address for all outbound mail (`noreply@raghuvirexim.com`) |
| `NOTIFICATION_EMAIL` | Recipient for cert-expiry / digest notifications |
| `PDF_APPROVER_EMAIL` | Recipient for buyer PDF approval-request emails |
| `ANTHROPIC_API_KEY` | Claude API key for supplier-cert OCR |
| `ENCRYPTION_KEY` | AES-256 field-encryption key (≥32 chars) |
| `CRON_SECRET` | Bearer secret authorizing Vercel cron calls |

---

## 9. Known Issues / Outstanding Items

*Live state verified during this audit (2026-06-05).*

- ✅ **Migration 005 — APPLIED.** Verified live against project `abukmlkcnrdsphoyedsx`: `certificates` has `archived`, `archived_at`, `archived_by`. `getCertificates` runs without error against the live DB. **No longer a blocker.**

- 🔴 **Resend domain `raghuvirexim.com` NOT verified — ALL outbound email currently fails.** Live Resend API check returns `status: "not_started"` (created 2026-06-01, region ap-northeast-1). Until the domain is verified in Resend, every email sent from `noreply@raghuvirexim.com` will fail to deliver. **Affected:** cert-expiry reminders, weekly digest, supplier portal invites, supplier renewal reminders, buyer registration notifications, buyer approval / set-password links, 2FA OTP codes, PDF approval-request + download-link emails. The in-app flows and `notification_log` records still work; only delivery is blocked. **Action:** verify the sending domain (add DNS records) in the Resend dashboard, or temporarily switch `EMAIL_FROM` to a Resend-verified address.

- 🟠 **`ANTHROPIC_API_KEY` returns 401 — OCR auto-verify degraded.** Live check: `POST /v1/messages` → `401 authentication_error: invalid x-api-key`. Supplier-cert **automatic OCR cross-check is non-functional**; cert upload and **manual review are unaffected** (reviewers can still approve/reject without OCR assistance). **Action:** replace `ANTHROPIC_API_KEY` with a valid key in Vercel env.

- 🟢 **`/api/auth/me`** — previously shadowed by the `/api/auth` public prefix (fixed in v1.1.0). `src/middleware.ts` now explicitly excludes `/api/auth/me` from public routes, so it receives the injected session headers and behaves correctly. No action needed.

- ℹ️ **Live smoke checks (2026-06-05):** production root `/` → **HTTP 307** (redirect to `/login`, expected); `/api/cron/notifications` without secret → **HTTP 401** (expected); `/api/cron/digest` without secret → **HTTP 401** (expected). Production is healthy.

- ℹ️ **Soft-delete schema asymmetry (by design):** only `certificates` has dedicated `archived` columns; suppliers reuse `status='inactive'` and locations reuse `active=false`. Documented in `005_soft_delete.sql`; not a defect.

**Net blockers to fix for full operation:** (1) verify the Resend domain, (2) install a valid Anthropic API key.

---

## 10. How to Work on This App (runbook)

- **Working directory:** `/Users/hardikagarwal/Downloads/rel-cert-tracker` only. Never touch `~/Downloads/OLD_prototypes_DO_NOT_USE`.
- **Dev:** `npm run dev` (Next dev server).
- **Test:** `npx jest --coverage` (24 suites / 215 tests; thresholds lines 70 / functions 70 / branches 60 — currently ~80% lines).
- **Typecheck / lint / build:** `npx tsc --noEmit` · `npm run lint` · `npm run build`. These four gates must all pass before shipping.
- **Deploy:** commit → `git push origin main` → `vercel --prod` (project is linked; Git user "Hardik Agarwal"). The canonical alias is `https://rel-cert-tracker.vercel.app`.
- **Migrations:** files in `supabase/migrations/NNN_*.sql` **do NOT auto-run**. Apply them manually — either the Supabase SQL editor, or `supabase db query --linked -f supabase/migrations/NNN_*.sql` (the project is linked via the Supabase CLI). Do **not** use `supabase db push` — 001–004 were applied manually and aren't in the CLI migration history, so a push would try to re-run them.
- **Versioning:** semantic `MAJOR.MINOR.PATCH`. Keep `package.json` `version`, `src/lib/version.ts` (`APP_VERSION`, `VERSION_DATE`), the three portal footers (they render `v{APP_VERSION}`), and a `CHANGELOG.md` section in sync on every release.

---

## 11. Project History Reference

The full design/build history of this app lives in the **Claude.ai project conversations** — the planning sessions and instruction files (roughly 00–15) plus the test prompts that drove each milestone. This `APP_REFERENCE.md` is the **fast path** to understanding the app as it stands today; those chat histories are the **deep archive** for rationale and intent.

A future Claude session with access to that project's past conversations can reconstruct deeper "why" context by searching them (e.g. for a specific instruction number, feature name, or migration). Notable milestones reflected in `CHANGELOG.md`: **v1.0.0** initial release (21 modules), **v1.1.0** (Add-Cert UI, PDF upload, renewal stages, action queue, multi-docs, weekly digest, auth fixes), **v1.1.1** (soft-delete/archive across certificates/suppliers/locations + buyer suspend/reject/reactivate + category deactivate UI).
