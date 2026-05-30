'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA step state
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otp, setOtp] = useState('');
  const [otpUserId, setOtpUserId] = useState('');
  const [info, setInfo] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Complete NextAuth sign-in (optionally with an OTP proof token).
  const completeSignIn = async (otpToken?: string) => {
    const result = await signIn('credentials', {
      username: form.username,
      password: form.password,
      ...(otpToken ? { otpToken } : {}),
      redirect: false,
    });
    if (result?.error) {
      setError('Sign-in failed. Please try again.');
      return false;
    }
    router.push('/');
    router.refresh();
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      // Step 1: verify credentials + decide if 2FA is needed.
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Invalid username or password.');
        return;
      }
      if (d.twoFactorRequired) {
        setOtpUserId(d.userId);
        setStep('otp');
        setInfo('We emailed a 6-digit code to your address.');
      } else {
        await completeSignIn();
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: otpUserId, code: otp }),
      });
      const d = await res.json();
      if (!res.ok) {
        const remaining = typeof d.remaining === 'number' ? ` (${d.remaining} attempts left)` : '';
        setError(`${d.error ?? 'Invalid code'}${remaining}`);
        return;
      }
      await completeSignIn(d.token);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      if (res.ok) setInfo('A new code has been sent.');
      else setError('Could not resend code.');
    } catch {
      setError('Could not resend code.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>
            REL Cert Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-8">
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              {info}
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Username</label>
                <input
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  style={{ '--tw-ring-color': '#878687' } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Password</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50 mt-2"
                style={{ backgroundColor: '#878687' }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">6-Digit Code</label>
                <input
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm tracking-[0.5em] text-center"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#878687' }}
              >
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setStep('credentials'); setOtp(''); setError(''); setInfo(''); }} className="text-gray-400 hover:text-gray-600">
                  ← Back
                </button>
                <button type="button" onClick={handleResend} className="hover:underline" style={{ color: '#878687' }}>
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-xs text-gray-400">
          Supplier?{' '}
          <a href="/supplier/login" className="hover:underline" style={{ color: '#878687' }}>
            Supplier login →
          </a>
        </p>
        <p className="text-center mt-1 text-xs text-gray-400">
          Are you a buyer?{' '}
          <a href="/buyer/register" className="hover:underline" style={{ color: '#878687' }}>
            Request access →
          </a>
        </p>
      </div>
    </div>
  );
}
