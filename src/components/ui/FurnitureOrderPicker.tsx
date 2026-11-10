'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown } from 'lucide-react';
import { furnitureCounts, furnitureOf } from '@/lib/furniture';
import { ORDER_STATUSES, statusLabel } from '@/lib/orders';
import { stageDot } from '@/lib/orderGroups';
import { furnitureLabel } from '@/lib/pieces';

export interface PickerOrder {
  id: string;
  order_ref: string;
  product_name: string;
  product_category?: string | null;
  extended_status: string;
  assigned_to?: string | null;
  pieces?: string[] | null;
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
 * assigned to you that you have not started), then the order among that furniture, grouped by stage.
 */
export default function FurnitureOrderPicker({ orders, value, onChange, me, label, empty, selectId, autoPick = false }: {
  orders: PickerOrder[];
  value: string;
  onChange: (orderId: string) => void;
  me?: string;
  label: string; // what the pair is called, e.g. "Working on"
  empty?: string; // an extra first choice for "no order" (Quality Scan's practice scan)
  selectId?: string;
  autoPick?: boolean; // choosing a furniture also opens its first order (Workshop)
}) {
  const kinds = ['All', ...furnitureCounts(orders).map(([k]) => k)];
  const selected = orders.find((o) => o.id === value);
  const [kind, setKind] = useState('All');
  const [open, setOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const orderBox = useRef<HTMLDivElement>(null);

  // an order chosen from elsewhere (a link, a reload) shows under its own furniture
  useEffect(() => {
    if (selected && kind !== 'All' && furnitureOf(selected) !== kind) setKind(furnitureOf(selected));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useMenu(open, setOpen, box);
  useMenu(orderOpen, setOrderOpen, orderBox);

  const inKind = (k: string) => (k === 'All' ? orders : orders.filter((o) => furnitureOf(o) === k));
  const waiting = (k: string) => inKind(k).filter((o) => waitingForMe(o, me)).length;
  const shown = inKind(kind);
  const kindName = (k: string) => (k === 'All' ? 'All furniture' : k);
  // the chosen order belongs to another furniture than the one picked
  const other = !!selected && !shown.includes(selected);
  const groups = ORDER_STATUSES.map((st) => [st, shown.filter((o) => o.extended_status === st)] as const).filter(([, list]) => list.length);

  function chooseOrder(id: string) {
    setOrderOpen(false);
    onChange(id);
  }

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
      <div ref={orderBox} className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
        <button type="button" id={selectId} onClick={() => setOrderOpen(!orderOpen)} disabled={!orders.length && empty === undefined}
          aria-haspopup="listbox" aria-expanded={orderOpen} aria-label="Order"
          className="input-dark flex w-full items-center gap-2 text-left text-foreground">
          {selected && !other ? (
            <>
              <span className={`h-2 w-2 shrink-0 rounded-full ${stageDot(selected.extended_status)}`} aria-hidden="true" />
              <span className="font-semibold">{selected.order_ref}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{furnitureLabel(selected)}</span>
            </>
          ) : (
            <span className="flex-1 truncate text-muted-foreground">
              {other ? `Choose a ${kindName(kind).toLowerCase()} order` : empty ?? (orders.length ? 'Choose an order' : 'No orders in progress')}
            </span>
          )}
          <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${orderOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {orderOpen && (
          <div role="listbox" aria-label="Order"
            className="glass-menu absolute left-0 right-0 top-full z-40 mt-1.5 max-h-[60vh] overflow-y-auto p-1.5 sm:right-auto sm:w-96">
            {empty !== undefined && (
              <button type="button" role="option" aria-selected={!value} onClick={() => chooseOrder('')}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${!value ? 'bg-primary/10 font-semibold text-foreground' : 'text-foreground/80 hover:bg-muted'}`}>
                <Check size={14} className={!value ? 'text-primary dark:text-accent' : 'invisible'} aria-hidden="true" />
                {empty}
              </button>
            )}
            {groups.map(([st, list]) => {
              const done = st === 'delivered';
              return (
                <div key={st} role="group" aria-label={statusLabel(st)} className="mt-1.5 first:mt-0">
                  <p className={`flex items-center gap-2 px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider ${done ? 'text-success' : 'text-muted-foreground'}`}>
                    <span className={`h-2 w-2 rounded-full ${stageDot(st)}`} aria-hidden="true" />
                    {statusLabel(st)}{done ? ' · done' : ''}
                    <span className="ml-auto font-normal normal-case tracking-normal">{list.length}</span>
                  </p>
                  {list.map((o) => {
                    const on = o.id === value;
                    const mine = !!me && o.assigned_to === me;
                    return (
                      <button key={o.id} type="button" role="option" aria-selected={on} onClick={() => chooseOrder(o.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-primary/10 text-foreground' : done ? 'text-foreground/70 hover:bg-success/10' : 'text-foreground/90 hover:bg-muted'}`}>
                        {done
                          ? <CheckCircle2 size={14} className="shrink-0 text-success" aria-hidden="true" />
                          : <Check size={14} className={`shrink-0 ${on ? 'text-primary dark:text-accent' : 'invisible'}`} aria-hidden="true" />}
                        <span className="font-semibold">{o.order_ref}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{furnitureLabel(o)}</span>
                        {waitingForMe(o, me)
                          ? <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-2xs font-semibold text-danger">New</span>
                          : mine && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-2xs font-semibold text-primary dark:text-accent">Yours</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


/** Closes a dropdown on a click outside it or Escape, and focuses its chosen option when it opens. */
function useMenu(open: boolean, setOpen: (v: boolean) => void, box: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    box.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}
