import React from 'react';
import AppLayout from '@/components/AppLayout';
import StaffInventoryContent from '@/components/ui/StaffInventoryContent';

export default function StaffInventoryPage() {
  return (
    <AppLayout role="staff" currentPath="/staff-dashboard/inventory">
      <StaffInventoryContent />
    </AppLayout>
  );
}
