'use client';
import React from 'react';
import { CheckCircle2, Circle, Loader2, Lock, ChevronRight, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { PROCESS_STAGES, statusLabel, statusVariant } from '@/lib/orders';
import { VIEWS } from '@/app/(staff)/staff/quality-scan/PhotoSet';
import type { WorkFacts, WorkOrder } from './StaffDashboardContent';

interface Item { label: string; done: boolean; required: boolean }

const duration = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

// The checklist of the order's current stage, ticked from what is really saved (photos, 3D model, scans), so it is
// the same for everyone and updates as the work is done in Quality Scan. Submit moves the order to the next stage;
// the database still checks every move (a saved scan before Results, a passed scan before delivery).
function checklist(o: WorkOrder, f: WorkFacts, me: string): { title: string; items: Item[]; next: string | null; action: string } {
  const count = (kind: string) => VIEWS.filter((v) => f.captions.includes(`${v} ${kind}`)).length;
  const since = f.history.filter((h) => h.status === o.extended_status).at(-1)?.entered_at;
  const scanHere = !!f.scan && (!since || f.scan.at >= since);
  const passed = f.scan?.result === 'pass' || f.scan?.review === 'approved'; // an admin approved a false alarm
  switch (o.extended_status) {
    case 'confirmed': return { title: 'Before starting', next: 'upload', action: 'Start Production', items: [
      { label: 'Order approved by the admin', done: true, required: true },
      { label: 'Assigned to you', done: o.assigned_to === me, required: false },
    ] };
    case 'upload': return { title: 'Upload checklist', next: 'reconstruction_3d', action: 'Submit: go to 3D Reconstruction', items: [
      { label: 'Front photo taken', done: f.captions.includes('Front photo'), required: true },
      { label: `Every side photographed (${count('photo')} of ${VIEWS.length})`, done: count('photo') === VIEWS.length, required: false },
    ] };
    case 'reconstruction_3d': return { title: '3D Reconstruction checklist', next: 'detect_defects', action: 'Submit: go to Detect Defects', items: [
      { label: 'Upload photos taken', done: count('photo') > 0, required: true },
      { label: '3D model built and saved', done: !!o.model_3d_path, required: true },
    ] };
    case 'detect_defects': return { title: 'Detect Defects checklist', next: 'results', action: 'Submit: go to Results', items: [
      { label: `Close-ups of the sides (${count('close-up')} of ${VIEWS.length})`, done: count('close-up') === VIEWS.length, required: false },
      { label: 'Every side scanned and the scan saved', done: scanHere, required: true },
    ] };
    case 'results': return { title: 'Results checklist', next: 'recommendation', action: 'Submit: go to Recommendation', items: [
      { label: 'Scan saved', done: !!f.scan, required: true },
      { label: f.scan ? `Result: ${passed ? 'passed' : 'failed, needs rework'}` : 'Result', done: passed, required: false },
    ] };
    case 'recommendation': return f.scan?.review === 'requested'
      ? { title: 'Re-check / Finishing', next: null, action: '', items: [{ label: 'Waiting for the admin to review the failed scan (a possible false alarm)', done: false, required: true }] }
      : passed
      ? { title: 'Re-check / Finishing', next: 'delivered', action: 'Finish and release for delivery', items: [{ label: 'Latest saved scan passed', done: true, required: true }] }
      : { title: 'Re-check / Finishing', next: 'upload', action: 'Send back for rework', items: [{ label: 'Latest saved scan failed: fix the piece, then inspect it again', done: false, required: false }] };
    default: return { title: 'Checklist', next: null, action: '', items: [] };
  }
}

export default function StageProgressPanel({ order, facts, expected, me, moving, message, onSubmit }: {
  order: WorkOrder | null; facts: WorkFacts | null; expected: Record<string, number>; me: string;
  moving: boolean; message: { ok: boolean; text: string } | null; onSubmit: (to: string) => void;
}) {
  if (!order) {
    return (
      <div className="card-dark p-5 h-full flex items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">No order in progress. Orders appear here once the admin approves them.</p>
      </div>
    );
  }

  const at = PROCESS_STAGES.findIndex((s) => s.key === order.extended_status); // -1 = Confirmed, not started yet
  const spent = (key: string) => {
    const rows = (facts?.history ?? []).filter((h) => h.status === key);
    if (!rows.length) return null;
    return rows.reduce((ms, h) => ms + ((h.left_at ? new Date(h.left_at).getTime() : Date.now()) - new Date(h.entered_at).getTime()), 0);
  };
  const list = facts ? checklist(order, facts, me) : null;
  const ready = !!list && list.items.filter((i) => i.required).every((i) => i.done);

  return (
    <div className="card-dark p-5 h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{order.order_ref} · {order.product_name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{order.assigned_to === me ? 'Assigned to you' : 'Not assigned to you'}</p>
        </div>
        <StatusBadge variant={statusVariant(order.extended_status)} label={statusLabel(order.extended_status)} dot />
      </div>

      {/* Stage progress */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {PROCESS_STAGES.map((stage, idx) => {
          const state = idx < at ? 'complete' : idx === at ? 'active' : idx === at + 1 ? 'pending' : 'locked';
          const ms = spent(stage.key);
          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center min-w-[64px]">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                  state === 'complete' ? 'bg-emerald-500/20 text-success'
                    : state === 'active' ? 'bg-primary text-primary-foreground'
                    : state === 'pending' ? 'bg-muted text-muted-foreground border border-border' : 'bg-muted/50 text-muted-foreground/50 border border-border/50'
                }`}>
                  {state === 'complete' ? <CheckCircle2 size={14} /> : state === 'active' ? <Loader2 size={14} className="animate-spin" /> : state === 'locked' ? <Lock size={12} /> : <Circle size={12} />}
                </div>
                <span className={`text-2xs text-center leading-tight whitespace-nowrap ${state === 'active' ? 'text-accent font-semibold' : state === 'complete' ? 'text-success' : 'text-muted-foreground'}`}>
                  {stage.label}
                </span>
                <span className="text-2xs text-muted-foreground/70">
                  {ms !== null ? duration(ms) : expected[stage.key] ? `~${duration(expected[stage.key] * 3600000)} est` : '—'}
                </span>
              </div>
              {idx < PROCESS_STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 min-w-[12px] mt-[-14px] ${state === 'complete' ? 'bg-emerald-500/40' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Checklist of the current stage, from the real work */}
      {!list ? (
        <div aria-busy="true" className="flex min-h-[232px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading the checklist…</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">{list.title}</p>
            <span className="text-xs text-muted-foreground tabular-nums">{list.items.filter((i) => i.done).length}/{list.items.length}</span>
          </div>
          <ul className="space-y-2">
            {list.items.map((item) => (
              <li key={item.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${
                item.done ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/30 border-border'
              }`}>
                {item.done ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : <Circle size={15} className="shrink-0 text-muted-foreground" />}
                <span className={item.done ? 'text-muted-foreground' : 'text-foreground'}>{item.label}</span>
                {!item.required && <span className="ml-auto shrink-0 text-2xs text-muted-foreground">optional</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Ticks itself as the work is saved in Quality Scan.</p>

          {list.next && (
            <button
              onClick={() => onSubmit(list.next!)}
              disabled={!ready || moving}
              className="btn-primary mt-4 flex w-full items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              {moving ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />} {list.action}
            </button>
          )}
          {!ready && list.next && <p className="mt-2 text-xs text-muted-foreground">Finish the items that are not optional first.</p>}
          {message && (
            <p role="status" className={`mt-2 flex items-start gap-1.5 text-xs ${message.ok ? 'text-success' : 'text-danger'}`}>
              {message.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />} {message.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
