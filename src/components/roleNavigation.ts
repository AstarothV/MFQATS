'use client';

import { LucideIcon } from 'lucide-react';
import { LayoutDashboard, BarChart3, Package, Box, ShoppingBag, Users, ClipboardCheck, Truck, MessageSquare, Bell, Settings, Eye, AlertCircle, Clock,  } from 'lucide-react';

/**
 * Role-based navigation configuration
 * Maps all available buttons/actions per user role
 */

export type UserRole = 'staff' | 'admin' | 'customer';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  category?: string;
  badge?: string;
  badgeVariant?: 'primary' | 'danger' | 'success' | 'warning';
}

export type RoleNavigationConfig = {
  [key in UserRole]: {
    mainNav: NavItem[];
    quickActions: NavItem[];
    secondaryNav?: NavItem[];
    settings?: NavItem[];
  };
}

/**
 * Complete navigation configuration for all roles
 */
export const roleNavigationConfig: RoleNavigationConfig = {
  staff: {
    // Main navigation items for staff
    mainNav: [
      {
        id: 'staff-workshop',
        label: 'Workshop',
        href: '/staff-dashboard',
        icon: LayoutDashboard,
        category: 'Main',
        description: 'Production workshop overview',
      },
      {
        id: 'staff-tasks',
        label: 'Assigned Tasks',
        href: '/staff-dashboard/assigned-tasks',
        icon: ClipboardCheck,
        category: 'Work',
        description: 'View your assigned tasks',
      },
      {
        id: 'staff-orders',
        label: 'Order Workflow',
        href: '/staff-dashboard/orders',
        icon: Package,
        category: 'Work',
        description: 'Manage order workflow',
      },
      {
        id: 'staff-inventory',
        label: 'Inventory',
        href: '/staff-dashboard/inventory',
        icon: ShoppingBag,
        category: 'Work',
        description: 'Check inventory levels',
      },
    ],
    // Quick action buttons
    quickActions: [
      {
        id: 'staff-timer',
        label: 'Start Task Timer',
        href: '/staff-dashboard?action=start-timer',
        icon: Clock,
        description: 'Quick start a task timer',
      },
      {
        id: 'staff-report-issue',
        label: 'Report Issue',
        href: '/staff-dashboard?action=report',
        icon: AlertCircle,
        description: 'Report a problem or defect',
      },
      {
        id: 'staff-view-qa',
        label: 'QA Check',
        href: '/staff-dashboard?action=qa',
        icon: Eye,
        description: 'View recent QA results',
      },
    ],
    // Secondary navigation
    secondaryNav: [
      {
        id: 'staff-notifications',
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
      },
      {
        id: 'staff-settings',
        label: 'Settings',
        href: '/settings?role=staff',
        icon: Settings,
      },
    ],
  },

  admin: {
    // Main navigation for admin
    mainNav: [
      {
        id: 'admin-overview',
        label: 'Admin Overview',
        href: '/admin-dashboard',
        icon: LayoutDashboard,
        category: 'Dashboard',
        description: 'Administrative dashboard',
      },
      {
        id: 'admin-production',
        label: 'Production',
        href: '/real-time-production-dashboard',
        icon: BarChart3,
        category: 'Analytics',
        description: 'Real-time production metrics',
        badge: 'Live',
        badgeVariant: 'success',
      },
      {
        id: 'admin-catalog',
        label: 'Product Catalog',
        href: '/catalog',
        icon: Box,
        category: 'Products',
        description: 'Manage product catalog',
      },
      {
        id: 'admin-orders',
        label: 'Order Management',
        href: '/orders',
        icon: Package,
        category: 'Orders',
        description: 'View and manage orders',
      },
      {
        id: 'admin-inventory',
        label: 'Inventory Management',
        href: '/admin/inventory',
        icon: Truck,
        category: 'Inventory',
        description: 'Manage inventory',
      },
      {
        id: 'admin-team',
        label: 'Team Management',
        href: '/admin/team',
        icon: Users,
        category: 'Staff',
        description: 'Manage team members',
      },
    ],
    // Quick actions for admin
    quickActions: [
      {
        id: 'admin-new-order',
        label: 'Create Order',
        href: '/orders?action=new',
        icon: Package,
        description: 'Create a new order',
      },
      {
        id: 'admin-add-product',
        label: 'Add Product',
        href: '/catalog?action=add',
        icon: Box,
        description: 'Add new product to catalog',
      },
      {
        id: 'admin-add-staff',
        label: 'Add Team Member',
        href: '/admin/team?action=add',
        icon: Users,
        description: 'Add new staff member',
      },
      {
        id: 'admin-view-analytics',
        label: 'Analytics',
        href: '/admin-dashboard?section=analytics',
        icon: BarChart3,
        description: 'View detailed analytics',
      },
    ],
    // Secondary nav
    secondaryNav: [
      {
        id: 'admin-notifications',
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
      },
      {
        id: 'admin-settings',
        label: 'Settings',
        href: '/settings?role=admin',
        icon: Settings,
      },
    ],
  },

  customer: {
    // Main navigation for customer
    mainNav: [
      {
        id: 'customer-dashboard',
        label: 'Order History',
        href: '/customer-dashboard',
        icon: Package,
        category: 'Orders',
        description: 'View your orders',
      },
      {
        id: 'customer-order-status',
        label: 'Order Queue',
        href: '/customer-dashboard/order-status',
        icon: Eye,
        category: 'Orders',
        description: 'Track order status',
      },
      {
        id: 'customer-shop',
        label: 'Shop Products',
        href: '/customer-dashboard/shop',
        icon: ShoppingBag,
        category: 'Shopping',
        description: 'Browse and shop products',
      },
      {
        id: 'customer-support',
        label: 'Inquiry',
        href: '/support',
        icon: MessageSquare,
        category: 'Help',
        description: 'Get support',
      },
    ],
    // Quick actions
    quickActions: [
      {
        id: 'customer-new-order',
        label: 'Place Order',
        href: '/customer-dashboard/shop?action=order',
        icon: Package,
        description: 'Start a new order',
      },
      {
        id: 'customer-track',
        label: 'Track Order',
        href: '/customer-dashboard/order-status?action=track',
        icon: Eye,
        description: 'Track recent orders',
      },
      {
        id: 'customer-contact-support',
        label: 'Contact Support',
        href: '/support?action=contact',
        icon: MessageSquare,
        description: 'Contact support team',
      },
    ],
    // Secondary nav
    secondaryNav: [
      {
        id: 'customer-notifications',
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
      },
      {
        id: 'customer-settings',
        label: 'Settings',
        href: '/settings?role=customer',
        icon: Settings,
      },
    ],
  },
};

