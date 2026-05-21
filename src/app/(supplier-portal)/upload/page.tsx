'use client';

import { useState } from 'react';

export default function SupplierUploadPage() {
  const [form, setForm] = useState({
    cert_name: '',
    cert_number: '',
    issuing_body: '',
    expiry_date: '',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cert_name || !form.expiry_date) {
      setError('Cert name and expiry date are required.');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (file) fd.append('file', file);

      const res = await fetch('/api/supplier-certs', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Upload failed');
      setMsg('Certificate submitted successfully and is pending review.');
      setForm({ cert_name: '', cert_number: '', issuing_body: '', expiry_date: '', notes: '' });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>Upload Certificate</h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {msg && <p className="text-sm text-green-700 mb-3">{msg}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Certificate Name *</label>
            <input
              name="cert_name"
              value={form.cert_name}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Certificate Number</label>
            <input
              name="cert_number"
              value={form.cert_number}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Issuing Body</label>
            <input
              name="issuing_body"
              value={form.issuing_body}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expiry Date *</label>
            <input
              type="date"
              name="expiry_date"
              value={form.expiry_date}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">PDF File</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#878687' }}
          >
            {loading ? 'Submitting…' : 'Submit Certificate'}
          </button>
        </form>
      </div>
    </div>
  );
}
