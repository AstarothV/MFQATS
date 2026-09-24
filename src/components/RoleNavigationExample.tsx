'use client';

import React, { useState } from 'react';
import { UserRole, AVAILABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/components/roleNavigation';
import { MainNavigation, QuickActions, CompleteRoleNavigation, AllRolesNavigationComparison,  } from '@/components/ui/RoleNavigation';
import { useRoleNavigation } from '@/components/useRoleNavigation';

/**
 * Role-Based Navigation Example
 * Demonstrates all role navigation features
 */
export default function RoleNavigationExample() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const { getMainNav, getQuickActions, getAllRolePaths } = useRoleNavigation(selectedRole);

  const mainNav = getMainNav();
  const quickActions = getQuickActions();
  const allPaths = getAllRolePaths();

  return (
    <div className="space-y-8 p-6">
      {/* Role Selector */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground mb-4">Select Role</p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_ROLES?.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedRole === role
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {ROLE_LABELS?.[role]}
            </button>
          ))}
        </div>
      </div>
      {/* Role Info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {ROLE_LABELS?.[selectedRole]}
        </h3>
        <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS?.[selectedRole]}</p>
      </div>
      {/* Main Navigation Section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
          Main Navigation ({mainNav?.length} items)
        </p>
        <MainNavigation role={selectedRole} variant="primary" layout="vertical" />
      </div>
      {/* Quick Actions Section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
          Quick Actions ({quickActions?.length} items)
        </p>
        <QuickActions role={selectedRole} layout="horizontal" />
      </div>
      {/* All Paths */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
          Available Paths ({allPaths?.length})
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {allPaths?.map((path) => (
            <code key={path} className="text-xs bg-muted p-2 rounded text-foreground">
              {path}
            </code>
          ))}
        </div>
      </div>
      {/* Complete Navigation */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
          Complete Navigation View
        </p>
        <CompleteRoleNavigation role={selectedRole} />
      </div>
      {/* All Roles Comparison */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
          All Roles Comparison
        </p>
        <AllRolesNavigationComparison />
      </div>
      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {AVAILABLE_ROLES?.map((role) => (
          <div key={role} className="rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-3 capitalize">{ROLE_LABELS?.[role]}</h4>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Main Items: </span>
                <span className="font-semibold">{getMainNav()?.length}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Quick Actions: </span>
                <span className="font-semibold">{getQuickActions()?.length}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Total Paths: </span>
                <span className="font-semibold">{getAllRolePaths()?.length}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
