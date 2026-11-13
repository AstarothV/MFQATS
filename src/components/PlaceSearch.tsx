'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { searchPlaces, type Place } from '@/lib/delivery';

// Address search with suggestions of real places while typing (Photon / OpenStreetMap), nearest first. Picking one
// hands back its street, city and position. Keyboard: arrows move, Enter picks, Escape closes.
export default function PlaceSearch({ onPick, near, placeholder = 'Search your street, building or barangay', autoFocus }: {
  onPick: (p: Place) => void;
  near?: { lat: number; lng: number } | null;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const chosen = useRef(''); // the text of a picked place: not searched again

  // ask after a short pause in typing; an older answer never replaces a newer one
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3 || text === chosen.current) { if (text.length < 3) setList([]); setBusy(false); return; }
    const ctl = new AbortController();
    setBusy(true);
    const t = window.setTimeout(() => {
      searchPlaces(text, near, ctl.signal)
        .then((r) => { setList(r); setActive(r.length ? 0 : -1); setFailed(false); setOpen(true); })
        .catch((e) => { if (e?.name !== 'AbortError') { setList([]); setFailed(true); setOpen(true); } })
        .finally(() => { if (!ctl.signal.aborted) setBusy(false); });
    }, 300);
    return () => { ctl.abort(); window.clearTimeout(t); };
  }, [q, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // close when clicking elsewhere
  useEffect(() => {
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  function pick(p: Place) {
    onPick(p);
    chosen.current = p.title;
    setQ(p.title);
    setOpen(false);
  }

  function key(e: React.KeyboardEvent) {
    if (!open || !list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + list.length) % list.length); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(list[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const showList = open && q.trim().length >= 3;
  return (
    <div ref={box} className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={key} onFocus={() => list.length && setOpen(true)}
        role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-${active}` : undefined}
        autoFocus={autoFocus} autoComplete="off" placeholder={placeholder} className="input-dark w-full pl-9 pr-9" />
      {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-2xl border border-border bg-card p-1 shadow-xl">
          {list.map((p, i) => (
            <li key={p.key + i} id={`${id}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-sm ${i === active ? 'bg-primary/10' : ''}`}>
              <MapPin size={14} className="mt-0.5 shrink-0 text-primary dark:text-accent" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{p.title}</span>
                {p.detail && <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>}
              </span>
            </li>
          ))}
          {!busy && list.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {failed ? 'Suggestions are not available right now. Type the street and city below.' : 'No places found. Try the street and barangay, or type them below.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
