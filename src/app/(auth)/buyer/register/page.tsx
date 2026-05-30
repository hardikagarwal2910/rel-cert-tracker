'use client';

import { useState } from 'react';

export default function BuyerRegisterPage() {
  const [form, setForm] = useState({ name: '', company: '', email: '', designation: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/buyer-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Registration failed');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>REL Compliance — Buyer Access</h1>
          <p className="text-sm text-gray-500 mt-1">Request access to view REL certifications</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-8">
          {done ? (
            <div className="text-center">
              <div className="mb-3 text-3xl">✓</div>
              <h2 className="text-base font-semibold text-gray-800 mb-2">Registration received</h2>
              <p className="text-sm text-gray-600">
                REL will review your request and email you once your access is approved.
              </p>
              <a href="/buyer/login" className="inline-block mt-5 text-sm hover:underline" style={{ color: '#878687' }}>
                ← Back to buyer login
              </a>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4 rounded bg-amber-50 border border-amber-200 p-3">
                Access is reviewed and approved by REL before activation. You will receive an email once approved.
              </p>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                  <input name="name" value={form.name} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Company</label>
                  <input name="company" value={form.company} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Designation</label>
                  <input name="designation" value={form.designation} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: '#878687' }}
                >
                  {loading ? 'Submitting…' : 'Request Access'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center mt-4 text-xs text-gray-400">
          Already approved?{' '}
          <a href="/buyer/login" className="hover:underline" style={{ color: '#878687' }}>Buyer login →</a>
        </p>
      </div>
    </div>
  );
}
