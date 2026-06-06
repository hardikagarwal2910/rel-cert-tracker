/**
 * v1.2.0 — four-tier permission model (pure matrix + hierarchy helpers).
 */
import { can, assignableRoles, canAssignRole, canManageUser } from '@/lib/auth/permissions';

describe('can() — capability matrix', () => {
  it('VIEW_DATA: all four roles (incl. viewer)', () => {
    for (const r of ['admin', 'manager', 'staff', 'viewer']) expect(can(r, 'VIEW_DATA')).toBe(true);
  });

  it('ADD_ENTITY: admin/manager/staff yes, viewer no', () => {
    expect(can('admin', 'ADD_ENTITY')).toBe(true);
    expect(can('manager', 'ADD_ENTITY')).toBe(true);
    expect(can('staff', 'ADD_ENTITY')).toBe(true);
    expect(can('viewer', 'ADD_ENTITY')).toBe(false);
  });

  it('EDIT/ARCHIVE/RENEW: admin/manager only', () => {
    for (const cap of ['EDIT_ENTITY', 'ARCHIVE_ENTITY', 'RENEW_CERT'] as const) {
      expect(can('admin', cap)).toBe(true);
      expect(can('manager', cap)).toBe(true);
      expect(can('staff', cap)).toBe(false);
      expect(can('viewer', cap)).toBe(false);
    }
  });

  it('ADD_DOCS / BULK_IMPORT: admin/manager/staff (not viewer)', () => {
    for (const cap of ['ADD_DOCS', 'BULK_IMPORT'] as const) {
      expect(can('staff', cap)).toBe(true);
      expect(can('viewer', cap)).toBe(false);
    }
  });

  it('MANAGE_BUYERS / REVIEW_SUPPLIER_CERTS / MANAGE_USERS / CREATE_USER: admin/manager only', () => {
    for (const cap of ['MANAGE_BUYERS', 'REVIEW_SUPPLIER_CERTS', 'MANAGE_USERS', 'CREATE_USER'] as const) {
      expect(can('manager', cap)).toBe(true);
      expect(can('staff', cap)).toBe(false);
      expect(can('viewer', cap)).toBe(false);
    }
  });

  it('VIEW_AUDIT_LOG / SETTINGS / BACKUP / HARD_DELETE: ADMIN ONLY', () => {
    for (const cap of ['VIEW_AUDIT_LOG', 'SETTINGS', 'BACKUP', 'HARD_DELETE'] as const) {
      expect(can('admin', cap)).toBe(true);
      expect(can('manager', cap)).toBe(false);
      expect(can('staff', cap)).toBe(false);
      expect(can('viewer', cap)).toBe(false);
    }
  });

  it('unknown / empty role → no capability', () => {
    expect(can(undefined, 'VIEW_DATA')).toBe(false);
    expect(can('', 'VIEW_DATA')).toBe(false);
    expect(can('wizard', 'ADD_ENTITY')).toBe(false);
  });
});

describe('role hierarchy — assignableRoles / canAssignRole', () => {
  it('admin may assign any of the four roles', () => {
    expect(assignableRoles('admin')).toEqual(['admin', 'manager', 'staff', 'viewer']);
    expect(canAssignRole('admin', 'manager')).toBe(true);
  });

  it('manager may assign ONLY staff/viewer', () => {
    expect(assignableRoles('manager')).toEqual(['staff', 'viewer']);
    expect(canAssignRole('manager', 'staff')).toBe(true);
    expect(canAssignRole('manager', 'viewer')).toBe(true);
    expect(canAssignRole('manager', 'admin')).toBe(false);
    expect(canAssignRole('manager', 'manager')).toBe(false);
  });

  it('staff/viewer may assign nothing', () => {
    expect(assignableRoles('staff')).toEqual([]);
    expect(canAssignRole('staff', 'viewer')).toBe(false);
  });
});

describe('Users-page "Change role" control — option list (v1.2.1)', () => {
  // The control's <select> options come straight from assignableRoles(currentRole).
  it('admin sees all four role options', () => {
    const opts = assignableRoles('admin');
    expect(opts).toHaveLength(4);
    expect(opts).toEqual(expect.arrayContaining(['admin', 'manager', 'staff', 'viewer']));
  });
  it('manager sees only staff + viewer (2 options, no admin/manager)', () => {
    const opts = assignableRoles('manager');
    expect(opts).toEqual(['staff', 'viewer']);
    expect(opts).not.toContain('admin');
    expect(opts).not.toContain('manager');
  });
});

describe('canManageUser — who can act on whom', () => {
  it('admin can manage anyone', () => {
    for (const t of ['admin', 'manager', 'staff', 'viewer']) expect(canManageUser('admin', t)).toBe(true);
  });
  it('manager can manage only staff/viewer', () => {
    expect(canManageUser('manager', 'staff')).toBe(true);
    expect(canManageUser('manager', 'viewer')).toBe(true);
    expect(canManageUser('manager', 'admin')).toBe(false);
    expect(canManageUser('manager', 'manager')).toBe(false);
  });
  it('staff/viewer can manage no one', () => {
    expect(canManageUser('staff', 'viewer')).toBe(false);
    expect(canManageUser('viewer', 'viewer')).toBe(false);
  });
});
