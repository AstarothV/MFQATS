'use client';
import React from 'react';
import Link from 'next/link';
import { ScanLine, ClipboardList, Package, MessageSquare, ChevronRight } from 'lucide-react';

// Shortcuts to the real pages; Quality Scan opens on the order picked at the top.
export default function QuickActionTiles({ orderId }: { orderId: string | null }) {
  const actions = [
    { href: orderId ? `/staff/quality-scan?order=${orderId}` : '/staff/quality-scan', icon: ScanLine, label: 'Quality Scan', desc: orderId ? 'For the order above' : 'Inspect a piece', color: 'text-accent' },
    { href: '/staff-dashboard/assigned-tasks', icon: ClipboardList, label: 'Assigned Tasks', desc: 'Orders given to you', color: 'text-success' },
    { href: '/staff-dashboard/inventory', icon: Package, label: 'Inventory', desc: 'Materials in stock', color: 'text-info' },
    { href: '/staff/chat', icon: MessageSquare, label: 'Messages', desc: 'Ask the admin for help', color: 'text-warning' },
  ];
  return (
    <div className="card-dark p-5 h-full">
      <h3 className="mb-4 text-base font-semibold text-foreground">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={label} href={href} className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3 transition duration-150 hover:bg-muted/40 active:scale-95">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon size={16} className={color} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
