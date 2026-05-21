'use client';

import { useState } from 'react';

export default function AuditPackPage() {
  const [buyerName, setBuyerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
      setError('Buyer name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/audit-pack/generate?buyer=${encodeURIComponent(buyerName.trim())}`,
        { method: 'GET' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to generate audit pack');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `REL_AuditPack_${buyerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>
        Audit Pack Generator
      </h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
        <p className="text-sm text-gray-600 mb-4">
          Generate a supplier audit pack PDF for a buyer. Enter the buyer name to include on the cover page.
        </p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <form onSubmit={handleDownload} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Buyer Name</label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#878687' }}
          >
            {loading ? 'Generating PDF…' : 'Download Audit Pack'}
          </button>
        </form>
      </div>
    </div>
  );
}
