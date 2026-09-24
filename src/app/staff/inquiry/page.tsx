'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import InquirySystem from '@/components/ui/InquirySystem';

export default function StaffInquiryPage() {
  return (
    <AppLayout role="staff" currentPath="/staff/inquiry">
      <InquirySystem userRole="staff" />
    </AppLayout>
  );
}