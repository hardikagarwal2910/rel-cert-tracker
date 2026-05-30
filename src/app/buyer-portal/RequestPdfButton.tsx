'use client';

import { useState } from 'react';

export default function RequestPdfButton({
  certId,
  certName,
  buyerName,
  buyerCompany,
  buyerEmail,
}: {
  certId: string;
  certName: string;
  buyerName: string;
  buyerCompany: string;
  buyerEmail: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const request = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/pdf-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cert_id: certId,
          cert_name: certName,
          buyer_name: buyerName,
          buyer_company: buyerCompany || '—',
          buyer_email: buyerEmail,
        }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') return <span className="text-xs text-green-700">Requested ✓</span>;

  return (
    <button
      onClick={request}
      disabled={state === 'loading'}
      className="px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
      style={{ backgroundColor: '#F5C400', color: '#333' }}
    >
      {state === 'loading' ? '…' : state === 'error' ? 'Retry' : 'Request PDF'}
    </button>
  );
}
