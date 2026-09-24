'use client';

import React from 'react';
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
  X,
  Camera,
  Ruler,
  FileText,
  History,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
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

const roleLabel = {
  staff: 'Production Staff',
  admin: 'Administrator',
  customer: 'Customer',
} as const;

const navByRole = {
  staff: [
    { label: 'Workshop', href: '/staff-dashboard', icon: LayoutDashboard },
    { label: 'Assigned Tasks', href: '/staff-dashboard/assigned-tasks', icon: ClipboardCheck },
    { label: 'Order Workflow', href: '/staff-dashboard/orders', icon: Package },
    { label: 'Quality Scan (AI)', href: '/staff/quality-scan', icon: Camera },
    { label: 'AR Visualization', href: '/staff/ar-visualization', icon: Eye },
    { label: 'Inventory', href: '/staff-dashboard/inventory', icon: ShoppingBag },
    { label: 'Inquiries', href: '/staff/inquiry', icon: HelpCircle },
    { label: 'Customer Chat', href: '/staff/chat', icon: MessageSquare },
  ],
  admin: [
    { label: 'Admin Overview', href: '/admin-dashboard', icon: LayoutDashboard },
    { label: 'Production', href: '/real-time-production-dashboard', icon: BarChart3 },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Product Catalog', href: '/catalog', icon: Box },
    { label: 'Order Management', href: '/orders', icon: Package },
    { label: 'Inquiries', href: '/admin/inquiry', icon: HelpCircle },
    { label: 'Order Chat', href: '/admin/chat', icon: MessageSquare },
    { label: 'Inventory', href: '/admin/inventory', icon: Truck },
    { label: 'Team', href: '/admin/team', icon: Users },
    { label: 'Reports', href: '/admin/reports', icon: FileText },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: History },
    { label: 'Defect Analytics', href: '/admin/defect-analytics', icon: AlertTriangle },
    { label: 'Rework Queue', href: '/admin/rework', icon: RotateCcw },
  ],
  customer: [
    { label: 'Overview', href: '/customer-dashboard/overview', icon: Home },
    { label: 'OrderView', href: '/customer-dashboard/order-view', icon: Package },
    { label: 'Inquiry', href: '/customer-dashboard/inquiry', icon: HelpCircle },
    { label: 'Shop Products', href: '/customer-dashboard/shop', icon: ShoppingBag },
  ],
};

export default function Sidebar({ role, currentPath, open, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile, user } = useAuth();
  const nav = navByRole[role];
  const activePath = currentPath || pathname;

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'User';

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
      <aside
        className={`fixed top-16 bottom-0 left-0 z-50 ${collapsed ? 'w-20 p-4' : 'w-72 p-6'} overflow-y-auto border-r border-border bg-card shadow-2xl transition-all duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative mb-6 h-16">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`absolute right-0 top-1/2 -translate-y-1/2 lg:inline-flex items-center justify-center rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-foreground shadow-sm ${collapsed ? 'w-8 h-8' : 'w-9 h-9'}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-2"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-6">
          {!collapsed ? (
            <div className="rounded-3xl border border-border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-[0.24em] mb-2">Signed in as</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{roleLabel[role]}</p>
                </div>
                <span className="badge status-info shrink-0">{role === 'staff' ? 'Staff' : role === 'admin' ? 'Admin' : 'Customer'}</span>
              </div>
            </div>
          ) : (
            <div className="h-16" />
          )}
        </div>

        <nav className="space-y-1">
          {nav.map((item) => {
            const NavIcon = item.icon;
            const isActive = activePath === item.href || activePath.startsWith(item.href + '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`flex items-center ${collapsed ? 'justify-center px-0 py-2.5 my-1' : 'gap-3 px-4 py-2.5 my-1'} rounded-2xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-muted text-foreground ring-1 ring-border shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <NavIcon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className={`flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-danger hover:bg-danger/10 transition-all ${collapsed ? 'w-full justify-center' : 'w-full justify-between'}`}
          >
            {!collapsed && <span>Sign Out</span>}
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden"
          aria-label="Close overlay"
        />
      )}
    </>
  );
}
