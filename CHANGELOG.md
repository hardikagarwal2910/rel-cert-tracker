# Changelog

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
