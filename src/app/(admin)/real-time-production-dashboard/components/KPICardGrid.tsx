'use client';

import React, { useEffect, useState } from 'react';
import KPISparklineCard from './KPISparklineCard';
import { createClient } from '@/lib/supabase/client';
import { defectRate, fetchInspectionCounts, type InspectionCounts } from '@/lib/inspections';
import { PROCESS_STAGES, isProcessStage, statusLabel } from '@/lib/orders';

type Variant = 'neutral' | 'ok' | 'warning' | 'danger';

interface Stats {
  wip: number;
  cycleHours: number | null; // average time an order spent in one inspection stage
  cycleSamples: number;
  bottlenecks: string[]; // stages with an order there longer than the stage's PERT expected time
  inspections: InspectionCounts;
}

const hoursText = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`);

async function loadStats(): Promise<Stats> {
  const supabase = createClient();
  const stages = PROCESS_STAGES.map((s) => s.key);
  const [orders, finished, current, pert, inspections] = await Promise.all([
    supabase.from('orders').select('extended_status'),
    supabase.from('order_stage_history').select('entered_at, left_at').in('status', stages).not('left_at', 'is', null),
    supabase.from('order_stage_history').select('status, entered_at').in('status', stages).is('left_at', null),
    supabase.rpc('stage_timeline_stats'),
    fetchInspectionCounts(supabase),
  ]);
  const visits = (finished.data ?? []).map((r: any) => (Date.parse(r.left_at) - Date.parse(r.entered_at)) / 3_600_000);
  const expected = new Map<string, number>((pert.data ?? []).map((r: any) => [r.status, Number(r.expected_hours)]));
  const late = new Set<string>();
  for (const r of current.data ?? []) {
    const limit = expected.get(r.status);
    if (limit != null && (Date.now() - Date.parse(r.entered_at)) / 3_600_000 > limit) late.add(r.status);
  }
  return {
    wip: (orders.data ?? []).filter((o: any) => isProcessStage(o.extended_status)).length,
    cycleHours: visits.length ? visits.reduce((a, b) => a + b, 0) / visits.length : null,
    cycleSamples: visits.length,
    bottlenecks: stages.filter((s) => late.has(s)).map((s) => statusLabel(s)),
    inspections,
  };
}

export default function KPICardGrid() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    loadStats().then(setStats).catch(() => {});
  }, []);

  const loading = 'Loading…';
  const i = stats?.inspections;
  // pass rate is the other side of the defect rate: same inspections, same numbers
  const passRate = i && i.total > 0 ? 100 - defectRate(i) : null;

  const cards = [
    {
      id: 'kpi-wip',
      label: 'Total WIP',
      value: stats ? String(stats.wip) : '—',
      unit: 'orders in inspection',
      delta: stats ? (stats.wip ? 'In one of the five stages now' : 'No orders in inspection') : loading,
      deltaPositive: false,
      variant: 'neutral' as Variant,
    },
    {
      id: 'kpi-cycletime',
      label: 'Avg Cycle Time',
      value: stats?.cycleHours != null ? hoursText(stats.cycleHours) : '—',
      unit: 'per stage',
      delta: stats ? (stats.cycleSamples ? `From ${stats.cycleSamples} finished stage${stats.cycleSamples === 1 ? '' : 's'}` : 'No finished stages yet') : loading,
      deltaPositive: false,
      variant: 'neutral' as Variant,
    },
    {
      id: 'kpi-passrate',
      label: 'Inspection Pass Rate',
      value: passRate === null ? '—' : `${passRate.toFixed(1)}%`,
      unit: 'all inspections',
      delta: i ? `${i.total - i.failed} of ${i.total} passed` : loading,
      deltaPositive: passRate !== null && passRate >= 90,
      variant: (passRate === null ? 'neutral' : passRate >= 90 ? 'ok' : passRate >= 75 ? 'warning' : 'danger') as Variant,
    },
    {
      id: 'kpi-bottlenecks',
      label: 'Active Bottlenecks',
      value: stats ? String(stats.bottlenecks.length) : '—',
      unit: 'stages past their PERT time',
      delta: stats ? (stats.bottlenecks.length ? stats.bottlenecks.join(' · ') : 'None: every order is on time') : loading,
      deltaPositive: stats ? stats.bottlenecks.length === 0 : false,
      variant: (stats && stats.bottlenecks.length ? 'danger' : 'neutral') as Variant,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {cards.map((kpi) => (
        <KPISparklineCard key={kpi.id} {...kpi} sparkData={[]} sparkColor="var(--accent)" />
      ))}
    </div>
  );
}
