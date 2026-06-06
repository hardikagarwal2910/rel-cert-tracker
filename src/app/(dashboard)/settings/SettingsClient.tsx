'use client';

import { useCallback, useState, useEffect } from 'react';

interface CategoryRow {
  id: string;
  name: string;
  active: boolean;
}

export default function SettingsPage() {
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const [tfLoading, setTfLoading] = useState(false);
  const [tfMsg, setTfMsg] = useState('');

  const [cronLoading, setCronLoading] = useState(false);
  const [cronMsg, setCronMsg] = useState('');

  const [catName, setCatName] = useState('');
  const [catLoading, setCatLoading] = useState(false);
  const [catMsg, setCatMsg] = useState('');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [confirmingCatId, setConfirmingCatId] = useState<string | null>(null);
  const [catActionId, setCatActionId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories((await res.json()) as CategoryRow[]);
    } catch {
      /* non-fatal */
    }
  }, []);

  // Load current 2FA state + category list on mount.
  useEffect(() => {
    fetch('/api/users/me/2fa')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setTwoFactor(Boolean(d.enabled)))
      .catch(() => setTwoFactor(false));
    loadCategories();
  }, [loadCategories]);

  const deactivateCategory = async (id: string) => {
    setCatActionId(id);
    setCatMsg('');
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed');
      }
      await loadCategories();
    } catch (err) {
      setCatMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setCatActionId(null);
      setConfirmingCatId(null);
    }
  };

  const toggleTwoFactor = async () => {
    if (twoFactor === null) return;
    const next = !twoFactor;
    setTfLoading(true);
    setTfMsg('');
    try {
      const res = await fetch('/api/users/me/2fa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setTwoFactor(next);
      setTfMsg(next ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
    } catch (err) {
      setTfMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setTfLoading(false);
    }
  };

  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPwForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg('Passwords do not match.');
      return;
    }
    setPwLoading(true);
    setPwMsg('');
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setPwMsg('Password updated.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setPwLoading(false);
    }
  };

  const handleCronTrigger = async () => {
    setCronLoading(true);
    setCronMsg('');
    try {
      const res = await fetch('/api/cron/notifications', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setCronMsg('Cron job triggered successfully.');
    } catch (err) {
      setCronMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setCronLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatLoading(true);
    setCatMsg('');
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setCatMsg(`Category "${catName}" added.`);
      setCatName('');
      await loadCategories();
    } catch (err) {
      setCatMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setCatLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Settings</h1>

      {/* Change Password */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Change Password</h2>
        {pwMsg && <p className="text-sm mb-2 text-gray-600">{pwMsg}</p>}
        <form onSubmit={handlePwSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current Password</label>
            <input
              type="password"
              name="currentPassword"
              value={pwForm.currentPassword}
              onChange={handlePwChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">New Password</label>
            <input
              type="password"
              name="newPassword"
              value={pwForm.newPassword}
              onChange={handlePwChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={pwForm.confirmPassword}
              onChange={handlePwChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="w-full py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#878687' }}
          >
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Two-Factor Authentication</h2>
            <p className="text-xs text-gray-500 mt-1">
              Require a 6-digit emailed code at sign-in.{' '}
              <span className="font-medium" style={{ color: twoFactor ? '#166534' : '#9ca3af' }}>
                {twoFactor === null ? 'Loading…' : twoFactor ? 'On' : 'Off'}
              </span>
            </p>
            {tfMsg && <p className="text-xs mt-1 text-gray-600">{tfMsg}</p>}
          </div>
          <button
            onClick={toggleTwoFactor}
            disabled={tfLoading || twoFactor === null}
            className="px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
            style={twoFactor ? { backgroundColor: '#878687', color: '#fff' } : { backgroundColor: '#F5C400', color: '#333' }}
          >
            {tfLoading ? '…' : twoFactor ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Cron trigger */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Notifications Cron</h2>
        <p className="text-xs text-gray-500 mb-3">Manually trigger the notification cron job.</p>
        {cronMsg && <p className="text-sm mb-2 text-gray-600">{cronMsg}</p>}
        <button
          onClick={handleCronTrigger}
          disabled={cronLoading}
          className="px-4 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: '#878687' }}
        >
          {cronLoading ? 'Running…' : 'Trigger Cron'}
        </button>
      </div>

      {/* Export backup */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Data Backup</h2>
        <p className="text-xs text-gray-500 mb-3">Download a full JSON backup of the database.</p>
        <a
          href="/api/backup"
          className="inline-block px-4 py-1.5 rounded text-sm font-medium text-white"
          style={{ backgroundColor: '#878687' }}
        >
          Export Backup
        </a>
      </div>

      {/* Category management */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Categories</h2>
        {catMsg && <p className="text-sm mb-2 text-gray-600">{catMsg}</p>}

        {categories.length > 0 && (
          <ul className="mb-4 divide-y divide-gray-100 border border-gray-100 rounded">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className={c.active ? 'text-gray-800' : 'text-gray-400 line-through'}>{c.name}</span>
                {c.active ? (
                  confirmingCatId === c.id ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="text-gray-500">Retire?</span>
                      <button
                        onClick={() => deactivateCategory(c.id)}
                        disabled={catActionId === c.id}
                        className="px-2 py-0.5 rounded text-white disabled:opacity-50"
                        style={{ backgroundColor: '#d9534f' }}
                      >
                        {catActionId === c.id ? '…' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmingCatId(null)} className="px-2 py-0.5 rounded border border-gray-300 text-gray-500">Cancel</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingCatId(c.id)}
                      className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
                    >
                      Deactivate
                    </button>
                  )
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-400 mb-2">
          Deactivated categories stay on existing certificates but no longer appear in the new-certificate dropdown.
        </p>

        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={catLoading}
            className="px-4 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#F5C400', color: '#333' }}
          >
            {catLoading ? '…' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  );
}
