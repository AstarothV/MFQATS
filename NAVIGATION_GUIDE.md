# Navigation Functions Documentation

## Overview
This documentation covers the navigation utilities created for the MVCA WoodWorks application. These functions enable consistent navigation and route detection across all buttons and components.

## Files Created

### 1. `src/components/navigation.ts`
Core navigation hook and utilities for route detection and navigation management.

### 2. `src/components/ui/NavButton.tsx`
Reusable navigation button component with automatic active state styling.

---

## Usage Guide

### 1. Using the `useNavigation` Hook

The `useNavigation` hook provides all navigation functionality your components need.

#### Basic Setup
```tsx
'use client';

import { useNavigation } from '@/components/navigation';

export default function MyComponent() {
  const { navigate, isActive, currentPath } = useNavigation();

  return (
    <div>
      <p>Current path: {currentPath}</p>
      <button onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </button>
    </div>
  );
}
```

#### Available Methods

**`navigate(href, options?)`**
- Navigate to a path
- Supports internal and external links
- Options: `external` (boolean), `target` ('_blank' for new window)

```tsx
// Internal navigation
navigate('/staff-dashboard');

// External link in new tab
navigate('https://example.com', { external: true, target: '_blank' });

// External link in same window
navigate('https://example.com', { external: true });
```

**`isActive(href)`**
- Check if a specific route is currently active (exact match)
- Returns boolean

```tsx
const isStaffActive = isActive('/staff-dashboard');
if (isStaffActive) {
  // Highlight button, show active state, etc.
}
```

**`isPathActive(basePath)`**
- Check if currently in a route path (partial/prefix match)
- Useful for parent routes

```tsx
const inStaffArea = isPathActive('/staff-dashboard');
if (inStaffArea) {
  // Show all staff-related items as active
}
```

**`getCurrentPath()`**
- Get the current pathname
- Returns string

```tsx
const path = getCurrentPath();
console.log(path); // e.g., "/staff-dashboard/orders"
```

**`navigateBack()`**
- Navigate to previous page in browser history

```tsx
<button onClick={navigateBack}>← Back</button>
```

**`navigateForward()`**
- Navigate to next page in browser history

```tsx
<button onClick={navigateForward}>Forward →</button>
```

**`currentPath` (Property)**
- Direct access to current pathname
- Same as `getCurrentPath()` but as a property

```tsx
<span>You are at: {currentPath}</span>
```

---

### 2. Using the `NavButton` Component

Pre-built button component with automatic active state detection.

#### Basic Usage
```tsx
import NavButton from '@/components/ui/NavButton';
import { ShoppingBag } from 'lucide-react';

export default function Navigation() {
  return (
    <NavButton
      href="/customer-dashboard/shop"
      label="Shop Products"
      icon={ShoppingBag}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `href` | string | required | Route path to navigate to |
| `label` | string | required | Button label/text |
| `icon` | LucideIcon | undefined | Icon from lucide-react |
| `onClick` | function | undefined | Additional click handler |
| `variant` | 'default' \| 'primary' \| 'outline' \| 'ghost' | 'default' | Button style variant |
| `size` | 'sm' \| 'md' \| 'lg' | 'md' | Button size |
| `external` | boolean | false | Open external link |
| `className` | string | '' | Additional CSS classes |
| `showActiveIndicator` | boolean | false | Show dot indicator when active |

#### Variants

```tsx
// Default (outlined, dynamic colors)
<NavButton href="/dashboard" label="Dashboard" />

// Primary (filled, prominent)
<NavButton href="/dashboard" label="Dashboard" variant="primary" />

// Outline (bordered primary color)
<NavButton href="/dashboard" label="Dashboard" variant="outline" />

// Ghost (subtle, minimal styling)
<NavButton href="/dashboard" label="Dashboard" variant="ghost" />
```

#### Sizes

```tsx
// Small
<NavButton href="/dashboard" label="Dashboard" size="sm" />

// Medium (default)
<NavButton href="/dashboard" label="Dashboard" size="md" />

// Large
<NavButton href="/dashboard" label="Dashboard" size="lg" />
```

#### With Icons and Active Indicator

```tsx
import { LayoutDashboard } from 'lucide-react';

<NavButton
  href="/staff-dashboard"
  label="Workshop"
  icon={LayoutDashboard}
  variant="primary"
  showActiveIndicator={true}
/>
```

#### External Links

```tsx
<NavButton
  href="https://example.com"
  label="Visit External Site"
  external={true}
  icon={ExternalLink}
/>
```

---

### 3. Utility Functions

#### `getNavItemStatus(currentPath, itemHref)`
Get the status ('active' or 'inactive') of a navigation item.

```tsx
import { getNavItemStatus } from '@/components/navigation';

const status = getNavItemStatus('/staff-dashboard', '/staff-dashboard');
// Returns: 'active'
```

#### `isRouteActive(currentPath, targetPath, exact?)`
Check if a route matches a target path.

```tsx
import { isRouteActive } from '@/components/navigation';

