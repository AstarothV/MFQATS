'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrderViewContent from '../components/OrderViewContent';

export default function CustomerOrderViewPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/order-view">
      <OrderViewContent />
    </AppLayout>
  );
}
