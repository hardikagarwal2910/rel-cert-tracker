'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX = 20 * 1024 * 1024;

const DOC_TYPES = [
  { value: 'certificate', label: 'Certificate (primary)' },
  { value: 'test_report', label: 'Test Report' },
  { value: 'scope_annex', label: 'Scope Annex' },
  { value: 'other', label: 'Other' },
];

export default function UploadPdfClient({ certId }: { certId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('certificate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files are accepted.'); return; }
    if (file.size > MAX) { setError('File exceeds the 20MB limit.'); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      const res = await fetch(`/api/certificates/${certId}/upload-pdf`, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Upload failed');
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg rounded-lg border border-gray-200 bg-white shadow-sm p-6">
      {done ? (
        <div className="text-center">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-sm text-gray-700 mb-4">Document uploaded and stored in Google Drive.</p>
          <button onClick={() => { setDone(false); setFile(null); }} className="text-sm hover:underline mr-4" style={{ color: '#878687' }}>Upload another</button>
          <button onClick={() => router.push(`/certificates/${certId}`)} className="text-sm hover:underline" style={{ color: '#878687' }}>Back to certificate</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">PDF File (max 20MB)</label>
            <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} required className="w-full text-sm text-gray-700" />
          </div>
          <button type="submit" disabled={loading || !file} className="px-5 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#F5C400', color: '#333' }}>
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}
    </div>
  );
}
