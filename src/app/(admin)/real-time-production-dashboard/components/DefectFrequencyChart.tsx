'use client';
import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, categoryOf } from '@/lib/furniture';

const DAYS = 30;
const SEVERITY_COLOR: Record<string, string> = { high: 'var(--danger)', critical: 'var(--danger)', medium: 'var(--warning)', low: 'var(--accent)' };

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload || !payload[0]) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1 capitalize">{label}</p>
      <p className="text-muted-foreground">
        Defects: <span className="text-foreground font-bold">{payload[0].value}</span>
      </p>
    </div>
  );
}

type Row = { type: string; severity: string; category: string };

// Defects found by the saved scans, by type, for all furniture or one furniture type (the defects table holds the
// ones that fail a piece).
export default function DefectFrequencyChart() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cat, setCat] = useState('All');

  useEffect(() => {
    const supabase = createClient();
    const from = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    (async () => {
      const [catOf, { data: list }] = await Promise.all([
        categoryOf(supabase),
        supabase.from('defects').select('defect_type, severity, orders(product_name, product_category)').gte('created_at', from),
      ]);
      setRows(((list ?? []) as any[]).map((r) => ({ type: (r.defect_type || 'unknown').replace(/_/g, ' '), severity: r.severity, category: catOf(r.orders) })));
    })().catch(() => setRows([]));
  }, []);

  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const chips = ['All', ...[...CATEGORIES, 'Other'].filter((c) => counts.get(c))];
  const data = rows === null ? null : (() => {
    const byType = new Map<string, { count: number; severity: string }>();
    for (const r of rows) {
      if (cat !== 'All' && r.category !== cat) continue;
      const cur = byType.get(r.type) ?? { count: 0, severity: r.severity };
      byType.set(r.type, { count: cur.count + 1, severity: cur.severity });
    }
    return [...byType].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.count - a.count).slice(0, 8);
  })();

  const total = data?.reduce((n, d) => n + d.count, 0) ?? 0;
  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Defect Frequency by Type</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{cat === 'All' ? 'All furniture' : cat} · last {DAYS} days, from saved scans</p>
        </div>
        {data && <span className={`badge ${total ? 'status-danger' : 'status-ok'}`}>{total} defect{total === 1 ? '' : 's'}</span>}
      </div>
      {chips.length > 2 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Furniture type">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${cat === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {c}{c !== 'All' && <span className="ml-1 opacity-70">{counts.get(c)}</span>}
            </button>
          ))}
        </div>
      )}

      {!data ? (
        <div className="skeleton h-[200px] w-full rounded-xl" />
      ) : data.length === 0 ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No defects found{cat === 'All' ? '' : ` on ${cat.toLowerCase()}`} in the last {DAYS} days.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry) => (
                <Cell key={entry.type} fill={SEVERITY_COLOR[entry.severity] ?? 'var(--accent)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
