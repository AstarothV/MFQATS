'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Box,
  ShoppingBag,
  Users,
  ClipboardCheck,
  Truck,
  MessageSquare,
  LogOut,
  Camera,
  FileText,
  History,
  AlertTriangle,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Home,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  role: 'staff' | 'admin' | 'customer';
  currentPath?: string;
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavGroup = { title?: string; items: NavItem[] };

// Grouped so a long list scans quickly; the titles show only while the sidebar is open.
const navByRole: Record<SidebarProps['role'], NavGroup[]> = {
  staff: [
    {
      title: 'Workshop',
      items: [
        { label: 'Workshop', href: '/staff-dashboard', icon: LayoutDashboard },
        { label: 'Assigned Tasks', href: '/staff-dashboard/assigned-tasks', icon: ClipboardCheck },
        { label: 'Order Workflow', href: '/staff-dashboard/orders', icon: Package },
        { label: 'Quality Scan', href: '/staff/quality-scan', icon: Camera },
      ],
    },
    {
      title: 'Resources',
      items: [
        { label: 'Inventory', href: '/staff-dashboard/inventory', icon: ShoppingBag },
        { label: 'Messages', href: '/staff/chat', icon: MessageSquare },
      ],
    },
  ],
  admin: [
    {
      title: 'Overview',
      items: [
        { label: 'Admin Overview', href: '/admin-dashboard', icon: LayoutDashboard },
        { label: 'Inspection Progress', href: '/real-time-production-dashboard', icon: BarChart3 },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Order Management', href: '/orders', icon: Package },
        { label: 'Product Catalog', href: '/catalog', icon: Box },
        { label: 'Inventory', href: '/admin/inventory', icon: Truck },
        { label: 'Team', href: '/admin/team', icon: Users },
      ],
    },
    {
      title: 'Quality',
      items: [
        { label: 'Defect Analytics', href: '/admin/defect-analytics', icon: AlertTriangle },
        { label: 'Rework Queue', href: '/admin/rework', icon: RotateCcw },
        { label: 'Reports', href: '/admin/reports', icon: FileText },
      ],
    },
    {
      title: 'Admin',
      items: [
        { label: 'User Management', href: '/admin/users', icon: Users },
        { label: 'Audit Logs', href: '/admin/audit-logs', icon: History },
        { label: 'Messages', href: '/admin/chat', icon: MessageSquare },
      ],
    },
  ],
  customer: [
    {
      items: [
        { label: 'Overview', href: '/customer-dashboard/overview', icon: Home },
        { label: 'OrderView', href: '/customer-dashboard/order-view', icon: Package },
        { label: 'Inquiry', href: '/customer-dashboard/inquiry', icon: HelpCircle },
        { label: 'Shop Products', href: '/customer-dashboard/shop', icon: ShoppingBag },
      ],
    },
  ],
};

export default function Sidebar({ role, currentPath, open, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const groups = navByRole[role];
  const nav = groups.flatMap((g) => g.items);
  // Highlight the clicked item immediately, before the route commits.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => setPendingHref(null), [pathname]);
  const activePath = pendingHref || currentPath || pathname;
  // Longest matching href wins, so a parent ('/staff-dashboard') isn't lit alongside its child.
  const activeHref = nav
    .filter((i) => activePath === i.href || activePath.startsWith(i.href + '/'))
    .reduce<string | null>((best, i) => (!best || i.href.length > best.length ? i.href : best), null);
  // "Collapsed" is a desktop setting (lg: classes); the phone sheet always shows the labels.
  const slim = collapsed;

  async function handleLogout() {
    try {
      await signOut();
      router.replace('/sign-up-login-screen');
    } catch {
      router.replace('/sign-up-login-screen');
    }
  }

  return (
    <>
      {/* Floating glass panel, inset from the screen edge. Only its own width animates; the page beside it snaps to
          the new width, so collapsing never relayouts the content (charts included) on every frame. */}
      <aside
        aria-label="Main navigation"
        className={`glass-float fixed z-40 top-[76px] bottom-3 left-3 flex flex-col rounded-[22px] p-2.5 w-[min(280px,calc(100vw-24px))] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          slim ? 'lg:w-[68px]' : 'lg:w-[244px]'
        } ${open ? 'translate-x-0' : '-translate-x-[calc(100%+24px)]'} lg:translate-x-0`}
      >
        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-0.5 py-1">
          {groups.map((group, gi) => (
            <div key={group.title || gi}>
              {group.title && (
                <p
                  className={`whitespace-nowrap px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground ${
                    slim ? 'lg:hidden' : ''
                  }`}
                >
                  {group.title}
                </p>
              )}
              {slim && gi > 0 && <div className="mx-3 mb-2 hidden border-t border-[var(--glass-line)] lg:block" aria-hidden="true" />}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const NavIcon = item.icon;
                  const isActive = item.href === activeHref;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) setPendingHref(item.href);
                        onClose();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      title={slim ? item.label : undefined}
                      className={`flex h-10 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        slim ? 'lg:justify-center lg:px-0' : ''
                      } ${
                        isActive
                          ? 'bg-primary/15 font-semibold text-primary shadow-[inset_0_1px_0_var(--glass-edge)] dark:text-accent'
                          : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <NavIcon size={18} className="shrink-0" aria-hidden="true" />
                      <span className={`truncate ${slim ? 'lg:sr-only' : ''}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`mt-2 flex gap-1.5 border-t border-[var(--glass-line)] pt-2.5 ${slim ? 'lg:flex-col' : ''}`}>
          <button
            type="button"
            onClick={handleLogout}
            title={slim ? 'Sign Out' : undefined}
            className={`flex h-10 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/10 ${
              slim ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <LogOut size={18} className="shrink-0" aria-hidden="true" />
            <span className={slim ? 'lg:sr-only' : ''}>Sign Out</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden h-10 w-10 shrink-0 items-center justify-center self-center rounded-xl text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground lg:inline-flex"
              aria-label={slim ? 'Expand sidebar' : 'Collapse sidebar'}
              title={slim ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {slim ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
        </div>
      </aside>

      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-30 animate-fade-in bg-black/35 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
        />
      )}
    </>
  );
}
