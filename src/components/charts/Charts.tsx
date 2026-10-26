'use client';

// The chart library is large (about 100 kB), so pages import these through ./lazy (next/dynamic): the page shows
// first, and each chart a moment later in the space kept for it.
import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend, ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis,
} from 'recharts';

const GRID = 'rgba(128,128,128,0.18)';
const TICK = { fill: '#A49CB3', fontSize: 11 };
// tooltips follow the theme (inline styles accept CSS variables)
const TOOLTIP = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' },
  labelStyle: { color: 'var(--foreground)' },
  itemStyle: { color: 'var(--foreground)' },
};

export function RevenueAreaChart({
  data, xKey, yKey, tickFormatter, valueFormatter, label,
}: {
  data: object[]; xKey: string; yKey: string; label: string;
  tickFormatter: (v: number) => string; valueFormatter: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={TICK} />
        <YAxis axisLine={false} tickLine={false} tick={TICK} tickFormatter={(v) => tickFormatter(Number(v))} />
        <Tooltip {...TOOLTIP} formatter={(v) => [valueFormatter(Number(v)), label]} />
        <Area type="monotone" dataKey={yKey} stroke="#7C3AED" strokeWidth={3} fill="url(#revenueGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({ data, xKey, yKey }: { data: object[]; xKey: string; yKey: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
        <Bar dataKey={yKey} fill="#7C3AED" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data, valueKey, nameKey, colors, innerRadius = 58, outerRadius = 90,
}: {
  data: object[]; valueKey: string; nameKey: string; colors: string[]; innerRadius?: number; outerRadius?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={4} stroke="transparent">
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
        <Legend verticalAlign="bottom" align="center" iconType="circle" formatter={(v) => <span className="text-sm text-muted-foreground">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
