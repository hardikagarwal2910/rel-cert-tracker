'use client';

import { useState } from 'react';

export default function BuyerVisibilityEditor({
  certId,
  initialVisible,
  initialTags,
}: {
  certId: string;
  initialVisible: boolean;
  initialTags: string[];
}) {
  const [visible, setVisible] = useState(initialVisible);
  const [tags, setTags] = useState(initialTags.join(', '));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/certificates/${certId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_visible: visible,
          buyer_tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5 mt-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Buyer Visibility</h2>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Visible to buyers
        </label>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Buyer tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. reliance, tata"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Buyers with matching visible-tags see this cert. Leave blank to show to all approved buyers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#F5C400', color: '#333' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-xs text-gray-600">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
