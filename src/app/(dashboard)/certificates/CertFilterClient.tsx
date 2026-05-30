'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Certificate } from '@/types/database';

interface LocationOption { id: string; name: string }
interface Props {
  certs: Certificate[];
  categories: string[];
  locations: LocationOption[];
}

const statusBadge = (status: string) => {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'expiring_soon') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

const STAGE_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  awaiting_issuer: 'Awaiting issuer',
  renewed: 'Renewed',
};
function stageStyle(stage?: string | null): React.CSSProperties | undefined {
  switch (stage) {
    case 'in_progress': return { backgroundColor: '#dbeafe', color: '#1e40af' };
    case 'awaiting_issuer': return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'renewed': return { backgroundColor: '#dcfce7', color: '#166534' };
    case 'not_started': return { backgroundColor: '#f3f4f6', color: '#6b7280' };
    default: return undefined;
  }
}

type SortKey = 'name' | 'category' | 'expiry_date' | 'status';

export default function CertFilterClient({ certs, categories, locations }: Props) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('expiry_date');
  const [sortAsc, setSortAsc] = useState(true);

  const locName = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  const filtered = useMemo(() => {
    const out = certs.filter((c) => {
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (locationFilter === '__none__' && c.location_id) return false;
      if (locationFilter && locationFilter !== '__none__' && c.location_id !== locationFilter) return false;
      return true;
    });
    out.sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? '');
      const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? '');
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return out;
  }, [certs, categoryFilter, statusFilter, locationFilter, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((s) => !s);
    else { setSortKey(k); setSortAsc(true); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : '');
  const selCls = 'border border-gray-300 rounded px-3 py-1.5 text-sm';
  const thCls = 'px-3 py-2 cursor-pointer select-none hover:text-gray-700';

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selCls}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selCls}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selCls}>
          <option value="">All Locations</option>
          <option value="__none__">⚠ No location</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} results</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className={thCls} onClick={() => toggleSort('name')}>Name{arrow('name')}</th>
              <th className="px-3 py-2">Location</th>
              <th className={thCls} onClick={() => toggleSort('category')}>Category{arrow('category')}</th>
              <th className={thCls} onClick={() => toggleSort('expiry_date')}>Expiry{arrow('expiry_date')}</th>
              <th className="px-3 py-2">Renewal</th>
              <th className={thCls} onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No certificates found.</td></tr>
            ) : (
              filtered.map((cert) => {
                const stage = (cert as unknown as { renewal_stage?: string }).renewal_stage;
                return (
                  <tr key={cert.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <Link href={`/certificates/${cert.id}`} className="font-medium text-gray-800 hover:underline">{cert.name}</Link>
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {cert.location_id ? (locName.get(cert.location_id) ?? '—') : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>⚠ No location</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">{cert.category ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{cert.expiry_date}</td>
                    <td className="px-3 py-1.5">
                      {stage && stage !== 'not_started' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={stageStyle(stage)}>{STAGE_LABEL[stage] ?? stage}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(cert.status)}`}>{cert.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
