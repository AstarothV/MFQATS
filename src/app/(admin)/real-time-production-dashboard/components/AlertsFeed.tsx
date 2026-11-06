'use client';
import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, UserX, XCircle } from 'lucide-react';
import { statusLabel } from '@/lib/orders';
import { stageTime, type FloorOrder } from './WorkstationGrid';

type Issue = { key: string; icon: React.ElementType; tone: string; text: string };

// What needs the admin's attention, from the orders in progress: a failed scan, a stage taking longer than it usually
// does, an approved order nobody is working on. One card per order, with all of its problems inside.
export default function AlertsFeed({ floor }: { floor: FloorOrder[] | null }) {
  const cards = (floor ?? []).map((o) => {
    const issues: Issue[] = [];
    if (o.lastScan?.result === 'fail') issues.push({ key: 'fail', icon: XCircle, tone: 'text-danger', text: 'Last scan failed: needs rework' });
    if (stageTime(o).over) issues.push({ key: 'late', icon: Clock, tone: 'text-warning', text: `Taking longer than usual in ${statusLabel(o.status)}` });
    if (!o.staff) issues.push({ key: 'staff', icon: UserX, tone: 'text-warning', text: 'No staff assigned' });
    return { order: o, issues };
  }).filter((c) => c.issues.length)
    // most urgent first: a failed scan, then the most problems
    .sort((a, b) => Number(b.issues[0].key === 'fail') - Number(a.issues[0].key === 'fail') || b.issues.length - a.issues.length);
  const total = cards.reduce((n, c) => n + c.issues.length, 0);

  return (
    <div className="card-dark h-full p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Alerts</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Orders in progress that need attention.</p>
        </div>
        {total > 0 && <span className="badge status-warning shrink-0">{total}</span>}
      </div>
      {floor === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 size={14} className="text-success" /> Nothing needs attention.</p>
      ) : (
        // full width under the orders on most screens (cards side by side); a side column only on very wide ones
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1">
          {cards.map(({ order, issues }) => (
            <li key={order.id} className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{order.order_ref}</span>
                <span className="truncate text-xs text-muted-foreground">{order.product_name}</span>
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {issues.map(({ key, icon: Icon, tone, text }) => (
                  <li key={key} className="flex items-start gap-2 text-sm text-foreground">
                    <Icon size={15} className={`mt-0.5 shrink-0 ${tone}`} aria-hidden="true" />
                    <span className="[text-wrap:wrap]">{text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {cards.length === 0 && floor !== null && floor.length === 0 && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle size={12} /> No orders in progress.</p>
      )}
    </div>
  );
}
