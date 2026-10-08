'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import InquirySystem from '@/components/ui/InquirySystem';

export default function SupportPage() {
  return (
    <AppLayout role="customer" currentPath="/support">
      <InquirySystem userRole="customer" />
    </AppLayout>
  );
}
