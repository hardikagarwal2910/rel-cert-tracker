'use client';

import { useState } from 'react';

interface RowResult {
  row: number;
  valid: boolean;
  name: string;
  errors: string[];
}

interface PreviewResult {
  total: number;
  valid: number;
  invalid: number;
  rows: RowResult[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

export default function BulkSupplierImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bulk-import/suppliers?preview=true', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Preview failed');
      setPreview(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bulk-import/suppliers', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Import failed');
      setResult(d);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>Bulk Onboard Suppliers</h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Upload a CSV or Excel file to onboard multiple suppliers at once. Download the template, fill it in, preview, then import. Contact details are encrypted on save.
        </p>

        <a
          href="/api/bulk-import/suppliers"
          className="inline-block mb-4 px-3 py-1.5 rounded text-sm font-medium text-white"
          style={{ backgroundColor: '#878687' }}
        >
          Download Template
        </a>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <form onSubmit={handlePreview} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">File (CSV / Excel)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
              className="w-full text-sm text-gray-700"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !file}
            className="px-4 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#878687' }}
          >
            {loading ? 'Processing…' : 'Preview'}
          </button>
        </form>
      </div>

      {preview && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Preview — {preview.valid} valid, {preview.invalid} invalid of {preview.total}
          </h2>
          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-500">{r.row}</td>
                    <td className="px-3 py-1.5 text-gray-800">{r.name}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={r.valid ? { backgroundColor: '#dcfce7', color: '#166534' } : { backgroundColor: '#fee2e2', color: '#991b1b' }}
                      >
                        {r.valid ? 'Valid' : 'Error'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-red-500">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.valid > 0 && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#F5C400', color: '#333' }}
            >
              {loading ? 'Importing…' : `Confirm Import (${preview.valid} suppliers)`}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Import Complete</h2>
          <p className="text-sm text-green-700 mb-1">{result.imported} suppliers imported.</p>
          {result.invalid > 0 && <p className="text-sm text-gray-600">{result.invalid} invalid rows skipped.</p>}
          {result.errors.length > 0 && (
            <ul className="list-disc list-inside text-xs text-red-500 mt-2 space-y-0.5">
              {result.errors.slice(0, 15).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 15 && <li>…and {result.errors.length - 15} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
