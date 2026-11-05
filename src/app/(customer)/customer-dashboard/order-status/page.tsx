import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrderStatusTimeline from '../components/OrderStatusTimeline';

export default function CustomerOrderStatusPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/order-status">
      <div className="space-y-6">
        <div>
          <p className="page-eyebrow">Your orders</p>
          <h1 className="page-title">Order Status</h1>
          <p className="page-subtitle">
            Track the progress of your current order and see each stage of the inspection process.
          </p>
        </div>
        <OrderStatusTimeline />
      </div>
    </AppLayout>
  );
}
