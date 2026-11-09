'use client';
import React, { useCallback, useEffect, useState } from 'react';
import ProductionHeader from './ProductionHeader';
import KPICardGrid from './KPICardGrid';
import WorkstationGrid, { type FloorOrder } from './WorkstationGrid';
import ProductionChartsRow from './ProductionChartsRow';
import AlertsFeed from './AlertsFeed';
import StageTimelinePanel from './StageTimelinePanel';
import { createClient } from '@/lib/supabase/client';
import { furnitureLabel } from '@/lib/pieces';
import { ACTIVE_STATUSES, watchOrders } from '@/lib/staffAssignment';

// The orders being worked on now, with their staff, time in the current stage, the PERT expected time and the last scan.
async function loadFloor(): Promise<FloorOrder[]> {
  const supabase = createClient();
  const [orders, current, pert, scans] = await Promise.all([
    supabase.from('orders').select('*, staff:assigned_to(full_name)')
      .in('extended_status', ACTIVE_STATUSES).order('created_at'),
    supabase.from('order_stage_history').select('order_id, entered_at').is('left_at', null),
    supabase.rpc('stage_timeline_stats'),
    supabase.from('detection_logs').select('order_id, overall_result, created_at').order('created_at', { ascending: false }).limit(200),
  ]);
  const since = new Map((current.data ?? []).map((r: any) => [r.order_id, r.entered_at as string]));
  const expected = new Map<string, number>((pert.data ?? []).map((r: any) => [r.status, Number(r.expected_hours)]));
  const lastScan = new Map<string, { result: string; at: string }>();
  for (const s of scans.data ?? []) if (s.order_id && !lastScan.has(s.order_id)) lastScan.set(s.order_id, { result: s.overall_result, at: s.created_at });
  return (orders.data ?? []).map((o: any) => ({
    id: o.id, order_ref: o.order_ref, product_name: furnitureLabel(o), product_category: o.product_category, status: o.extended_status,
    staff: o.staff?.full_name ?? null,
    enteredAt: since.get(o.id) ?? null,
    expectedHours: expected.get(o.extended_status) ?? null,
    lastScan: lastScan.get(o.id) ?? null,
  }));
}

export default function ProductionDashboardContent() {
  const [floor, setFloor] = useState<FloorOrder[] | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [round, setRound] = useState(0); // a Refresh reloads the cards and charts too

  const refresh = useCallback(() => {
    loadFloor().then((f) => { setFloor(f); setUpdated(new Date()); }).catch(() => setFloor([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => watchOrders(createClient(), 'inspection_progress', refresh, 30000), [refresh]);

  return (
    <div className="space-y-6">
      <ProductionHeader updated={updated} onRefresh={() => { setRound((r) => r + 1); refresh(); }} />

      <KPICardGrid key={`k${round}`} />

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-4">
        <div className="2xl:col-span-3">
          <WorkstationGrid floor={floor} />
        </div>
        <div className="2xl:col-span-1">
          <AlertsFeed floor={floor} />
        </div>
      </div>

      <StageTimelinePanel key={`s${round}`} />

      <ProductionChartsRow key={`c${round}`} />
    </div>
  );
}
