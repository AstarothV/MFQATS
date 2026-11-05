'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, CATEGORY_COLOR, categoryOf } from '@/lib/furniture';

const DAYS = 14;
const SERIES = [...CATEGORIES, 'Other'];

// Sample numbers (clearly labelled on the chart) so it is not empty while there are few real orders. They come from
// the date and the category, so they stay the same on every load; real finished pieces are counted separately.
const WEIGHT: Record<string, number> = { Tables: 0.55, Chairs: 0.7, Beds: 0.3, Storage: 0.4, 'Office Furniture': 0.35, Cabinets: 0.3 };
function sample(dayKey: string, cat: string) {
  let h = 2166136261;
  for (const c of dayKey + cat) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = ((h >>> 0) % 1000) / 1000;
  const w = WEIGHT[cat] ?? 0;
  return r < w * 0.45 ? 2 : r < w ? 1 : 0;
}

type Day = { day: string; real: Record<string, number>; sample: Record<string, number> };

function CustomTooltip({ active, payload, label, rows, withSample }: {
  active?: boolean; payload?: { value: number }[]; label?: string; rows: Day[]; withSample: boolean;
}) {
  if (!active || !payload?.length) return null;
  const d = rows.find((r) => r.day === label);
  if (!d) return null;
  const real = Object.values(d.real).reduce((a, b) => a + b, 0);
  const smp = withSample ? Object.values(d.sample).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {SERIES.map((c) => {
        const n = d.real[c] + (withSample ? d.sample[c] : 0);
        return n ? (
          <p key={c} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />{c}: <span className="font-semibold text-foreground">{n}</span>
          </p>
        ) : null;
      })}
      <p className="pt-1 text-muted-foreground">{real} real{withSample ? ` · ${smp} sample` : ''}</p>
    </div>
  );
}

// Pieces finished (released for delivery) per day and furniture type, from the stage history the database keeps.
export default function ThroughputChart() {
  const [rows, setRows] = useState<Day[] | null>(null);
  const [withSample, setWithSample] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (DAYS - 1));
    (async () => {
      const [catOf, { data }] = await Promise.all([
        categoryOf(supabase),
        supabase.from('order_stage_history').select('entered_at, orders(product_name, product_category)').eq('status', 'delivered').gte('entered_at', from.toISOString()),
      ]);
      const key = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      const days: Day[] = Array.from({ length: DAYS }, (_, i) => {
        const k = key(new Date(from.getTime() + i * 86_400_000));
        return { day: k, real: Object.fromEntries(SERIES.map((c) => [c, 0])), sample: Object.fromEntries(SERIES.map((c) => [c, sample(k, c)])) };
      });
      for (const r of (data ?? []) as any[]) {
        const d = days.find((x) => x.day === key(new Date(r.entered_at)));
        if (d) d.real[catOf(r.orders)] += 1;
      }
      setRows(days);
    })().catch(() => setRows([]));
  }, []);

  const chart = useMemo(() => (rows ?? []).map((d) => ({
    day: d.day, ...Object.fromEntries(SERIES.map((c) => [c, d.real[c] + (withSample ? d.sample[c] : 0)])),
  })), [rows, withSample]);
  const realTotal = rows?.reduce((n, d) => n + Object.values(d.real).reduce((a, b) => a + b, 0), 0) ?? 0;
  const shown = SERIES.filter((c) => chart.some((d: any) => d[c] > 0));

  return (
    <div className="card-dark p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Finished pieces per day</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">By furniture type · released for delivery, last {DAYS} days · {realTotal} real</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
          <input type="checkbox" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} className="h-3.5 w-3.5" />
          Sample data
        </label>
      </div>

      {!rows ? (
        <div className="skeleton h-[200px] w-full rounded-xl" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<CustomTooltip rows={rows} withSample={withSample} />} />
              {shown.map((c, i) => (
                <Bar key={c} dataKey={c} stackId="cat" fill={CATEGORY_COLOR[c]} maxBarSize={28} radius={i === shown.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {shown.map((c) => (
              <li key={c} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_COLOR[c] }} />{c}</li>
            ))}
            {!shown.length && <li>No finished pieces in the last {DAYS} days.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
