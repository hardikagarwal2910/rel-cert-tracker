'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignableRoles, type Role } from '@/lib/auth/permissions';

const YELLOW = '#F5C400';
const TAUPE = '#878687';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  viewer: 'Viewer',
};

/**
 * "New User" button + modal create form. The role dropdown is filtered to the
 * roles the CURRENT user is allowed to assign (admin → all four; manager →
 * staff/viewer only). The server enforces the same rule regardless.
 */
export default function NewUserButton({ currentRole }: { currentRole?: string }) {
  const router = useRouter();
  const roleOptions = assignableRoles(currentRole);
  const defaultRole: Role = roleOptions.includes('staff') ? 'staff' : (roleOptions[0] ?? 'viewer');

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', display_name: '', email: '', password: '', role: defaultRole as Role, active: true });

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({ username: '', display_name: '', email: '', password: '', role: defaultRole, active: true });
    setError('');
  };

  // Defensive: if somehow no assignable roles, don't render the button.
  if (roleOptions.length === 0) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || form.password.length < 8) {
      setError('Username is required and password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          display_name: form.display_name.trim() || undefined,
          email: form.email.trim() || undefined,
          password: form.password,
          role: form.role,
          active: form.active,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to create user');
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm';

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="px-4 py-2 rounded text-sm font-medium"
        style={{ backgroundColor: YELLOW, color: '#333' }}
      >
        + New User
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1" style={{ color: TAUPE }}>New User</h2>
            <p className="text-xs text-gray-500 mb-4">
              {currentRole === 'manager'
                ? 'As a manager you can create staff or viewer accounts.'
                : 'Choose the role for the new account.'}
            </p>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role *</label>
                <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
                  {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Username *</label>
                <input value={form.username} onChange={(e) => set('username', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Display name</label>
                <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Password * (min 8 characters)</label>
                <input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} className={inputCls} />
                <p className="text-[11px] text-gray-400 mt-0.5">Share this with the new user directly — no email is sent.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} disabled={loading} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-500 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm rounded font-medium disabled:opacity-50" style={{ backgroundColor: YELLOW, color: '#333' }}>
                  {loading ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
