import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrderManagementContent from '@/app/orders/components/OrderManagementContent';

export default function StaffOrderWorkflowPage() {
  return (
    <AppLayout role="staff" currentPath="/staff-dashboard/orders">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-2xl font-semibold text-foreground">Order Workflow</h1>
          <p className="text-sm text-muted-foreground mt-2">
            View your assigned work orders and track progress on the production line.
          </p>
        </div>
        <OrderManagementContent />
      </div>
    </AppLayout>
  );
}