// Exact match (default)
const match = isRouteActive('/staff-dashboard/orders', '/staff-dashboard/orders');
// Returns: true

// Prefix match
const inArea = isRouteActive('/staff-dashboard/orders', '/staff-dashboard', false);
// Returns: true
```

---

## Real-World Examples

### Example 1: Update Sidebar with Current Path Detection

Your Sidebar component now automatically detects the current path:

```tsx
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  
  const nav = navByRole[role];

  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onClose}
            className={`... ${isActive ? 'bg-primary text-primary-foreground' : '...'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

### Example 2: Quick Action Button with Hook

```tsx
'use client';

import { useNavigation } from '@/components/navigation';
import { LogOut } from 'lucide-react';

export default function QuickLogout() {
  const { navigate } = useNavigation();

  return (
    <button
      onClick={() => navigate('/')}
      className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted"
    >
      <LogOut size={18} />
      <span>Log Out</span>
    </button>
  );
}
```

### Example 3: Admin Dashboard Navigation

```tsx
'use client';

import NavButton from '@/components/ui/NavButton';
import { LayoutDashboard, BarChart3, Package, Users } from 'lucide-react';

export default function AdminNav() {
  return (
    <div className="flex gap-2">
      <NavButton
        href="/admin-dashboard"
        label="Overview"
        icon={LayoutDashboard}
        variant="primary"
        showActiveIndicator={true}
      />
      <NavButton
        href="/real-time-production-dashboard"
        label="Production"
        icon={BarChart3}
        showActiveIndicator={true}
      />
      <NavButton
        href="/orders"
        label="Orders"
        icon={Package}
        showActiveIndicator={true}
      />
      <NavButton
        href="/admin/team"
        label="Team"
        icon={Users}
        showActiveIndicator={true}
      />
    </div>
  );
}
```

### Example 4: Conditional Navigation Based on Role

```tsx
'use client';

import { useNavigation } from '@/components/navigation';

export default function RoleBasedNav({ role }: { role: string }) {
  const { navigate, isPathActive } = useNavigation();

  const handleRoleNavigation = () => {
    if (role === 'staff') {
      navigate('/staff-dashboard');
    } else if (role === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/customer-dashboard');
    }
  };

  const inCorrectArea = isPathActive(
    role === 'staff' ? '/staff-dashboard' : role === 'admin' ? '/admin-dashboard' : '/customer-dashboard'
  );

  return (
    <button
      onClick={handleRoleNavigation}
      className={`px-4 py-2 rounded-lg ${inCorrectArea ? 'bg-primary text-white' : 'bg-gray-200'}`}
    >
      {role.toUpperCase()} Dashboard
    </button>
  );
}
```

---

## Best Practices

1. **Always use `'use client'` in components using these hooks**
   - These utilities require client-side rendering

2. **Use `NavButton` for consistent styling**
   - Automatically handles active states
   - Provides built-in accessibility

3. **Combine multiple utilities for complex scenarios**
   ```tsx
   const { navigate, isActive, currentPath } = useNavigation();
   const status = getNavItemStatus(currentPath, '/dashboard');
   ```

4. **Use `isPathActive()` for parent route highlighting**
   - Useful when you want multiple sub-routes to show parent as active

5. **Always provide icons for better UX**
   - Icons make buttons more recognizable and visually appealing

---

## Migration Guide

If you have existing buttons, here's how to update them:

### Before
```tsx
<Link href="/dashboard" className="px-4 py-2 rounded">Dashboard</Link>
```

### After
```tsx
import NavButton from '@/components/ui/NavButton';
import { LayoutDashboard } from 'lucide-react';

<NavButton
  href="/dashboard"
  label="Dashboard"
  icon={LayoutDashboard}
  variant="primary"
/>
```

---

## Troubleshooting

### Active state not updating?
- Make sure component uses `'use client'` directive
- Verify the `href` matches exactly with route path
- Use `isPathActive()` for partial matching

### Navigation not working?
- Check that `href` is a valid route in your app
- For external links, set `external={true}`
- Verify Next.js routing is configured correctly

### Icon not showing?
- Import icon from 'lucide-react'
- Pass icon component directly: `icon={IconName}`
- Not as a string: ❌ `icon="IconName"`

---

## Files Modified

1. **`src/components/ui/Sidebar.tsx`**
   - Added `usePathname` import
   - Now uses dynamic `activePath` for current route detection
   - Improved active state styling

---

## Summary

You now have a complete navigation system that:
- ✅ Detects current page/button automatically
- ✅ Handles both internal and external navigation
- ✅ Provides reusable components and hooks
- ✅ Maintains consistent styling across the app
- ✅ Supports role-based navigation
- ✅ Includes history navigation (back/forward)

Use these utilities throughout your app for a cohesive, maintainable navigation experience!
