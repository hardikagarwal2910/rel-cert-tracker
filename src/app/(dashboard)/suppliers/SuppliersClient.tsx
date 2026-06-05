'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Supplier } from '@/types/database';

interface Props {
  suppliers: Supplier[];
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    onboarding: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-600',
    suspended: 'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
};

export default function SuppliersClient({ suppliers }: Props) {
  const router = useRouter();
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const hasInactive = useMemo(() => suppliers.some((s) => s.status === 'inactive'), [suppliers]);

  const reactivate = async (id: string) => {
    setReactivatingId(id);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });
      if (res.ok) router.refresh();
    } finally {
      setReactivatingId(null);
    }
  };

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (tierFilter && s.tier !== tierFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });
  }, [suppliers, tierFilter, statusFilter]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} results</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Tier</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Contacts</th>
              {hasInactive && <th className="px-4 py-2 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={hasInactive ? 5 : 4} className="px-4 py-6 text-center text-gray-500">No suppliers found.</td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/suppliers/${s.id}`} className="font-medium text-gray-800 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.tier ? `Tier ${s.tier}` : '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.contacts?.length ?? 0}</td>
                  {hasInactive && (
                    <td className="px-4 py-2 text-right">
                      {s.status === 'inactive' ? (
                        <button
                          onClick={() => reactivate(s.id)}
                          disabled={reactivatingId === s.id}
                          className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          style={{ color: '#878687' }}
                        >
                          {reactivatingId === s.id ? '…' : 'Reactivate'}
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
