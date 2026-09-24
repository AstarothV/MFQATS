import React from 'react';
import KPISparklineCard from './KPISparklineCard';

// 4 cards → 4-col single row (or 2×2 on smaller screens)
const kpiData = [
  {
    id: 'kpi-wip',
    label: 'Total WIP',
    value: '34',
    unit: 'workpieces',
    delta: '+3 since 08:00',
    deltaPositive: false,
    variant: 'neutral' as const,
    sparkData: [28, 30, 29, 31, 33, 32, 34],
    sparkColor: 'var(--accent)',
  },
  {
    id: 'kpi-cycletime',
    label: 'Avg Cycle Time',
    value: '1h 48m',
    unit: 'per stage',
    delta: '+12m vs yesterday',
    deltaPositive: false,
    variant: 'warning' as const,
    sparkData: [82, 88, 91, 96, 102, 108, 108],
    sparkColor: 'var(--warning)',
  },
  {
    id: 'kpi-passrate',
    label: 'First-Time Pass Rate',
    value: '82.4%',
    unit: 'this shift',
    delta: '-4.1% vs last shift',
    deltaPositive: false,
    variant: 'danger' as const,
    sparkData: [91, 89, 88, 87, 85, 84, 82],
    sparkColor: 'var(--danger)',
  },
  {
    id: 'kpi-bottlenecks',
    label: 'Active Bottlenecks',
    value: '3',
    unit: 'stations',
    delta: 'Sanding · Finishing · S4',
    deltaPositive: false,
    variant: 'danger' as const,
    sparkData: [0, 1, 1, 2, 2, 3, 3],
    sparkColor: 'var(--danger)',
  },
];

export default function KPICardGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {kpiData.map((kpi) => (
        <KPISparklineCard key={kpi.id} {...kpi} />
      ))}
    </div>
  );
}