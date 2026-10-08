'use client';
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// BACKEND INTEGRATION: Replace with GET /api/production/throughput?shift=morning&date=2026-05-11
const data = [
  { hour: '06:00', completed: 2, target: 3 },
  { hour: '07:00', completed: 4, target: 3 },
  { hour: '08:00', completed: 3, target: 3 },
  { hour: '09:00', completed: 5, target: 4 },
  { hour: '10:00', completed: 4, target: 4 },
  { hour: '11:00', completed: 3, target: 4 },
  { hour: '12:00', completed: 2, target: 4 },
  { hour: '13:00', completed: 4, target: 4 },
  { hour: '14:00', completed: 3, target: 4 },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={`tooltip-row-${i}`} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value} units</span>
        </div>
      ))}
    </div>
  );
}

export default function ThroughputChart() {
  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Throughput — Morning Shift</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Completed workpieces per hour vs target</p>
        </div>
        <span className="badge status-warning">Below Target</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--muted-foreground)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--muted-foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="target"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="url(#gradTarget)"
            name="target"
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#gradCompleted)"
            name="completed"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}