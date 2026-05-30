'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const TAUPE = '#878687';

interface Hit {
  id?: string;
  name: string;
  href: string;
  sub?: string;
}

interface Results {
  certificates: { id: string; name: string; issuing_body?: string | null }[];
  suppliers: { id: string; name: string }[];
  locations: { id: string; name: string; city?: string | null }[];
}

const EMPTY: Results = { certificates: [], suppliers: [], locations: [] };

export default function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten to an ordered list for keyboard navigation.
  const flat: Hit[] = [
    ...results.certificates.map((c) => ({ id: c.id, name: c.name, href: `/certificates/${c.id}`, sub: c.issuing_body ?? undefined })),
    ...results.suppliers.map((s) => ({ id: s.id, name: s.name, href: `/suppliers/${s.id}` })),
    ...results.locations.map((l) => ({ id: l.id, name: l.name, href: `/locations`, sub: l.city ?? undefined })),
  ];

  const runSearch = useCallback(async (value: string) => {
    if (!value.trim()) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
      if (res.ok) {
        const d = await res.json();
        setResults({
          certificates: d.certificates ?? [],
          suppliers: d.suppliers ?? [],
          locations: d.locations ?? [],
        });
        setOpen(true);
        setHighlight(-1);
      }
    } catch {
      // ignore — search is best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search (300ms) without any new dependency.
  const onChange = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value), 300);
  };

  // Click-away closes the dropdown.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    setResults(EMPTY);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || flat.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const target = flat[highlight] ?? flat[0];
      if (target) go(target.href);
    }
  };

  const hasResults = flat.length > 0;
  const section = (title: string, hits: Hit[], offset: number) =>
    hits.length > 0 && (
      <div>
        <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">{title}</p>
        {hits.map((h, i) => {
          const idx = offset + i;
          return (
            <button
              key={`${title}-${h.id ?? i}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => go(h.href)}
              className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-gray-50"
              style={{ backgroundColor: highlight === idx ? '#f3f4f6' : undefined }}
            >
              <span className="text-sm text-gray-800 truncate">{h.name}</span>
              {h.sub && <span className="text-xs text-gray-400 ml-2 truncate">{h.sub}</span>}
            </button>
          );
        })}
      </div>
    );

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => q && setOpen(true)}
        placeholder="Search certificates, suppliers, locations…"
        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
        style={{ '--tw-ring-color': TAUPE } as React.CSSProperties}
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-96 overflow-y-auto">
          {loading && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
          {!loading && !hasResults && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
          {!loading && hasResults && (
            <>
              {section('Certificates', flat.slice(0, results.certificates.length), 0)}
              {section('Suppliers', flat.slice(results.certificates.length, results.certificates.length + results.suppliers.length), results.certificates.length)}
              {section('Locations', flat.slice(results.certificates.length + results.suppliers.length), results.certificates.length + results.suppliers.length)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
