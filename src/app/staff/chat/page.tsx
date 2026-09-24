import React from 'react';
import AppLayout from '@/components/AppLayout';
import ChatSystem from '@/components/ui/ChatSystem';

export default function StaffChatPage() {
  return (
    <AppLayout role="staff" currentPath="/staff/chat">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] mb-2">Communication</p>
          <h1 className="text-3xl font-bold text-foreground">Customer Chat</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Communicate with customers about their orders. Send production updates and photos.
          </p>
        </div>
        <ChatSystem userRole="staff" />
      </div>
    </AppLayout>
  );
}