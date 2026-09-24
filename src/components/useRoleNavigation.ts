'use client';

import { useCallback } from 'react';
import { UserRole, getRoleNavigation, getRoleMainNav, getRoleQuickActions, getRoleSecondaryNav, getRoleNavItem, getRolePaths, isPathAvailableForRole,  } from '@/components/roleNavigation';
import { useNavigation } from '@/components/navigation';

/**
 * Hook for role-based navigation
 * Provides navigation functions specific to user role
 */
export function useRoleNavigation(role: UserRole) {
  const { navigate, isActive, currentPath } = useNavigation();

  // Get all navigation items for this role
  const getMainNav = useCallback(() => {
    return getRoleMainNav(role);
  }, [role]);

  const getQuickActions = useCallback(() => {
    return getRoleQuickActions(role);
  }, [role]);

  const getSecondaryNav = useCallback(() => {
    return getRoleSecondaryNav(role);
  }, [role]);

  // Get all items grouped
  const getAllItems = useCallback(() => {
    const config = getRoleNavigation(role);
    if (!config) return [];

    return [
      ...config.mainNav,
      ...config.quickActions,
      ...(config.secondaryNav || []),
    ];
  }, [role]);

  // Navigate to a role-specific path
  const navigateToRolePath = useCallback(
    (itemId: string) => {
      const item = getRoleNavItem(role, itemId);
      if (item) {
        navigate(item.href);
      }
    },
    [role, navigate]
  );

  // Check if a path is accessible for this role
  const canAccessPath = useCallback(
    (path: string) => {
      return isPathAvailableForRole(role, path);
    },
    [role]
  );

  // Get active nav item
  const getActiveNavItem = useCallback(() => {
    const items = getAllItems();
    return items.find((item) => isActive(item.href)) || null;
  }, [getAllItems, isActive]);

  // Get all role paths
  const getAllRolePaths = useCallback(() => {
    return getRolePaths(role);
  }, [role]);

  return {
    // Navigation methods
    navigate,
    navigateToRolePath,
    canAccessPath,

    // Get navigation items
    getMainNav,
    getQuickActions,
    getSecondaryNav,
    getAllItems,
    getAllRolePaths,

    // Active state
    isActive,
    getActiveNavItem,
    currentPath,

    // Current role
    role,
  };
}

/**
 * Hook to get navigation for a specific role (without using current role)
 * Use when you need to fetch nav for a different role
 */
export function useRoleNavigationData(role: UserRole) {
  return {
    mainNav: getRoleMainNav(role),
    quickActions: getRoleQuickActions(role),
    secondaryNav: getRoleSecondaryNav(role),
    allPaths: getRolePaths(role),
    canAccess: (path: string) => isPathAvailableForRole(role, path),
  };
}
