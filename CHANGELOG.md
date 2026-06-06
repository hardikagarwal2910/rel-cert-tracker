# Changelog

## v1.1.8 — 2026-06-06

### Fixed
- **PDF upload — final fix.** After the Shared-Drive flags (v1.1.7), uploads failed with `Cannot read properties of undefined (reading 'from')`: `uploadFile` used `const { Readable } = await import('stream')`, but Vercel's serverless bundling left the named `Readable` export undefined at runtime. Replaced with a static `import { Readable } from 'node:stream'`. The complete upload mechanism (folder get-or-create + streamed file create, all Shared-Drive aware) is now verified end-to-end against the live Drive folder.

## v1.1.7 — 2026-06-06

### Fixed
- **PDF document upload now works** (completes the v1.1.6 fix). After the Google service-account credentials were rotated, uploads still failed in production with `File not found: <folder id>`. Root cause: the target Drive folder lives in a **Shared Drive**, but the app's Google Drive calls didn't pass the shared-drive flags, so Drive v3 reported the folder as not found. All `files.*` calls in `src/lib/google-drive/index.ts` now pass `supportsAllDrives: true` (and `includeItemsFromAllDrives: true` for list). Verified end-to-end against the live Shared Drive folder.

## v1.1.6 — 2026-06-05

### Fixed
- **Diagnosed the "An internal error occurred" failure on PDF document upload** (failed for everyone, admin included). Root cause is **not** code or permissions: the Google Cloud **service account credentials are invalid** — the OAuth token exchange returns `invalid_grant: account not found`, i.e. the service account behind `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY` has been deleted/revoked. **Owner action required** (regenerate the service account + key in Google Cloud, re-share the Drive folder as Editor, update the env vars in Vercel and `.env.local`).
- The upload route previously swallowed the real error in a bare `catch {}` (no server log), so failures were undiagnosable. It now logs the real (sanitised) error server-side while still returning a safe message to the client.

