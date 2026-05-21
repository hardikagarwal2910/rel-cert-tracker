'use client';

import { useState } from 'react';

interface PreviewResult {
  valid: unknown[];
  errors: { row: number; message: string }[];
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setMsg('');
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('preview', 'true');
      const res = await fetch('/api/bulk-import', { method: 'POST', body: fd });
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
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bulk-import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Import failed');
      setMsg(`Import complete: ${d.imported ?? 0} records imported.`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>Bulk Import</h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Upload a CSV or Excel file to bulk-import certificates. Preview first, then confirm.
        </p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {msg && <p className="text-sm text-green-700 mb-3">{msg}</p>}

        <form onSubmit={handlePreview} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">File (CSV / Excel)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setMsg('');
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
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Preview Results</h2>
          <p className="text-sm text-gray-600 mb-1">{preview.valid.length} valid rows</p>
          {preview.errors.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-red-600 font-medium">{preview.errors.length} errors:</p>
              <ul className="list-disc list-inside text-xs text-red-500 mt-1 space-y-0.5">
                {preview.errors.slice(0, 10).map((e) => (
                  <li key={e.row}>Row {e.row}: {e.message}</li>
                ))}
                {preview.errors.length > 10 && <li>...and {preview.errors.length - 10} more</li>}
              </ul>
            </div>
          )}

          {preview.valid.length > 0 && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#F5C400', color: '#333' }}
            >
              {loading ? 'Importing…' : `Confirm Import (${preview.valid.length} rows)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
