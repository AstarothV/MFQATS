'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import InquirySystem from '@/components/ui/InquirySystem';

export default function AdminInquiryPage() {
  return (
    <AppLayout role="admin" currentPath="/admin/inquiry">
      <InquirySystem userRole="admin" />
    </AppLayout>
  );
}
