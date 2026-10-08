import React from 'react';
import AppLayout from '@/components/AppLayout';
import MessagesHub from '@/components/ui/MessagesHub';

// Order chat + inquiries in one page. /staff/inquiry redirects here with ?tab=inquiries.
export default async function StaffMessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <AppLayout role="staff" currentPath="/staff/chat">
      <MessagesHub userRole="staff" initialTab={tab === 'inquiries' ? 'inquiries' : 'chat'} />
    </AppLayout>
  );
}
