'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Both charts use the large chart library, so they load after the rest of the page, in boxes of their final size.
const chartCard = () => <div className="card-dark h-[300px] p-5"><div className="skeleton h-full w-full rounded-xl" /></div>;
const ThroughputChart = dynamic(() => import('./ThroughputChart'), { ssr: false, loading: chartCard });
const DefectFrequencyChart = dynamic(() => import('./DefectFrequencyChart'), { ssr: false, loading: chartCard });

export default function ProductionChartsRow() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-4">
      <ThroughputChart />
      <DefectFrequencyChart />
    </div>
  );
}