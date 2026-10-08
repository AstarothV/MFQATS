'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import InquirySystem from '@/components/ui/InquirySystem';

export default function CustomerInquiryPage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/inquiry">
      <InquirySystem userRole="customer" />
    </AppLayout>
  );
}
