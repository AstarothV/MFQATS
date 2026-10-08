import React from 'react';
import AppLayout from '@/components/AppLayout';

// Persistent customer shell: sidebar + topbar stay mounted while pages change.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout role="customer">{children}</AppLayout>;
}