### Added
- **Staff add-permissions.** Staff users may now **add** locations and suppliers (previously `POST /api/locations` was admin-only, which is why staff "couldn't add an address"). Editing, deactivating, and archiving locations/suppliers remain **admin-only** — enforced at the API (staff get 403) and reflected in the UI (staff don't see Edit/Deactivate/Archive controls).
- **Attach a PDF while creating a certificate.** The new-certificate form now has an optional PDF picker + document-type selector. On submit the cert is created and the document uploaded in one step. If the upload fails (e.g. while the Drive credentials are being fixed), the certificate is **still saved** and the user is told to upload the document from the certificate page — the cert is never lost. The existing post-creation upload page continues to work.

## v1.1.4 — 2026-06-05

> Delivers the "Add User UI + missing-UI-control sweep" scope (originally drafted as v1.1.2). Versioned 1.1.4 to stay above the already-shipped v1.1.3 rather than regress the public version.

### Added
- **Add Staff User UI.** The Users page now has a "New Staff User" button + create form (username, display name, email, password, active). Role is fixed to `staff` — the form cannot create an admin (the API also hard-codes `role: 'staff'`). Duplicate usernames are rejected with a clear message.
- **Admin password reset.** Each user row has a "Reset password" action that sets a new temporary password (reuses the existing user-update path), audit-logged as `user.password_reset` — lets the owner re-issue credentials without email while the Resend domain is unverified.
- **Add Supplier (single).** "New Supplier" button + form on the Suppliers page wired to `POST /api/suppliers` (name, tier, commodity tags, address, contacts, notes) — previously only bulk onboarding existed.
- **Edit Supplier.** Edit form on the supplier detail page wired to `PUT /api/suppliers/[id]` (name, tier, commodity tags, address, contacts) — supplier fields were previously not editable from the UI.
- **Renew Certificate.** "Renew" control on the certificate detail page wired to `POST /api/certificates/[id]/renew`, which snapshots the prior values into version history (distinct from Edit, which does not version).

### Fixed
- `POST /api/users` previously sent a `name` field that doesn't exist on the `users` table (column is `display_name`), so staff creation would have failed — corrected to `display_name`, and a pre-check now returns a clear 409 on duplicate usernames.
- Supplier create/update API schemas now accept the address fields (line 1/2, city, state, pincode, country) so the new supplier forms can persist a full address.

## v1.1.3 — 2026-06-05

### Added
- **Location nickname / internal label.** Locations now have a short human label (e.g. "Shilaj Unit", "Towel Plant", "Head Office") shown everywhere a location appears. A single app-wide helper (`src/lib/location-label.ts`) renders the label consistently as `Nickname — City`, falling back to `Company — City` when no nickname is set, so two same-company sites are always distinguishable.
- **Locations detail page** (`/locations/[id]`) showing the complete record: nickname, company name, full multi-line address, country, active status, and how many certificates use it — with an inline Edit form.

### Fixed
- **Location address was never displayed and locations were indistinguishable.** Multiple sites all stored under the company name "Raghuvir Exim Limited" now show their nickname + full address on the Locations list, the location detail page, and the certificate detail page. The certificate location dropdown (create + edit) now reads e.g. "Shilaj Unit — Ahmedabad" instead of repeating the company name. The location edit form also now persists the full address (previously the address fields could not be edited).

### Notes
- Migration `006_location_nickname.sql` must be run manually in the Supabase SQL editor (it does not auto-run). It adds a nullable `nickname` column to `locations` (`IF NOT EXISTS`, safe to run). `name` remains the legal/company entity name (may repeat); `nickname` is the distinguishing internal label.

## v1.1.1 — 2026-06-05

### Added
- Soft-delete / archive controls surfaced in the UI (no hard deletes of real records — compliance data stays retrievable):
  - **Certificates**: Archive button on the cert detail page (reversible, muted styling) and an **Archived** view on the certificates list with a per-row **Restore** action. Archiving a cert also forces `buyer_visible=false` so it immediately drops out of every buyer view. Archived certs are excluded from the default list, calendar, renewal workload, action queue, and all buyer-facing reads.
  - **Suppliers**: Archive / Deactivate and Reactivate actions on the supplier detail page and list. Inactive suppliers are hidden from the default list and from supplier-cert review prompts.
  - **Locations**: Deactivate / Reactivate actions on the Locations page (with an "N certificates use this location" note). Deactivated locations drop out of the cert-form dropdown but existing certs keep their reference and still display the name.
  - **Categories**: Deactivate action in Settings category management; deactivated categories drop from the new-cert dropdown but remain on existing certs.

### Fixed
- Buyer Activity page now exposes the full buyer lifecycle in the UI: Pending → Approve/Reject, Approved → Suspend, Suspended → Reactivate — each behind a confirmation step and audit-logged. (Suspended buyers were already blocked at login server-side; confirmed it still holds.)

### Notes
- Migration `005_soft_delete.sql` must be run manually in the Supabase SQL editor (it does not auto-run). It adds `archived` / `archived_at` / `archived_by` to `certificates`. Suppliers reuse the existing `status` enum (`inactive`) and locations reuse the existing `active` flag — no redundant columns added there.

## v1.1.0 — 2026-05-30

### Fixed
- Add Certificate UI: full create form on the Certificates page and a working Edit form on the cert detail page (the `/edit` link was dead).
- PDF Upload page: cert detail now has a working PDF upload UI (the route 404'd before); supports document types.
- Backup 500: diagnosed and fixed the admin backup ZIP export.
- Logout: now properly invalidates the NextAuth session and redirects to `/login` (was landing on raw JSON); clears supplier/buyer cookies too.
- Buyer portal: confirmed real routes under `/buyer-portal/*`, added a landing page, and locked in the buyer-visibility security check.
- `/api/auth/me`: no longer always-401 (was shadowed by the `/api/auth` public prefix).

### Added
- Renewal stage workflow (`not_started` → `in_progress` → `awaiting_issuer` → `renewed`) on certificates and supplier certs, surfaced on list, workload, and detail.
- Action Queue panel on the dashboard — prioritised "what needs attention".
- Multiple documents per certificate (`cert_documents`): typed supporting docs alongside the primary certificate.
- Weekly email digest cron (`/api/cron/digest`).

### Changed
- Cert detail page reordered to lead with status + next action; location shown by name; version history surfaced.
- Certificates list: denser, sortable, location filter + missing-location warning badge.
- Locations list: certificate count column.
- Users page: active/inactive toggle.
- Audit Log: action-type / date / user filters.
- Distinct header styling per surface (admin / supplier / buyer).
- Hardened `audit_log` append-only RLS to `RESTRICTIVE`.

## v1.0.0 — 2026-05-30
- Initial release: 21 modules, deployed to Vercel.
