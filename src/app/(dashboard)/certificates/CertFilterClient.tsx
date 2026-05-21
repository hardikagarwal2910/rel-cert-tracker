'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Certificate } from '@/types/database';

interface Props {
  certs: Certificate[];
  categories: string[];
}

const statusBadge = (status: string) => {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'expiring_soon') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

export default function CertFilterClient({ certs, categories }: Props) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    return certs.filter((c) => {
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    });
  }, [certs, categoryFilter, statusFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Expiry Date</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No certificates found.
                </td>
              </tr>
            ) : (
              filtered.map((cert) => (
                <tr key={cert.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/certificates/${cert.id}`} className="font-medium text-gray-800 hover:underline">
                      {cert.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{cert.location_id ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{cert.category ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{cert.expiry_date}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(cert.status)}`}>
                      {cert.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
