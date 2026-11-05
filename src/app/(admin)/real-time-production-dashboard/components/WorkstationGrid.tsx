'use client';
import React, { useEffect, useState } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import { statusLabel, statusVariant } from '@/lib/orders';
import OrderReviewPanel from './OrderReviewPanel';

export interface FloorOrder {
  id: string;
  order_ref: string;
  product_name: string;
  status: string;
  staff: string | null;
  enteredAt: string | null; // when it entered its current stage
  expectedHours: number | null; // PERT expected time for that stage
  lastScan: { result: string; at: string } | null;
}

const hours = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : `${Math.round(h / 24)}d`);

/** Time in the current stage, and whether it is longer than the stage usually takes. */
export function stageTime(o: FloorOrder, now = Date.now()) {
  const spent = o.enteredAt ? (now - Date.parse(o.enteredAt)) / 3_600_000 : null;
  return { spent, over: spent !== null && o.expectedHours !== null && spent > o.expectedHours };
}

// Every order being worked on, one card each: stage, staff, time in the stage against the expected time, last scan.
export default function WorkstationGrid({ floor }: { floor: FloorOrder[] | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<FloorOrder | null>(null);
  // a notification link (?order=<id>) opens that order's panel once the orders have loaded
  const linked = React.useRef(false);
  useEffect(() => {
    if (!floor || linked.current) return;
    linked.current = true;
    const wanted = new URLSearchParams(window.location.search).get('order');
    const hit = wanted ? floor.find((o) => o.id === wanted) : null;
    if (hit) setOpen(hit);
    // not in progress any more (e.g. delivered): show it in Order Management instead
    else if (wanted) window.location.replace(`/orders?order=${encodeURIComponent(wanted)}`);
  }, [floor]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card-dark p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Orders in progress</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Open an order to see its defects and comment on them.</p>
        </div>
        <span className="text-xs text-muted-foreground">{floor ? `${floor.length} order${floor.length === 1 ? '' : 's'}` : ''}</span>
      </div>

      {floor === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : floor.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No orders in progress. Approved orders appear here.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          {floor.map((o) => {
            const { spent, over } = stageTime(o, now);
            const failed = o.lastScan?.result === 'fail';
            const pct = spent !== null && o.expectedHours ? Math.min(100, (spent / o.expectedHours) * 100) : 0;
            return (
              <button type="button" key={o.id} onClick={() => setOpen(o)} aria-label={`Open ${o.order_ref}: defects and comments`}
                className={`card-hover rounded-2xl border p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${failed ? 'border-red-500/40 bg-red-500/5' : over ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{o.order_ref}</p>
                    <p className="truncate text-xs text-muted-foreground">{o.product_name}</p>
                  </div>
                  <StatusBadge variant={statusVariant(o.status)} label={statusLabel(o.status)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{o.staff ?? <span className="font-semibold text-warning">No staff assigned</span>}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${over ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`mt-1.5 text-xs ${over ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
                  {spent === null ? 'Time in stage not recorded' : `${hours(spent)} in this stage`}
                  {o.expectedHours !== null && ` · expected ${hours(o.expectedHours)}`}
                </p>
                {o.lastScan && (
                  <p className={`mt-1 text-xs ${failed ? 'font-semibold text-danger' : 'text-success'}`}>
                    Last scan {failed ? 'failed' : 'passed'}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
      {open && <OrderReviewPanel order={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
