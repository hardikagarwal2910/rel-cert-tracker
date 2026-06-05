'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { locationLabel } from '@/lib/location-label';

const TAUPE = '#878687';
const YELLOW = '#F5C400';

export interface CertFormValues {
  name: string;
  cert_number: string;
  issuing_body: string;
  category: string;
  issue_date: string;
  expiry_date: string;
  renewal_process_start_date: string;
  renewal_cost: string;
  location_id: string;
  buyer_tags: string;
  buyer_visible: boolean;
  notes: string;
}

export interface LocationOption {
  id: string;
  name: string;
  nickname?: string | null;
  city?: string | null;
}

export default function CertForm({
  mode,
  certId,
  categories,
  locations,
  initial,
}: {
  mode: 'create' | 'edit';
  certId?: string;
  categories: string[];
  locations: LocationOption[];
  initial?: Partial<CertFormValues>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CertFormValues>({
    name: initial?.name ?? '',
    cert_number: initial?.cert_number ?? '',
    issuing_body: initial?.issuing_body ?? '',
    category: initial?.category ?? '',
    issue_date: initial?.issue_date ?? '',
    expiry_date: initial?.expiry_date ?? '',
    renewal_process_start_date: initial?.renewal_process_start_date ?? '',
    renewal_cost: initial?.renewal_cost ?? '',
    location_id: initial?.location_id ?? '',
    buyer_tags: initial?.buyer_tags ?? '',
    buyer_visible: initial?.buyer_visible ?? false,
    notes: initial?.notes ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof CertFormValues, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.expiry_date) {
      setError('Name and expiry date are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        expiry_date: form.expiry_date,
        cert_number: form.cert_number || undefined,
        issuing_body: form.issuing_body || undefined,
        category: form.category || undefined,
        issue_date: form.issue_date || undefined,
        renewal_process_start_date: form.renewal_process_start_date || undefined,
        location_id: form.location_id || undefined,
        buyer_visible: form.buyer_visible,
        buyer_tags: form.buyer_tags
          ? form.buyer_tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        notes: form.notes || undefined,
        renewal_cost: form.renewal_cost ? Number(form.renewal_cost) : undefined,
      };
      const url = mode === 'create' ? '/api/certificates' : `/api/certificates/${certId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Save failed');
      if (mode === 'create') router.push('/certificates');
      else router.push(`/certificates/${certId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {node}
    </div>
  );
  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        {field('Name *', <input value={form.name} onChange={(e) => set('name', e.target.value)} required className={inputCls} />)}
        {field('Certificate Number', <input value={form.cert_number} onChange={(e) => set('cert_number', e.target.value)} className={inputCls} />)}
        {field('Issuing Body', <input value={form.issuing_body} onChange={(e) => set('issuing_body', e.target.value)} className={inputCls} />)}
        {field('Category', (
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
            <option value="">— Select —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ))}
        {field('Location', (
          <select value={form.location_id} onChange={(e) => set('location_id', e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
          </select>
        ))}
        {field('Renewal Cost (₹)', <input type="number" value={form.renewal_cost} onChange={(e) => set('renewal_cost', e.target.value)} className={inputCls} />)}
        {field('Issue Date', <input type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} className={inputCls} />)}
        {field('Expiry Date *', <input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} required className={inputCls} />)}
        {field('Renewal Process Start', <input type="date" value={form.renewal_process_start_date} onChange={(e) => set('renewal_process_start_date', e.target.value)} className={inputCls} />)}
        {field('Buyer Tags (comma-separated)', <input value={form.buyer_tags} onChange={(e) => set('buyer_tags', e.target.value)} placeholder="reliance, tata" className={inputCls} />)}
      </div>
      {field('Notes', <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={inputCls} />)}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.buyer_visible} onChange={(e) => set('buyer_visible', e.target.checked)} />
        Visible to buyers
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="px-5 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: YELLOW, color: '#333' }}>
          {loading ? 'Saving…' : mode === 'create' ? 'Create Certificate' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-2 rounded text-sm font-medium border border-gray-300" style={{ color: TAUPE }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
