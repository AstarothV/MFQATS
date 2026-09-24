'use client';

import React from 'react';
import NavButton from '@/components/ui/NavButton';
import { useRoleNavigation } from '@/components/useRoleNavigation';
import { UserRole } from '@/components/roleNavigation';

interface RoleNavigationProps {
  role: UserRole;
  variant?: 'default' | 'primary' | 'outline' | 'ghost';
  layout?: 'horizontal' | 'vertical';
  showIcons?: boolean;
  showDescriptions?: boolean;
  className?: string;
}

/**
 * MainNavigation Component
 * Renders main navigation buttons for a role
 */
export function MainNavigation({
  role,
  variant = 'default',
  layout = 'vertical',
  showIcons = true,
  className = '',
}: RoleNavigationProps) {
  const { getMainNav, isActive } = useRoleNavigation(role);
  const mainNav = getMainNav();

  const containerClass =
    layout === 'horizontal' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1';

  return (
    <nav className={`${containerClass} ${className}`}>
      {mainNav.map((item) => (
        <NavButton
          key={item.id}
          href={item.href}
          label={item.label}
          icon={showIcons ? item.icon : undefined}
          variant={isActive(item.href) ? 'primary' : variant}
          title={item.description}
        />
      ))}
    </nav>
  );
}

/**
 * QuickActions Component
 * Renders quick action buttons for a role
 */
export function QuickActions({
  role,
  variant = 'outline',
  layout = 'horizontal',
  showIcons = true,
  className = '',
}: RoleNavigationProps) {
  const { getQuickActions } = useRoleNavigation(role);
  const quickActions = getQuickActions();

  const containerClass =
    layout === 'horizontal' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1';

  return (
    <div className={`${containerClass} ${className}`}>
      {quickActions.map((item) => (
        <NavButton
          key={item.id}
          href={item.href}
          label={item.label}
          icon={showIcons ? item.icon : undefined}
          variant={variant}
          size="sm"
          title={item.description}
        />
      ))}
    </div>
  );
}

/**
 * SecondaryNavigation Component
 * Renders secondary navigation (notifications, settings)
 */
export function SecondaryNavigation({
  role,
  className = '',
}: RoleNavigationProps) {
  const { getSecondaryNav } = useRoleNavigation(role);
  const secondaryNav = getSecondaryNav();

  return (
    <nav className={`flex gap-2 ${className}`}>
      {secondaryNav.map((item) => (
        <NavButton
          key={item.id}
          href={item.href}
          label={item.label}
          icon={item.icon}
          variant="ghost"
          size="sm"
        />
      ))}
    </nav>
  );
}

/**
 * CompleteRoleNavigation Component
 * Renders all navigation sections for a role
 */
export function CompleteRoleNavigation({
  role,
  showDescriptions = false,
  className = '',
}: RoleNavigationProps) {
  const { getMainNav, getQuickActions, getSecondaryNav } = useRoleNavigation(role);
  const mainNav = getMainNav();
  const quickActions = getQuickActions();
  const secondaryNav = getSecondaryNav();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Navigation */}
      {mainNav.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
            Main Navigation
          </p>
          <MainNavigation role={role} variant="primary" layout="vertical" />
        </div>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
            Quick Actions
          </p>
          <QuickActions role={role} layout="horizontal" />
        </div>
      )}

      {/* Secondary Navigation */}
      {secondaryNav.length > 0 && (
        <div className="pt-3 border-t border-border">
          <SecondaryNavigation role={role} />
        </div>
      )}
    </div>
  );
}

/**
 * AllRolesNavigationComparison Component
 * Shows navigation for all roles side-by-side (admin view)
 */
export function AllRolesNavigationComparison() {
  const roles: UserRole[] = ['staff', 'admin', 'customer'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {roles.map((role) => (
        <div
          key={role}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h3 className="font-semibold text-foreground mb-4 capitalize">
            {role} Navigation
          </h3>
          <CompleteRoleNavigation role={role} />
        </div>
      ))}
    </div>
  );
}