/**
 * Get navigation items for a specific role
 */
export function getRoleNavigation(role: UserRole) {
  return roleNavigationConfig[role] || null;
}

/**
 * Get all main navigation items for a role
 */
export function getRoleMainNav(role: UserRole): NavItem[] {
  return roleNavigationConfig[role]?.mainNav || [];
}

/**
 * Get all quick action items for a role
 */
export function getRoleQuickActions(role: UserRole): NavItem[] {
  return roleNavigationConfig[role]?.quickActions || [];
}

/**
 * Get secondary navigation for a role
 */
export function getRoleSecondaryNav(role: UserRole): NavItem[] {
  return roleNavigationConfig[role]?.secondaryNav || [];
}

/**
 * Get a specific navigation item by ID and role
 */
export function getRoleNavItem(role: UserRole, itemId: string): NavItem | null {
  const config = roleNavigationConfig[role];
  if (!config) return null;

  const allItems = [
    ...config.mainNav,
    ...config.quickActions,
    ...(config.secondaryNav || []),
    ...(config.settings || []),
  ];

  return allItems.find((item) => item.id === itemId) || null;
}

/**
 * Get all available paths for a role
 */
export function getRolePaths(role: UserRole): string[] {
  const config = roleNavigationConfig[role];
  if (!config) return [];

  const allItems = [
    ...config.mainNav,
    ...config.quickActions,
    ...(config.secondaryNav || []),
    ...(config.settings || []),
  ];

  return allItems.map((item) => item.href);
}

/**
 * Check if a path is available for a role
 */
export function isPathAvailableForRole(role: UserRole, path: string): boolean {
  const paths = getRolePaths(role);
  return paths.some((p) => path.startsWith(p.split('?')[0]));
}

/**
 * Get all available roles
 */
export const AVAILABLE_ROLES: UserRole[] = ['staff', 'admin', 'customer'];

/**
 * Get role labels
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  staff: 'Production Staff',
  admin: 'Administrator',
  customer: 'Customer',
};

/**
 * Get role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  staff: 'Production workshop access and task management',
  admin: 'Full administrative control and analytics',
  customer: 'Shopping and order management',
};
