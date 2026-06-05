'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TAUPE = '#878687';

/**
 * Per-row Deactivate / Reactivate control for the Locations page.
 * Deactivation is a soft retire — if certificates still reference the location
 * the confirm dialog spells out that they're kept; the location just drops out
 * of the cert-form dropdown for new assignments.
 */
export default function LocationActiveControl({
  locationId,
  active,
  certCount,
}: {
  locationId: string;
  active: boolean;
  certCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: 'deactivate' | 'reactivate') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Action failed');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (!active) {
    return (
      <button
        onClick={() => run('reactivate')}
        disabled={loading}
        className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        style={{ color: TAUPE }}
      >
        {loading ? '…' : 'Reactivate'}
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !loading && setConfirming(false)}>
        <div className="bg-white rounded-lg shadow-lg p-5 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Deactivate this location?</h3>
          <p className="text-sm text-gray-600 mb-4">
            {certCount > 0
              ? `${certCount} certificate(s) use this location; it will be hidden from new selections but kept for existing records.`
              : 'It will be hidden from the cert-form dropdown for new certificates. You can reactivate it at any time.'}
          </p>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => run('deactivate')}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded text-white disabled:opacity-50"
              style={{ backgroundColor: TAUPE }}
            >
              {loading ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
    >
      Deactivate
    </button>
  );
}
