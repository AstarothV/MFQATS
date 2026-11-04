'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ScanLine } from 'lucide-react';
import { statusLabel } from '@/lib/orders';
import type { WorkOrder } from './StaffDashboardContent';

const clock = (secs: number) => {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  return d ? `${d}d ${hms.slice(0, 5)}` : hms; // a day or more: days, hours and minutes
};

// How long the picked order has been in its stage (from the stage history the database keeps), against the
// PERT expected time for that stage.
export default function ActiveTimerWidget({ order, enteredAt, expectedHours }: {
  order: WorkOrder | null; enteredAt: string | null; expectedHours?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = enteredAt ? Math.max(0, Math.floor((now - new Date(enteredAt).getTime()) / 1000)) : null;
  const expectedSecs = expectedHours ? Math.round(expectedHours * 3600) : null;
  const over = elapsed !== null && expectedSecs !== null && elapsed > expectedSecs;
  const left = elapsed !== null && expectedSecs !== null ? Math.max(0, expectedSecs - elapsed) : null;

  return (
    <div className="card-dark p-5 h-full flex flex-col justify-between timer-glow relative overflow-hidden w-full">
      <div className="absolute top-0 right-0 w-32 h-32 blob-primary opacity-30 pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Time in this stage</p>
          <p className="text-sm font-semibold text-foreground">{order ? `${order.order_ref} · ${order.product_name}` : 'No order picked'}</p>
        </div>

        <div className={`text-center py-4 ${over ? 'text-warning' : 'text-accent'}`}>
          <p className="text-5xl font-bold tabular-nums tracking-tight leading-none">{elapsed !== null ? clock(elapsed) : '--:--:--'}</p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            {order ? `Stage: ${statusLabel(order.extended_status)}` : 'Pick an order at the top'}
            {left !== null && !over && ` · about ${left < 86400 ? clock(left).slice(0, 5) : clock(left)} left (expected)`}
          </p>
          {over && <p className="text-xs text-warning mt-1 font-medium">Longer than this stage usually takes</p>}
        </div>

        {enteredAt && (
          <div className="flex items-center gap-2 justify-center mb-4">
            <Clock size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Stage started {new Date(enteredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {order && (
        <Link href={`/staff/quality-scan?order=${order.id}`} className="relative z-10 btn-primary flex items-center justify-center gap-2 text-sm">
          <ScanLine size={15} /> Open in Quality Scan
        </Link>
      )}
    </div>
  );
}
