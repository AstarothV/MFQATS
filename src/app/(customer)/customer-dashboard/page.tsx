'use client';
import React, { useEffect } from 'react';

import AppLayout from '@/components/AppLayout';
import CustomerOverviewContent from './components/CustomerOverviewContent';

export default function CustomerDashboardPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/overview">
      <CustomerOverviewContent />
    </AppLayout>
  );
}
