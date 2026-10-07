import React from 'react';
import AppLayout from '@/components/AppLayout';
import CustomerShopContent from '@/components/ui/CustomerShopContent';

export default function CustomerShopPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/shop">
      <CustomerShopContent />
    </AppLayout>
  );
}
