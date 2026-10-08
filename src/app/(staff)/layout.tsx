import React from 'react';
import AppLayout from '@/components/AppLayout';

// Persistent staff shell: sidebar + topbar stay mounted while pages change.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout role="staff">{children}</AppLayout>;
}
