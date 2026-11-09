'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ActiveTimerWidget from './ActiveTimerWidget';
import AssignedTasksList from './AssignedTasksList';
import StageProgressPanel from './StageProgressPanel';
import QuickActionTiles from './QuickActionTiles';
import RecentQAFeed from './RecentQAFeed';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { moveOrderStage, statusLabel } from '@/lib/orders';
import { ACTIVE_STATUSES, watchOrders } from '@/lib/staffAssignment';
import FurnitureOrderPicker from '@/components/ui/FurnitureOrderPicker';
import { dataUserId } from '@/lib/viewer';
import { furnitureLabel } from '@/lib/pieces';

export interface WorkOrder {
  id: string;
  order_ref: string;
  product_name: string;
  extended_status: string;
  assigned_to: string | null;
  model_3d_path: string | null;
  paused_at?: string | null; // the stage timer is paused (migration 014)
  paused_seconds?: number;
  pieces?: string[]; // a set of chairs...: each piece is inspected on its own (migration 026)
}

/** What has really been done on the order, read from the database; the checklist ticks itself from it. */
export interface WorkFacts {
  history: { status: string; entered_at: string; left_at: string | null }[];
  captions: string[]; // saved photos, e.g. "Front photo", "Top close-up"
  scan: { result: string; at: string; review: string | null } | null; // the latest saved scan, and its admin review
  pieceScans: Record<string, { result: string; at: string; review: string | null }>; // the latest saved scan of each piece
}

const PICK_KEY = 'mfqats-workshop-order';

// The Workshop: the order the staff member picks, its stage, the time in it, and a checklist that follows the real work.
export default function StaffDashboardContent() {
  const { user } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [facts, setFacts] = useState<WorkFacts | null>(null);
  const [expected, setExpected] = useState<Record<string, number>>({}); // PERT hours per stage
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const selectedRef = useRef('');
  selectedRef.current = selectedId;

  const loadFacts = useCallback(async (orderId: string) => {
    if (!orderId) { setFacts(null); return; }
    const [history, images, scan, perPiece] = await Promise.all([
      supabase.from('order_stage_history').select('status, entered_at, left_at').eq('order_id', orderId).order('entered_at'),
      supabase.from('inspection_images').select('caption').eq('order_id', orderId),
      supabase.from('detection_logs').select('overall_result, created_at, review_status').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then((r) => (r.error ? supabase.from('detection_logs').select('overall_result, created_at').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle() : r)),
      supabase.from('detection_logs').select('piece, overall_result, created_at, review_status').eq('order_id', orderId).not('piece', 'is', null).order('created_at', { ascending: false }),
    ]);
    const pieceScans: WorkFacts['pieceScans'] = {};
    for (const r of (perPiece.data ?? []) as any[]) if (!pieceScans[r.piece]) pieceScans[r.piece] = { result: r.overall_result, at: r.created_at, review: r.review_status ?? null };
    if (selectedRef.current !== orderId) return; // another order was picked meanwhile
    setFacts({
      history: history.data ?? [],
      captions: (images.data ?? []).map((r) => r.caption),
      scan: scan.data ? { result: scan.data.overall_result, at: scan.data.created_at, review: (scan.data as any).review_status ?? null } : null,
      pieceScans,
    });
  }, [supabase]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('orders')
      .select('*') // all columns: works before and after the pause columns are added
      .in('extended_status', ACTIVE_STATUSES).order('created_at', { ascending: false });
    const list = ((data ?? []) as WorkOrder[]).sort((a, b) => Number(b.assigned_to === user.id) - Number(a.assigned_to === user.id));
    setOrders(list);
    // keep the order picked before (also after a reload); else the first one assigned to this staff member
    let pick = selectedRef.current;
    if (!pick) { try { pick = localStorage.getItem(PICK_KEY) ?? ''; } catch {} }
    if (!list.some((o) => o.id === pick)) pick = list[0]?.id ?? '';
    setSelectedId(pick);
    selectedRef.current = pick;
    loadFacts(pick);
  }, [supabase, user, loadFacts]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => watchOrders(supabase, 'workshop_orders', load), [supabase, load]);
  useEffect(() => {
    supabase.rpc('stage_timeline_stats').then(({ data }) => {
      setExpected(Object.fromEntries((data ?? []).map((s: any) => [s.status, Number(s.expected_hours)])));
    });
  }, [supabase]);

  function pick(id: string) {
    setSelectedId(id);
    selectedRef.current = id;
    setFacts(null);
    setMessage(null);
    try { localStorage.setItem(PICK_KEY, id); } catch {}
    loadFacts(id);
  }

  const order = orders.find((o) => o.id === selectedId) ?? null;

  async function submit(to: string) {
    if (!order) return;
    setMoving(true);
    setMessage(null);
    try {
      await moveOrderStage(supabase, order, to);
      setMessage({ ok: true, text: `${order.order_ref} moved to ${statusLabel(to)}.` });
      await load();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Could not move the order.' });
    } finally {
      setMoving(false);
    }
  }

  // Pause / resume the stage timer; saved with the order, so it is the same everywhere.
  const [pausing, setPausing] = useState(false);
  async function setPaused(pause: boolean) {
    if (!order) return;
    const now = Date.now();
    const patch = pause
      ? { paused_at: new Date(now).toISOString() }
      : { paused_at: null, paused_seconds: (order.paused_seconds ?? 0) + Math.round((now - Date.parse(order.paused_at!)) / 1000) };
    setPausing(true);
    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    setPausing(false);
    if (error) {
      setMessage({ ok: false, text: /paused_/.test(error.message) ? 'Pause needs the latest database update (migration 014).' : error.message });
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...patch } : o)));
  }

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const current = facts?.history.filter((h) => h.status === order?.extended_status && !h.left_at).at(-1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-eyebrow">Workshop</p>
          <h1 className="page-title">Workshop View</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <FurnitureOrderPicker label="Working on" orders={orders} value={selectedId} onChange={pick} autoPick
          me={user ? dataUserId(user) : undefined}
          orderLabel={(o) => `${o.order_ref} — ${furnitureLabel(o as any)} (${statusLabel(o.extended_status)})${o.assigned_to === user?.id ? ' · yours' : ''}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <ActiveTimerWidget order={order} enteredAt={current?.entered_at ?? null} expectedHours={order ? expected[order.extended_status] : undefined} busy={pausing} onPause={setPaused} />
        </div>
        <div className="lg:col-span-2">
          <StageProgressPanel order={order} facts={facts} expected={expected} me={user?.id ?? ''} moving={moving} message={message} onSubmit={submit} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AssignedTasksList />
        </div>
        <div className="lg:col-span-1">
          <QuickActionTiles orderId={order?.id ?? null} />
        </div>
      </div>

      <RecentQAFeed />

      {/* Mobile Bottom Bar Spacer */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}
