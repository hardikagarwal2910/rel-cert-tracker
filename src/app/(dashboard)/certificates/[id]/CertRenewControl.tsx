'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TAUPE = '#878687';
const YELLOW = '#F5C400';

/**
 * Renew a certificate — POST /api/certificates/[id]/renew, which snapshots the
 * current values into version history and sets the new expiry. Distinct from
 * Edit (which updates fields without versioning).
 */
export default function CertRenewControl({ certId }: { certId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ new_expiry_date: '', new_cert_number: '', renewal_cost: '', notes: '' });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.new_expiry_date) { setError('A new expiry date is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/certificates/${certId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_expiry_date: form.new_expiry_date,
          new_cert_number: form.new_cert_number.trim() || undefined,
          renewal_cost: form.renewal_cost ? Number(form.renewal_cost) : undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Renewal failed');
      }
      setOpen(false);
      setForm({ new_expiry_date: '', new_cert_number: '', renewal_cost: '', notes: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

  return (
    <>
      <button
        onClick={() => { setError(''); setOpen(true); }}
        className="px-3 py-1.5 text-sm rounded font-medium"
        style={{ backgroundColor: YELLOW, color: '#333' }}
      >
        Renew
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1" style={{ color: TAUPE }}>Renew Certificate</h2>
            <p className="text-xs text-gray-500 mb-4">The current values are snapshotted into version history.</p>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">New expiry date *</label>
                <input type="date" value={form.new_expiry_date} onChange={(e) => set('new_expiry_date', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New certificate number</label>
                <input value={form.new_cert_number} onChange={(e) => set('new_cert_number', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Renewal cost (₹)</label>
                <input type="number" value={form.renewal_cost} onChange={(e) => set('renewal_cost', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} disabled={loading} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-500 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm rounded font-medium disabled:opacity-50" style={{ backgroundColor: YELLOW, color: '#333' }}>
                  {loading ? 'Renewing…' : 'Renew'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
