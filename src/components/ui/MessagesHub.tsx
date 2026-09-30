'use client';

import React, { useState } from 'react';
import { HelpCircle, MessageSquare } from 'lucide-react';
import ChatSystem from './ChatSystem';
import InquirySystem from './InquirySystem';

type Tab = 'chat' | 'inquiries';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'chat', label: 'Order Chat', icon: MessageSquare },
  { key: 'inquiries', label: 'Inquiries', icon: HelpCircle },
];

/** Order chat and customer inquiries on one page (staff + admin). Both systems are unchanged; this only hosts them. */
export default function MessagesHub({ userRole, initialTab = 'chat' }: { userRole: 'staff' | 'admin'; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] mb-2">Communication</p>
        <h1 className="text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Chat with customers about their orders and answer their inquiries in one place.
        </p>
      </div>

      {/* same tab bar as the customer Order View */}
      <div className="rounded-2xl border border-border bg-card p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                tab === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' ? <ChatSystem userRole={userRole} /> : <InquirySystem userRole={userRole} />}
    </div>
  );
}
