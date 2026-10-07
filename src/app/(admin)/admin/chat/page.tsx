import React from 'react';
import AppLayout from '@/components/AppLayout';
import MessagesHub from '@/components/ui/MessagesHub';

// Order chat + inquiries in one page. /admin/inquiry redirects here with ?tab=inquiries.
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <AppLayout role="admin" currentPath="/admin/chat">
      <MessagesHub userRole="admin" initialTab={tab === 'inquiries' ? 'inquiries' : 'chat'} />
    </AppLayout>
  );
}
