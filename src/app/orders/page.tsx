'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrderManagementContent from './components/OrderManagementContent';

export default function OrdersPage() {
  return (
    <AppLayout role="admin" currentPath="/orders">
      <OrderManagementContent />
    </AppLayout>
  );
}
