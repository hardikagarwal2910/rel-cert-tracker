'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const YELLOW = '#F5C400';

export interface LocationFormValues {
  nickname: string;
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

const EMPTY: LocationFormValues = {
  nickname: '', name: '', address_line_1: '', address_line_2: '',
  city: '', state: '', pincode: '', country: 'India',
};

/**
 * Reusable location form for create and edit. Nickname is placed FIRST as the
 * primary distinguishing label; all address fields follow.
 */
export default function LocationForm({
  mode,
  locationId,
  initial,
  onSaved,
}: {
  mode: 'create' | 'edit';
  locationId?: string;
  initial?: Partial<LocationFormValues>;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<LocationFormValues>({ ...EMPTY, ...initial });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const set = (k: keyof LocationFormValues, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address_line_1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      setError('Company name, address line 1, city, state and pincode are required.');
      return;
    }
    setLoading(true);
    setError('');
    setDone('');
    try {
      const body = {
        nickname: form.nickname.trim() || undefined,
        name: form.name.trim(),
        address_line_1: form.address_line_1.trim(),
        address_line_2: form.address_line_2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: form.country.trim() || 'India',
      };
      const url = mode === 'create' ? '/api/locations' : `/api/locations/${locationId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Save failed');
      }
      if (mode === 'create') setForm(EMPTY);
      setDone(mode === 'create' ? 'Location added.' : 'Saved.');
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, k: keyof LocationFormValues, opts?: { required?: boolean; placeholder?: string; hint?: string }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        required={opts?.required}
        placeholder={opts?.placeholder}
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
      />
      {opts?.hint && <p className="text-[11px] text-gray-400 mt-0.5">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        {mode === 'create' ? 'Add Location' : 'Edit Location'}
      </h2>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {done && <p className="text-sm mb-2" style={{ color: '#166534' }}>{done}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Nickname FIRST — the distinguishing internal label */}
        {field('Internal label / nickname (e.g. Shilaj Unit)', 'nickname', {
          placeholder: 'Shilaj Unit',
          hint: 'Optional but recommended — how you tell this site apart from others.',
        })}
        {field('Company name', 'name', { required: true, placeholder: 'Raghuvir Exim Limited' })}
        {field('Address line 1', 'address_line_1', { required: true })}
        {field('Address line 2', 'address_line_2')}
        <div className="grid grid-cols-2 gap-3">
          {field('City', 'city', { required: true })}
          {field('State', 'state', { required: true })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Pincode', 'pincode', { required: true })}
          {field('Country', 'country')}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-1.5 rounded text-sm font-medium disabled:opacity-50"
          style={mode === 'create' ? { backgroundColor: '#878687', color: '#fff' } : { backgroundColor: YELLOW, color: '#333' }}
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Add Location' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
