'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface NavigationItem {
  href: string;
  label: string;
}

/**
 * Custom hook for navigation and route detection
 * Provides methods to navigate, check active routes, and track current path
 */
export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Navigate to a specific path
   * @param href - The path to navigate to
   * @param options - Navigation options (external links, target)
   */
  const navigate = useCallback(
    (href: string, options?: { external?: boolean; target?: string }) => {
      if (options?.external) {
        if (options.target === '_blank') {
          window.open(href, '_blank');
        } else {
          window.location.href = href;
        }
      } else {
        router.push(href);
      }
    },
    [router]
  );

  /**
   * Check if a specific route is active (exact match)
   */
  const isActive = useCallback(
    (href: string) => {
      return pathname === href;
    },
    [pathname]
  );

  /**
   * Check if currently in a route path (partial match)
   */
  const isPathActive = useCallback(
    (basePath: string) => {
      return pathname.startsWith(basePath);
    },
    [pathname]
  );

  /**
   * Get the current pathname
   */
  const getCurrentPath = useCallback(() => {
    return pathname;
  }, [pathname]);

  /**
   * Navigate back in browser history
   */
  const navigateBack = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * Navigate forward in browser history
   */
  const navigateForward = useCallback(() => {
    router.forward();
  }, [router]);

  return {
    navigate,
    isActive,
    isPathActive,
    getCurrentPath,
    navigateBack,
    navigateForward,
    currentPath: pathname,
  };
}

/**
 * Get the status of a navigation item
 */
export function getNavItemStatus(currentPath: string, itemHref: string) {
  return currentPath === itemHref ? 'active' : 'inactive';
}

/**
 * Check if a route matches a target path
 * @param currentPath - The current pathname
 * @param targetPath - The target path to check
 * @param exact - If true, requires exact match; otherwise checks if current path starts with target
 */
export function isRouteActive(currentPath: string, targetPath: string, exact: boolean = true) {
  if (exact) {
    return currentPath === targetPath;
  }
  return currentPath.startsWith(targetPath);
}
