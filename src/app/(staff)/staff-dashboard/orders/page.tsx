import React from 'react';
import AppLayout from '@/components/AppLayout';
import OrderManagementContent from '@/app/(admin)/orders/components/OrderManagementContent';

export default function StaffOrderWorkflowPage() {
  return (
    <AppLayout role="staff" currentPath="/staff-dashboard/orders">
      <OrderManagementContent eyebrow="Order Workflow" />
    </AppLayout>
  );
}
