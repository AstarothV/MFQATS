'use client';
import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';

const DAYS = 14;

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">Finished: <span className="font-semibold text-foreground">{payload[0].value}</span></p>
    </div>
  );
}

// Pieces finished (released for delivery) per day, from the stage history the database keeps.
export default function ThroughputChart() {
  const [data, setData] = useState<{ day: string; finished: number }[] | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (DAYS - 1));
    createClient().from('order_stage_history').select('entered_at').eq('status', 'delivered').gte('entered_at', from.toISOString())
      .then(({ data: rows }) => {
        const days = Array.from({ length: DAYS }, (_, i) => new Date(from.getTime() + i * 86_400_000));
        const key = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        const counts = new Map(days.map((d) => [key(d), 0]));
        for (const r of rows ?? []) {
          const k = key(new Date(r.entered_at));
          if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
        }
        setData([...counts].map(([day, finished]) => ({ day, finished })));
      });
  }, []);

  const total = data?.reduce((n, d) => n + d.finished, 0) ?? 0;
  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Finished pieces per day</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Released for delivery, last {DAYS} days</p>
        </div>
        {data && <span className="badge status-info">{total} finished</span>}
      </div>

      {!data ? (
        <div className="skeleton h-[200px] w-full rounded-xl" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradFinished" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="finished" stroke="var(--accent)" strokeWidth={2} fill="url(#gradFinished)" name="finished" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
