import React from 'react';
import AppLayout from '@/components/AppLayout';

// Persistent admin shell: sidebar + topbar stay mounted while pages change.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout role="admin">{children}</AppLayout>;
}
