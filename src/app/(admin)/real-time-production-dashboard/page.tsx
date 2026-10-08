import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProductionDashboardContent from './components/ProductionDashboardContent';

export default function RealTimeProductionDashboardPage() {
  return (
    <AppLayout role="admin" currentPath="/real-time-production-dashboard">
      <ProductionDashboardContent />
    </AppLayout>
  );
}