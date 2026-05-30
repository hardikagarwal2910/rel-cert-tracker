'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  differenceInCalendarDays,
} from 'date-fns';

export interface CalendarItem {
  id: string;
  name: string;
  issuing_body: string | null;
  expiry_date: string;
  status: string;
  submitted_by_supplier: boolean;
}

type View = 'all' | 'internal' | 'supplier';

const TAUPE = '#878687';
const YELLOW = '#F5C400';

// Urgency colour by days until expiry (from today).
function urgency(expiry: string): { dot: string; label: string } {
  const days = differenceInCalendarDays(new Date(expiry), new Date());
  if (days <= 7) return { dot: '#dc2626', label: 'red' }; // expired or ≤7d
  if (days <= 30) return { dot: '#f59e0b', label: 'amber' };
  return { dot: '#9ca3af', label: 'grey' };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarClient({ items }: { items: CalendarItem[] }) {
  const [cursor, setCursor] = useState<Date>(new Date());
  const [view, setView] = useState<View>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (view === 'internal') return items.filter((i) => !i.submitted_by_supplier);
    if (view === 'supplier') return items.filter((i) => i.submitted_by_supplier);
    return items;
  }, [items, view]);

  // Map yyyy-MM-dd → items expiring that day
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of filtered) {
      const key = it.expiry_date.split('T')[0];
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const selectedItems = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  const viewBtn = (v: View, label: string) => (
    <button
      key={v}
      onClick={() => setView(v)}
      className="px-3 py-1 rounded text-xs font-medium border"
      style={
        view === v
          ? { backgroundColor: TAUPE, color: '#fff', borderColor: TAUPE }
          : { backgroundColor: '#fff', color: TAUPE, borderColor: '#e5e7eb' }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="px-2 py-1 rounded border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="text-base font-semibold min-w-[150px] text-center" style={{ color: TAUPE }}>
            {format(cursor, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="px-2 py-1 rounded border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            aria-label="Next month"
          >
            →
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-1 px-3 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: YELLOW, color: '#333' }}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {viewBtn('all', 'All')}
          {viewBtn('internal', 'Internal')}
          {viewBtn('supplier', 'Supplier')}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#dc2626' }} /> ≤ 7 days</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /> ≤ 30 days</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#9ca3af' }} /> &gt; 30 days</span>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-xs font-medium text-gray-500 border-b border-gray-100 pb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayItems = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(dayItems.length > 0 ? key : null)}
              className="h-20 border border-gray-100 p-1 text-left align-top relative hover:bg-gray-50 transition-colors"
              style={{
                backgroundColor: isSelected ? '#fafafa' : undefined,
                cursor: dayItems.length > 0 ? 'pointer' : 'default',
              }}
            >
              <span
                className="text-xs font-medium inline-flex items-center justify-center w-5 h-5 rounded-full"
                style={
                  isToday
                    ? { backgroundColor: TAUPE, color: '#fff' }
                    : { color: inMonth ? '#374151' : '#d1d5db' }
                }
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 2).map((it) => {
                  const u = urgency(it.expiry_date);
                  return (
                    <div key={it.id} className="flex items-center gap-1 truncate">
                      <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: u.dot }} />
                      <span className="text-[10px] text-gray-600 truncate">{it.name}</span>
                    </div>
                  );
                })}
                {dayItems.length > 2 && (
                  <div className="text-[10px] text-gray-400">+{dayItems.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day panel */}
      {selectedDay && selectedItems.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Expiring on {format(new Date(selectedDay), 'dd MMM yyyy')}
            </h2>
            <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Close
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {selectedItems.map((it) => {
              const u = urgency(it.expiry_date);
              return (
                <li key={it.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: u.dot }} />
                    <Link href={`/certificates/${it.id}`} className="text-sm font-medium text-gray-800 hover:underline">
                      {it.name}
                    </Link>
                    <span className="text-xs text-gray-400">{it.issuing_body ?? '—'}</span>
                    {it.submitted_by_supplier && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">supplier</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{it.status.replace('_', ' ')}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
