import React from 'react';
import AppLayout from '@/components/AppLayout';
import StaffDashboardContent from './components/StaffDashboardContent';

export default function StaffDashboardPage() {
  return (
    <AppLayout role="staff" currentPath="/staff-dashboard">
      <StaffDashboardContent />
    </AppLayout>
  );
}