'use client';

import { useState } from 'react';

const TAUPE = '#878687';

/**
 * Admin "Reset password" per user — sets a new temporary password without email
 * (audit-logged user.password_reset). Inline confirm form, no logic duplicated:
 * it calls the shared PATCH /api/users/[id] reset path.
 */
export default function UserPasswordReset({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (pw.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', password: pw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed');
      }
      setMsg('Password reset.');
      setPw('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={() => { setMsg(''); setError(''); setOpen(true); }}
          className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          Reset password
        </button>
        {msg && <span className="text-[11px]" style={{ color: '#166534' }}>{msg}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <input
        type="text"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder={`New password for ${username}`}
        className="w-44 border border-gray-300 rounded px-2 py-0.5 text-xs"
      />
      <button onClick={submit} disabled={loading} className="px-2 py-0.5 rounded text-white disabled:opacity-50" style={{ backgroundColor: TAUPE }}>
        {loading ? '…' : 'Set'}
      </button>
      <button onClick={() => { setOpen(false); setPw(''); setError(''); }} className="px-2 py-0.5 rounded border border-gray-300 text-gray-500">Cancel</button>
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}
