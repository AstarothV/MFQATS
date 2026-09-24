import React from 'react';
import AppLayout from '@/components/AppLayout';
import InventoryManagementContent from '@/components/ui/InventoryManagementContent';

export default function AdminInventoryPage() {
  return (
    <AppLayout role="admin" currentPath="/admin/inventory">
      <InventoryManagementContent />
    </AppLayout>
  );
}