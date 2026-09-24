'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// BACKEND INTEGRATION: Replace with GET /api/qa/defects/frequency?range=7d
const data = [
  { type: 'Surface Crack', count: 14, stage: 'Sanding' },
  { type: 'Joint Gap', count: 9, stage: 'Assembly' },
  { type: 'Finish Bleed', count: 7, stage: 'Finishing' },
  { type: 'Dim. Error', count: 6, stage: 'Cutting' },
  { type: 'Scratch', count: 11, stage: 'Sanding' },
  { type: 'Residue', count: 5, stage: 'Finishing' },
  { type: 'Knot Void', count: 3, stage: 'Cutting' },
];

const barColors = [
  'var(--danger)',
  'var(--warning)',
  'var(--warning)',
  'var(--accent)',
  'var(--danger)',
  'var(--accent)',
  'var(--muted-foreground)',
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload || !payload[0]) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">
        Defects: <span className="text-foreground font-bold">{payload[0].value}</span>
      </p>
    </div>
  );
}

export default function DefectFrequencyChart() {
  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Defect Frequency by Type</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 7 days — all stations</p>
        </div>
        <span className="badge status-danger">55 total defects</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="type"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cell-defect-${index}`} fill={barColors[index % barColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}