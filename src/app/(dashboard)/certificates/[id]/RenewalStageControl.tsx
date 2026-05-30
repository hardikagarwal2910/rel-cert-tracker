'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STAGES: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_issuer', label: 'Awaiting issuer' },
  { value: 'renewed', label: 'Renewed' },
];

export default function RenewalStageControl({ certId, initial }: { certId: string; initial: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(initial || 'not_started');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const update = async (next: string) => {
    setStage(next);
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/certificates/${certId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renewal_stage: next }),
      });
      if (!res.ok) throw new Error('Save failed');
      setMsg('Saved');
      router.refresh();
    } catch {
      setMsg('Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-gray-500 text-xs uppercase mb-1">Renewal Stage</p>
      <div className="flex items-center gap-2">
        <select
          value={stage}
          onChange={(e) => update(e.target.value)}
          disabled={saving}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}
