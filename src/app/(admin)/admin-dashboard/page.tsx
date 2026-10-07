'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminDashboardContent from './components/AdminDashboardContent';

export default function AdminDashboardPage() {
  return (
    <AppLayout role="admin" currentPath="/admin-dashboard">
      <AdminDashboardContent />
    </AppLayout>
  );
}
