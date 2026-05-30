'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function SetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/buyer-auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setDone(true);
      setTimeout(() => router.push('/buyer/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <p className="text-sm text-red-600">Missing or invalid link.</p>;
  }

  return done ? (
    <div className="text-center">
      <div className="mb-3 text-3xl">✓</div>
      <p className="text-sm text-gray-700">Password set. Redirecting to login…</p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="block text-xs text-gray-500 mb-1">New Password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Confirm Password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={loading} className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#878687' }}>
        {loading ? 'Saving…' : 'Set Password'}
      </button>
    </form>
  );
}

export default function BuyerSetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Set Your Password</h1>
          <p className="text-sm text-gray-500 mt-1">REL Compliance Portal</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-8">
          <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
