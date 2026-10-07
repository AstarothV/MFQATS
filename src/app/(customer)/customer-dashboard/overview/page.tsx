'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import CustomerOverviewContent from '../components/CustomerOverviewContent';

export default function CustomerOverviewPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/overview">
      <CustomerOverviewContent />
    </AppLayout>
  );
}
