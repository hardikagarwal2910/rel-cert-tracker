'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

interface Buyer {
  id: string;
  name: string;
  company?: string | null;
  email: string;
  designation?: string | null;
  status: string;
  ip_address?: string | null;
  geolocation?: Record<string, unknown> | null;
  last_login?: string | null;
  visible_tags?: string[];
  created_at: string;
}

interface Visit {
  id: string;
  path?: string | null;
  ip_address?: string | null;
  geolocation?: Record<string, unknown> | null;
  visited_at: string;
}

const TAUPE = '#878687';
const YELLOW = '#F5C400';

export default function BuyerActivityClient() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visits, setVisits] = useState<Record<string, Visit[]>>({});
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/buyers');
      if (!res.ok) throw new Error(res.status === 403 ? 'Admins only.' : 'Failed to load buyers');
      const d = (await res.json()) as Buyer[];
      setBuyers(d);
      const drafts: Record<string, string> = {};
      d.forEach((b) => { drafts[b.id] = (b.visible_tags ?? []).join(', '); });
      setTagDraft(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
    await fetch(`/api/buyers/${id}/${action}`, { method: 'POST' });
    load();
  };

  const saveTags = async (id: string) => {
    const tags = (tagDraft[id] ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    await fetch(`/api/buyers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible_tags: tags }),
    });
    load();
  };

  const toggleVisits = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!visits[id]) {
      const res = await fetch(`/api/buyers/${id}/visits`);
      if (res.ok) {
        const data = (await res.json()) as Visit[];
        setVisits((v) => ({ ...v, [id]: data }));
      }
    }
  };

  const geoStr = (g?: Record<string, unknown> | null) =>
    g ? [g.city, g.region, g.country].filter(Boolean).join(', ') : '';

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const pending = buyers.filter((b) => b.status === 'pending');
  const active = buyers.filter((b) => b.status !== 'pending');

  return (
    <div className="space-y-10">
      {/* SECTION A — Pending Approvals */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending Approvals ({pending.length})</h2>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No pending registrations.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Designation</th>
                  <th className="px-4 py-2">Registered</th>
                  <th className="px-4 py-2">IP / Geo</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{b.name}</td>
                    <td className="px-4 py-2 text-gray-600">{b.company ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{b.email}</td>
                    <td className="px-4 py-2 text-gray-600">{b.designation ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {b.ip_address ?? '—'}{geoStr(b.geolocation) && <><br />{geoStr(b.geolocation)}</>}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => act(b.id, 'approve')} className="px-3 py-1 rounded text-xs font-medium mr-2" style={{ backgroundColor: YELLOW, color: '#333' }}>Approve</button>
                      <button onClick={() => act(b.id, 'reject')} className="px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: '#d9534f' }}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* SECTION B — Active Buyers & Visit Log */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Buyers &amp; Visit Log ({active.length})</h2>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          {active.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No approved buyers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last Login</th>
                  <th className="px-4 py-2">Visible Tags</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {active.map((b) => (
                  <Fragment key={b.id}>
                    <tr className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-800">{b.name}</td>
                      <td className="px-4 py-2 text-gray-600">{b.company ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{b.email}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={b.status === 'approved' ? { backgroundColor: '#dcfce7', color: '#166534' } : { backgroundColor: '#fee2e2', color: '#991b1b' }}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{b.last_login ? new Date(b.last_login).toLocaleString('en-IN') : 'Never'}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            value={tagDraft[b.id] ?? ''}
                            onChange={(e) => setTagDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                            placeholder="all"
                            className="w-28 border border-gray-300 rounded px-2 py-0.5 text-xs"
                          />
                          <button onClick={() => saveTags(b.id)} className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50" style={{ color: TAUPE }}>Save</button>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => toggleVisits(b.id)} className="text-xs hover:underline mr-2" style={{ color: TAUPE }}>
                          {expanded === b.id ? 'Hide' : 'Visits'}
                        </button>
                        {b.status === 'approved' && (
                          <button onClick={() => act(b.id, 'suspend')} className="px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: '#d9534f' }}>Suspend</button>
                        )}
                      </td>
                    </tr>
                    {expanded === b.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-2">
                          {!visits[b.id] ? (
                            <p className="text-xs text-gray-400">Loading visits…</p>
                          ) : visits[b.id].length === 0 ? (
                            <p className="text-xs text-gray-400">No visits recorded.</p>
                          ) : (
                            <ul className="text-xs text-gray-600 space-y-1">
                              {visits[b.id].map((v) => (
                                <li key={v.id} className="flex gap-3">
                                  <span className="text-gray-400">{new Date(v.visited_at).toLocaleString('en-IN')}</span>
                                  <span className="font-medium">{v.path ?? '—'}</span>
                                  <span className="text-gray-400">{v.ip_address ?? ''} {geoStr(v.geolocation)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
