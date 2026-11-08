'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { furnitureCounts, furnitureOf } from '@/lib/furniture';

export interface PickerOrder {
  id: string;
  order_ref: string;
  product_name: string;
  product_category?: string | null;
  extended_status: string;
  assigned_to?: string | null;
}

/** Assigned to this person and not started yet (still Confirmed): what the red badges count. */
export const waitingForMe = (o: PickerOrder, me: string | undefined) => !!me && o.assigned_to === me && o.extended_status === 'confirmed';

const Badge = ({ n, className = '' }: { n: number; className?: string }) =>
  n > 0 ? (
    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-2xs font-bold text-white ${className}`}>
      {n}<span className="sr-only"> assigned to you, not started</span>
    </span>
  ) : null;

/**
 * Two steps to an order: the kind of furniture first (each with how many orders it has, and a red badge for the ones
 * assigned to you that you have not started), then the order among that furniture only.
 */
export default function FurnitureOrderPicker({ orders, value, onChange, me, label, orderLabel, empty, selectId, autoPick = false }: {
  orders: PickerOrder[];
  value: string;
  onChange: (orderId: string) => void;
  me?: string;
  label: string; // what the pair is called, e.g. "Working on"
  orderLabel: (o: PickerOrder) => string;
  empty?: string; // an extra first choice for "no order" (Quality Scan's practice scan)
  selectId?: string;
  autoPick?: boolean; // choosing a furniture also opens its first order (Workshop)
}) {
  const kinds = ['All', ...furnitureCounts(orders).map(([k]) => k)];
  const selected = orders.find((o) => o.id === value);
  const [kind, setKind] = useState('All');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // an order chosen from elsewhere (a link, a reload) shows under its own furniture
  useEffect(() => {
    if (selected && kind !== 'All' && furnitureOf(selected) !== kind) setKind(furnitureOf(selected));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    box.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const inKind = (k: string) => (k === 'All' ? orders : orders.filter((o) => furnitureOf(o) === k));
  const waiting = (k: string) => inKind(k).filter((o) => waitingForMe(o, me)).length;
  const shown = inKind(kind);
  const kindName = (k: string) => (k === 'All' ? 'All furniture' : k);
  // the chosen order, or a placeholder when it belongs to another furniture than the one picked
  const current = selected && !shown.includes(selected) ? '__other' : value;

  function chooseKind(k: string) {
    setKind(k);
    setOpen(false);
    if (autoPick && k !== 'All' && !(selected && furnitureOf(selected) === k)) {
      const first = inKind(k).find((o) => waitingForMe(o, me)) ?? inKind(k)[0];
      if (first) onChange(first.id);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:w-auto sm:flex-row sm:items-center">
      <span className="shrink-0">{label}</span>
      <div ref={box} className="relative shrink-0">
        <button type="button" onClick={() => setOpen(!open)} disabled={!orders.length} aria-haspopup="listbox" aria-expanded={open}
          aria-label={`Furniture: ${kindName(kind)}`}
          className="input-dark relative flex w-full items-center justify-between gap-2 text-left text-foreground sm:w-auto sm:min-w-44">
          <span className="truncate">{kindName(kind)} <span className="text-muted-foreground">({shown.length})</span></span>
          <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          <Badge n={waiting(kind)} className="absolute -right-2 -top-2" />
        </button>
        {open && (
          <div role="listbox" aria-label="Furniture"
            className="glass-menu absolute left-0 right-0 top-full z-40 mt-1.5 space-y-0.5 p-1.5 sm:right-auto sm:w-64">
            {kinds.map((k) => (
              <button key={k} type="button" role="option" aria-selected={kind === k} onClick={() => chooseKind(k)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${kind === k ? 'bg-primary/10 font-semibold text-foreground' : 'text-foreground/80 hover:bg-muted'}`}>
                <Check size={14} className={kind === k ? 'text-primary dark:text-accent' : 'invisible'} aria-hidden="true" />
                <span className="flex-1 truncate">{kindName(k)}</span>
                <span className="text-xs text-muted-foreground">{inKind(k).length}</span>
                <Badge n={waiting(k)} />
              </button>
            ))}
          </div>
        )}
      </div>
      <select id={selectId} aria-label="Order" value={current}
        onChange={(e) => onChange(e.target.value)} disabled={!orders.length && !empty}
        className="input-dark min-w-0 flex-1 sm:w-80 sm:flex-none">
        {empty !== undefined && <option value="">{empty}</option>}
        {!orders.length && empty === undefined && <option value="">No orders in progress</option>}
        {selected && !shown.includes(selected) && <option value="__other" disabled>Choose a {kindName(kind).toLowerCase()} order</option>}
        {shown.map((o) => (
          <option key={o.id} value={o.id}>{orderLabel(o)}{waitingForMe(o, me) ? ' · new for you' : ''}</option>
        ))}
      </select>
    </div>
  );
}

