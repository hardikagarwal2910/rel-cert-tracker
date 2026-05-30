'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UserActiveToggle({ userId, initialActive }: { userId: string; initialActive: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) {
        setActive(!active);
        router.refresh();
      }
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <button onClick={toggle} disabled={loading} className="px-2 py-0.5 rounded text-white" style={{ backgroundColor: active ? '#d9534f' : '#16a34a' }}>
          {loading ? '…' : active ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={() => setConfirming(false)} className="px-2 py-0.5 rounded border border-gray-300 text-gray-500">Cancel</button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
      title="Click to change"
    >
      {active ? 'Active' : 'Inactive'}
    </button>
  );
}
