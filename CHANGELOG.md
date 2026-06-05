# Changelog

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
