'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TAUPE = '#878687';
const YELLOW = '#F5C400';

interface ContactRow { name: string; email: string; phone: string; role: string }

export interface SupplierFormValues {
  name: string;
  tier: '' | '1' | '2' | '3';
  commodity_tags: string;        // comma-separated in the form
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  contacts: ContactRow[];
  required_cert_ids: string[];
}

interface CertOption { id: string; name: string }

const EMPTY: SupplierFormValues = {
  name: '', tier: '', commodity_tags: '', address_line_1: '', address_line_2: '',
  city: '', state: '', pincode: '', country: 'India', contacts: [], required_cert_ids: [],
};

export default function SupplierForm({
  mode,
  supplierId,
  certificates,
  initial,
}: {
  mode: 'create' | 'edit';
  supplierId?: string;
  certificates: CertOption[];
  initial?: Partial<SupplierFormValues>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SupplierFormValues>({ ...EMPTY, ...initial, contacts: initial?.contacts ?? [], required_cert_ids: initial?.required_cert_ids ?? [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof SupplierFormValues>(k: K, v: SupplierFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  const setContact = (i: number, k: keyof ContactRow, v: string) =>
    setForm((f) => ({ ...f, contacts: f.contacts.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)) }));
  const addContact = () => set('contacts', [...form.contacts, { name: '', email: '', phone: '', role: '' }]);
  const removeContact = (i: number) => set('contacts', form.contacts.filter((_, idx) => idx !== i));

  const toggleCert = (id: string) =>
    set('required_cert_ids', form.required_cert_ids.includes(id)
      ? form.required_cert_ids.filter((x) => x !== id)
      : [...form.required_cert_ids, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    // Each contact that is filled in must have a name + valid email.
    const contacts = form.contacts.filter((c) => c.name.trim() || c.email.trim());
    for (const c of contacts) {
      if (!c.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) {
        setError('Each contact needs a name and a valid email (or remove the empty row).');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        tier: form.tier || undefined,
        commodity_tags: form.commodity_tags.split(',').map((t) => t.trim()).filter(Boolean),
        address_line_1: form.address_line_1.trim() || undefined,
        address_line_2: form.address_line_2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        country: form.country.trim() || 'India',
        contacts: contacts.map((c) => ({
          name: c.name.trim(),
          email: c.email.trim(),
          phone: c.phone.trim() || undefined,
          role: c.role.trim() || undefined,
        })),
        required_cert_ids: form.required_cert_ids,
      };
      const url = mode === 'create' ? '/api/suppliers' : `/api/suppliers/${supplierId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Save failed');
      if (mode === 'create') router.push(`/suppliers/${d.id}`);
      else router.push(`/suppliers/${supplierId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm';
  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {node}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        {field('Supplier name *', <input value={form.name} onChange={(e) => set('name', e.target.value)} required className={inputCls} />)}
        {field('Tier', (
          <select value={form.tier} onChange={(e) => set('tier', e.target.value as SupplierFormValues['tier'])} className={inputCls}>
            <option value="">— None —</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        ))}
        {field('Commodity tags (comma-separated)', <input value={form.commodity_tags} onChange={(e) => set('commodity_tags', e.target.value)} placeholder="cotton, towels" className={inputCls} />)}
        {field('City', <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} />)}
        {field('Address line 1', <input value={form.address_line_1} onChange={(e) => set('address_line_1', e.target.value)} className={inputCls} />)}
        {field('Address line 2', <input value={form.address_line_2} onChange={(e) => set('address_line_2', e.target.value)} className={inputCls} />)}
        {field('State', <input value={form.state} onChange={(e) => set('state', e.target.value)} className={inputCls} />)}
        {field('Pincode', <input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className={inputCls} />)}
        {field('Country', <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} />)}
      </div>

      {/* Contacts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Contacts</h2>
          <button type="button" onClick={addContact} className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50" style={{ color: TAUPE }}>+ Add contact</button>
        </div>
        {form.contacts.length === 0 ? (
          <p className="text-xs text-gray-400">No contacts. Email/phone are encrypted at rest.</p>
        ) : (
          <div className="space-y-2">
            {form.contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={c.name} onChange={(e) => setContact(i, 'name', e.target.value)} placeholder="Name" className="col-span-3 border border-gray-300 rounded px-2 py-1 text-sm" />
                <input value={c.email} onChange={(e) => setContact(i, 'email', e.target.value)} placeholder="Email" className="col-span-3 border border-gray-300 rounded px-2 py-1 text-sm" />
                <input value={c.phone} onChange={(e) => setContact(i, 'phone', e.target.value)} placeholder="Phone" className="col-span-3 border border-gray-300 rounded px-2 py-1 text-sm" />
                <input value={c.role} onChange={(e) => setContact(i, 'role', e.target.value)} placeholder="Role" className="col-span-2 border border-gray-300 rounded px-2 py-1 text-sm" />
                <button type="button" onClick={() => removeContact(i)} className="col-span-1 text-xs text-red-600 hover:underline">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Required certs */}
      {certificates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Required certificates</h2>
          <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border border-gray-100 rounded p-2">
            {certificates.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.required_cert_ids.includes(c.id)} onChange={() => toggleCert(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="px-5 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: YELLOW, color: '#333' }}>
          {loading ? 'Saving…' : mode === 'create' ? 'Create Supplier' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-2 rounded text-sm font-medium border border-gray-300" style={{ color: TAUPE }}>Cancel</button>
      </div>
    </form>
  );
}
