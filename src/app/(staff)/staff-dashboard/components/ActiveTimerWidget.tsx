'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Loader2, Pause, Play, ScanLine } from 'lucide-react';
import { isProcessStage, statusLabel } from '@/lib/orders';
import type { WorkOrder } from './StaffDashboardContent';

const clock = (secs: number) => {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  return d ? `${d}d ${hms.slice(0, 5)}` : hms; // a day or more: days, hours and minutes
};

// Working time of the picked order in its stage: from when the stage started (the stage history the database keeps),
// minus the pauses, against the PERT expected time for that stage. It runs from Start Production; Pause is saved with
// the order, so it holds after a reload and on every device, and it resets when the order moves to the next stage.
export default function ActiveTimerWidget({ order, enteredAt, expectedHours, busy, onPause }: {
  order: WorkOrder | null; enteredAt: string | null; expectedHours?: number;
  busy: boolean; onPause: (pause: boolean) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const started = !!order && isProcessStage(order.extended_status); // Start Production moves it into Upload
  const paused = !!order?.paused_at;
  const elapsed = started && enteredAt
    ? Math.max(0, Math.floor(((paused ? Date.parse(order!.paused_at!) : now) - Date.parse(enteredAt)) / 1000) - (order!.paused_seconds ?? 0))
    : null;
  const expectedSecs = expectedHours ? Math.round(expectedHours * 3600) : null;
  const over = elapsed !== null && expectedSecs !== null && elapsed > expectedSecs;
  const left = elapsed !== null && expectedSecs !== null ? Math.max(0, expectedSecs - elapsed) : null;

  return (
    <div className="card-dark p-5 h-full flex flex-col justify-between timer-glow relative overflow-hidden w-full">
      <div className="absolute top-0 right-0 w-32 h-32 blob-primary opacity-30 pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Time in this stage</p>
            <p className="text-sm font-semibold text-foreground">{order ? `${order.order_ref} · ${order.product_name}` : 'No order picked'}</p>
          </div>
          {started && (
            <span className={`badge shrink-0 ${paused ? 'status-warning' : 'status-ok'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-warning' : 'bg-success animate-pulse-subtle'}`} />
              {paused ? 'Paused' : 'Running'}
            </span>
          )}
        </div>

        <div className={`text-center py-4 ${!started || paused ? 'text-muted-foreground' : over ? 'text-warning' : 'text-accent'}`}>
          <p className="text-5xl font-bold tabular-nums tracking-tight leading-none">{elapsed !== null ? clock(elapsed) : '00:00:00'}</p>
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            {!order ? 'Pick an order at the top'
              : !started ? 'Starts when you press Start Production'
              : `Stage: ${statusLabel(order.extended_status)}${left !== null && !over ? ` · about ${left < 86400 ? clock(left).slice(0, 5) : clock(left)} left (expected)` : ''}`}
          </p>
          {started && over && !paused && <p className="text-xs text-warning mt-1 font-medium">Longer than this stage usually takes</p>}
        </div>

        {started && enteredAt && (
          <div className="flex items-center gap-2 justify-center mb-4">
            <Clock size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Stage started {new Date(enteredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {order && (
        <div className="relative z-10 space-y-2">
          {started && (
            <button
              onClick={() => onPause(!paused)}
              disabled={busy}
              className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
                paused ? 'border border-emerald-500/30 bg-emerald-500/15 text-success hover:bg-emerald-500/25' : 'border border-amber-500/30 bg-amber-500/15 text-warning hover:bg-amber-500/25'
              }`}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : paused ? <Play size={15} /> : <Pause size={15} />}
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
          <Link href={`/staff/quality-scan?order=${order.id}`} className="btn-primary flex items-center justify-center gap-2 text-sm">
            <ScanLine size={15} /> Open in Quality Scan
          </Link>
        </div>
      )}
    </div>
  );
}
