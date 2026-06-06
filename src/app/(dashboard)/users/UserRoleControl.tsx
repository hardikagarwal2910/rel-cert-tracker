'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/auth/permissions';

const TAUPE = '#878687';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  viewer: 'Viewer',
};

/**
 * Per-row "Change role" control. Mirrors UserActiveToggle / UserPasswordReset.
 * `options` is the list of roles the CURRENT user may assign (derived server-side
 * from assignableRoles(currentRole)). The server PUT /api/users/[id] re-enforces
 * every guard — this control is convenience only.
 */
export default function UserRoleControl({
  userId,
  username,
  role,
  options,
}: {
  userId: string;
  username: string;
  role: Role;
  options: Role[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The current role must always be selectable even if it isn't assignable.
  const selectOptions = options.includes(role) ? options : [role, ...options];

  const onSelect = (next: Role) => {
    setError('');
    setPending(next === role ? null : next);
  };

  const confirm = async () => {
    if (!pending) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: pending }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to change role');
      }
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPending(null); // revert the select back to the current role
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-gray-600">
          Change {username} to <span className="font-medium">{ROLE_LABEL[pending]}</span>?
        </span>
        <button
          onClick={confirm}
          disabled={loading}
          className="px-2 py-0.5 rounded text-white disabled:opacity-50"
          style={{ backgroundColor: TAUPE }}
        >
          {loading ? '…' : 'Confirm'}
        </button>
        <button
          onClick={() => { setPending(null); setError(''); }}
          className="px-2 py-0.5 rounded border border-gray-300 text-gray-500"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={role}
        onChange={(e) => onSelect(e.target.value as Role)}
        aria-label={`Change role for ${username}`}
        className="border border-gray-300 rounded px-2 py-0.5 text-xs"
      >
        {selectOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
