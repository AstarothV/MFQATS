'use client';

import dynamic from 'next/dynamic';

// Charts load after the page (see Charts.tsx); the placeholder fills the chart's box so nothing shifts.
const placeholder = () => <div className="skeleton h-full w-full rounded-xl" />;

export const RevenueAreaChart = dynamic(() => import('./Charts').then((m) => m.RevenueAreaChart), { ssr: false, loading: placeholder });
export const SimpleBarChart = dynamic(() => import('./Charts').then((m) => m.SimpleBarChart), { ssr: false, loading: placeholder });
export const DonutChart = dynamic(() => import('./Charts').then((m) => m.DonutChart), { ssr: false, loading: placeholder });
