'use client';

import { useState } from 'react';

export default function SendInviteButton({ supplierId }: { supplierId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/invite`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setMsg('Invite sent!');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-right">
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-3 py-1.5 text-sm rounded text-white disabled:opacity-50"
        style={{ backgroundColor: '#F5C400', color: '#333' }}
      >
        {loading ? 'Sending…' : 'Send Invite'}
      </button>
      {msg && <p className="text-xs mt-1 text-gray-600">{msg}</p>}
    </div>
  );
}
