import React from 'react';
import ThroughputChart from './ThroughputChart';
import DefectFrequencyChart from './DefectFrequencyChart';

export default function ProductionChartsRow() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-4">
      <ThroughputChart />
      <DefectFrequencyChart />
    </div>
  );
}