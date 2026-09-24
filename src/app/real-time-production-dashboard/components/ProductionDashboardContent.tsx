import React from 'react';
import ProductionHeader from './ProductionHeader';
import KPICardGrid from './KPICardGrid';
import WorkstationGrid from './WorkstationGrid';
import ProductionChartsRow from './ProductionChartsRow';
import AlertsFeed from './AlertsFeed';

export default function ProductionDashboardContent() {
  return (
    <div className="space-y-6">
      <ProductionHeader />

      {/* KPIs */}
      <KPICardGrid />

      {/* Main Grid: Workstations + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 2xl:col-span-3">
          <WorkstationGrid />
        </div>
        <div className="xl:col-span-1 2xl:col-span-1">
          <AlertsFeed />
        </div>
      </div>

      {/* Charts Row */}
      <ProductionChartsRow />
    </div>
  );
}