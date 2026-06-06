// ════════════════════════════════════════════════════════════════════════════
// Central permission model — the SINGLE source of truth for what each role may
// do. Every API route (via requireCap) and every UI control imports from here;
// no role-string checks should be scattered elsewhere.
//
// This module is PURE (no next/server imports) so it is safe to import in both
// server routes and client components.
// ════════════════════════════════════════════════════════════════════════════

export type Role = 'admin' | 'manager' | 'staff' | 'viewer';

// The four real tiers, highest-privilege first.
export const ROLES: Role[] = ['admin', 'manager', 'staff', 'viewer'];

export type Capability =
  | 'VIEW_DATA'              // see lists/detail/reports (read-only)
  | 'ADD_ENTITY'             // create certificate / supplier / location
  | 'EDIT_ENTITY'           // edit a certificate / supplier / location, supplier invite
  | 'ARCHIVE_ENTITY'        // archive / deactivate / reactivate
  | 'RENEW_CERT'            // renew a certificate (version snapshot)
  | 'ADD_DOCS'             // upload documents to a certificate
  | 'BULK_IMPORT'          // bulk import certs / suppliers
  | 'MANAGE_BUYERS'        // approve / reject / suspend buyers, visibility, visits
  | 'REVIEW_SUPPLIER_CERTS' // approve / reject supplier-submitted certs
  | 'MANAGE_USERS'         // list users, deactivate, reset password, update
  | 'CREATE_USER'          // create a user (target role limited by hierarchy)
  | 'VIEW_AUDIT_LOG'       // audit trail (view + export) — admin only
  | 'SETTINGS'             // settings page ops: categories, cron trigger — admin only
  | 'BACKUP'               // full DB backup export — admin only
  | 'HARD_DELETE';         // permanent delete — admin only

// 'guest' is a legacy read-only marker some GET routes still accept; it is not a
// real user tier (no user row ever has it) but is preserved for VIEW_DATA.
type RoleOrGuest = Role | 'guest';

const MATRIX: Record<Capability, RoleOrGuest[]> = {
  VIEW_DATA:              ['admin', 'manager', 'staff', 'viewer', 'guest'],
  ADD_ENTITY:            ['admin', 'manager', 'staff'],
  EDIT_ENTITY:           ['admin', 'manager'],
  ARCHIVE_ENTITY:        ['admin', 'manager'],
  RENEW_CERT:            ['admin', 'manager'],
  ADD_DOCS:              ['admin', 'manager', 'staff'],
  BULK_IMPORT:           ['admin', 'manager', 'staff'],
  MANAGE_BUYERS:         ['admin', 'manager'],
  REVIEW_SUPPLIER_CERTS: ['admin', 'manager'],
  MANAGE_USERS:          ['admin', 'manager'],
  CREATE_USER:           ['admin', 'manager'],
  VIEW_AUDIT_LOG:        ['admin'],
  SETTINGS:              ['admin'],
  BACKUP:                ['admin'],
  HARD_DELETE:           ['admin'],
};

/** Does `role` have `capability`? Unknown/empty role → false. */
export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (MATRIX[capability] ?? []).includes(role as RoleOrGuest);
}

/**
 * Role-hierarchy guard for user creation / role assignment.
 *   admin   → may assign any role (admin, manager, staff, viewer)
 *   manager → may assign staff or viewer ONLY (never admin/manager)
 *   staff/viewer → may assign nothing
 */
export function assignableRoles(creatorRole: string | null | undefined): Role[] {
  if (creatorRole === 'admin') return ['admin', 'manager', 'staff', 'viewer'];
  if (creatorRole === 'manager') return ['staff', 'viewer'];
  return [];
}

/** Can `creatorRole` create/assign a user of `targetRole`? */
export function canAssignRole(creatorRole: string | null | undefined, targetRole: string): boolean {
  return assignableRoles(creatorRole).includes(targetRole as Role);
}

/**
 * Can `actorRole` act on (deactivate / reset / edit) a user whose role is
 * `targetRole`? A manager may only manage staff/viewer accounts — never an
 * admin or another manager. Admin may manage anyone.
 */
export function canManageUser(actorRole: string | null | undefined, targetRole: string | null | undefined): boolean {
  if (actorRole === 'admin') return true;
  if (actorRole === 'manager') return targetRole === 'staff' || targetRole === 'viewer';
  return false;
}

export function isRole(value: string | null | undefined): value is Role {
  return value === 'admin' || value === 'manager' || value === 'staff' || value === 'viewer';
}
