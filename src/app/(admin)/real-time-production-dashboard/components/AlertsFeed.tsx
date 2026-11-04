'use client';
import React from 'react';
import { AlertTriangle, Clock, UserX, XCircle } from 'lucide-react';
import { statusLabel } from '@/lib/orders';
import { stageTime, type FloorOrder } from './WorkstationGrid';

// What needs the admin's attention, from the orders in progress: a failed scan, a stage taking longer than it usually
// does, an approved order nobody is working on.
export default function AlertsFeed({ floor }: { floor: FloorOrder[] | null }) {
  const alerts = (floor ?? []).flatMap((o) => {
    const list: { key: string; icon: React.ElementType; tone: string; text: string }[] = [];
    if (o.lastScan?.result === 'fail') list.push({ key: `${o.id}-fail`, icon: XCircle, tone: 'text-danger', text: `${o.order_ref}: the last scan failed. It needs rework.` });
    if (stageTime(o).over) list.push({ key: `${o.id}-late`, icon: Clock, tone: 'text-warning', text: `${o.order_ref}: longer in ${statusLabel(o.status)} than it usually takes.` });
    if (!o.staff) list.push({ key: `${o.id}-staff`, icon: UserX, tone: 'text-warning', text: `${o.order_ref}: no staff assigned.` });
    return list;
  });

  return (
    <div className="card-dark p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Alerts</h3>
        {alerts.length > 0 && <span className="badge status-warning">{alerts.length}</span>}
      </div>
      {floor === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle size={14} /> Nothing needs attention.</p>
      ) : (
        <ul className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
          {alerts.map(({ key, icon: Icon, tone, text }) => (
            <li key={key} className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-3 text-sm">
              <Icon size={15} className={`mt-0.5 shrink-0 ${tone}`} />
              <span className="text-foreground">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
