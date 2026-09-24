import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrderStatusTimeline from '../components/OrderStatusTimeline';

export default function CustomerOrderStatusPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/order-status">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold text-foreground">Order Status</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Track the progress of your current order and see each stage of production.
          </p>
        </div>
        <OrderStatusTimeline />
      </div>
    </AppLayout>
  );
}
