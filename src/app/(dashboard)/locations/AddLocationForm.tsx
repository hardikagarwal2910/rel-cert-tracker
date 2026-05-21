'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddLocationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', address_line_1: '', city: '', state: '', pincode: '', country: 'India',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to add location');
      }
      setForm({ name: '', address_line_1: '', city: '', state: '', pincode: '', country: 'India' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Location</h2>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        {(['name', 'address_line_1', 'city', 'state', 'pincode'] as const).map((field) => (
          <div key={field}>
            <label className="block text-xs text-gray-500 mb-1 capitalize">{field.replace('_', ' ')}</label>
            <input
              name={field}
              value={form[field]}
              onChange={handleChange}
              required={field === 'name' || field === 'address_line_1' || field === 'city' || field === 'state' || field === 'pincode'}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: '#878687' }}
        >
          {loading ? 'Adding…' : 'Add Location'}
        </button>
      </form>
    </div>
  );
}
