# Role-Based Navigation System

## Overview

Your app now has a **complete role-based navigation system** that handles all buttons, paths, and functions for each user type:
- **Staff** (Production workers)
- **Admin** (Administrators)
- **Customer** (Customers)

---

## 📂 Files Created

### 1. **Role Navigation Configuration** (`src/components/roleNavigation.ts`)
- All button definitions per role
- All paths mapped per role
- Utility functions for role access
- Type definitions

### 2. **Role Navigation Hook** (`src/components/useRoleNavigation.ts`)
- `useRoleNavigation(role)` - Main hook
- `useRoleNavigationData(role)` - Static data hook
- 10+ navigation methods

### 3. **Role Navigation Components** (`src/components/ui/RoleNavigation.tsx`)
- `MainNavigation` - Main nav buttons
- `QuickActions` - Quick action buttons
- `SecondaryNavigation` - Secondary items
- `CompleteRoleNavigation` - All sections
- `AllRolesNavigationComparison` - All roles view

---

## 🎯 Quick Start

### Use Role Navigation Components

```tsx
'use client';
import { MainNavigation } from '@/components/ui/RoleNavigation';

export default function Dashboard() {
  const role = 'staff'; // or 'admin' or 'customer'

  return (
    <MainNavigation 
      role={role}
      variant="primary"
      layout="vertical"
      showIcons={true}
    />
  );
}
```

### Use Role Navigation Hook

```tsx
'use client';
import { useRoleNavigation } from '@/components/useRoleNavigation';

export default function CustomNav() {
  const { 
    getMainNav, 
    getQuickActions, 
    navigateToRolePath 
  } = useRoleNavigation('staff');

  const mainNav = getMainNav();
  const actions = getQuickActions();

  return (
    <div>
      {mainNav.map(item => (
        <button key={item.id} onClick={() => navigateToRolePath(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

---

## 📋 All Buttons Per Role

### STAFF (Production Worker)

**Main Navigation:**
1. **Workshop** → `/staff-dashboard`
2. **Assigned Tasks** → `/staff-dashboard/assigned-tasks`
3. **Order Workflow** → `/staff-dashboard/orders`
4. **Inventory** → `/staff-dashboard/inventory`

**Quick Actions:**
1. **Start Task Timer** → `/staff-dashboard?action=start-timer`
2. **Report Issue** → `/staff-dashboard?action=report`
3. **QA Check** → `/staff-dashboard?action=qa`

**Secondary:**
1. **Notifications** → `/notifications`
2. **Settings** → `/settings?role=staff`

---

### ADMIN (Administrator)

**Main Navigation:**
1. **Admin Overview** → `/admin-dashboard`
2. **Production** → `/real-time-production-dashboard` (with "Live" badge)
3. **Product Catalog** → `/catalog`
4. **Order Management** → `/orders`
5. **Inventory Management** → `/admin/inventory`
6. **Team Management** → `/admin/team`

**Quick Actions:**
1. **Create Order** → `/orders?action=new`
2. **Add Product** → `/catalog?action=add`
3. **Add Team Member** → `/admin/team?action=add`
4. **Analytics** → `/admin-dashboard?section=analytics`

**Secondary:**
1. **Notifications** → `/notifications`
2. **Settings** → `/settings?role=admin`

---

### CUSTOMER (Shopper)

**Main Navigation:**
1. **My Orders** → `/customer-dashboard`
2. **Order Status** → `/customer-dashboard/order-status`
3. **Shop Products** → `/customer-dashboard/shop`
4. **Support** → `/support`

**Quick Actions:**
1. **Place Order** → `/customer-dashboard/shop?action=order`
2. **Track Order** → `/customer-dashboard/order-status?action=track`
3. **Contact Support** → `/support?action=contact`

**Secondary:**
1. **Notifications** → `/notifications`
2. **Settings** → `/settings?role=customer`

---

## 🔧 Available Functions

### Get Navigation Items

```tsx
import { 
  getRoleMainNav,
  getRoleQuickActions,
  getRoleSecondaryNav,
  getRoleNavItem,
  getRolePaths,
  getRoleNavigation
} from '@/components/roleNavigation';

// Get all main nav items for staff
const staffMain = getRoleMainNav('staff');

// Get all quick actions for admin
const adminQuicks = getRoleQuickActions('admin');

// Get specific item
const item = getRoleNavItem('customer', 'customer-shop');

// Get all paths for a role
const customerPaths = getRolePaths('customer');

// Check if path available
const canAccess = isPathAvailableForRole('staff', '/orders');

// Get complete config
const staffConfig = getRoleNavigation('staff');
```

### Use Role Navigation Hook

```tsx
const {
  // Navigation methods
  navigate,
  navigateToRolePath,
  canAccessPath,

  // Get items
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
  role
} = useRoleNavigation('staff');
```

---

## 📊 Navigation Data Structure

### NavItem Interface
```tsx
interface NavItem {
  id: string;                           // Unique identifier
  label: string;                        // Button label
  href: string;                         // Route path
  icon: LucideIcon;                     // Icon component
  description?: string;                 // Hover text
  category?: string;                    // Item category
  badge?: string;                       // Badge text (e.g., "Live")
  badgeVariant?: 'primary' | 'danger' | 'success' | 'warning'; // Badge style
}
```

### RoleNavigationConfig Interface
```tsx
interface RoleNavigationConfig {
  [role: string]: {
    mainNav: NavItem[];        // Main navigation items
    quickActions: NavItem[];   // Quick action items
    secondaryNav?: NavItem[];  // Secondary items
    settings?: NavItem[];      // Settings items
  };
}
```

---

## 🎨 Components Reference

### MainNavigation
Renders main navigation buttons for a role.

**Props:**
```tsx
<MainNavigation
  role="staff"                  // REQUIRED: User role
  variant="primary"             // default | primary | outline | ghost
  layout="vertical"             // horizontal | vertical
  showIcons={true}              // Show icons
  className=""                  // Custom CSS
/>
```

### QuickActions
Renders quick action buttons.

**Props:**
```tsx
<QuickActions
  role="admin"                  // REQUIRED: User role
  variant="outline"             // Button style
  layout="horizontal"           // Layout
  showIcons={true}              // Show icons
  className=""                  // Custom CSS
/>
```

### SecondaryNavigation
Renders secondary nav (notifications, settings).

**Props:**
```tsx
<SecondaryNavigation
  role="customer"               // REQUIRED: User role
  className=""                  // Custom CSS
/>
```

### CompleteRoleNavigation
Renders all navigation sections for a role.

**Props:**
```tsx
<CompleteRoleNavigation
  role="staff"                  // REQUIRED: User role
  showDescriptions={false}      // Show item descriptions
  className=""                  // Custom CSS
/>
```

### AllRolesNavigationComparison
Shows all roles' navigation side-by-side (admin view).

**Usage:**
```tsx
<AllRolesNavigationComparison />
```

---

## 💡 Real-World Examples

### Example 1: Staff Dashboard with Role Navigation
```tsx
'use client';
import { CompleteRoleNavigation } from '@/components/ui/RoleNavigation';

export default function StaffDashboard() {
  return (
    <div className="flex gap-8">
      <aside className="w-72">
        <CompleteRoleNavigation role="staff" />
      </aside>
      <main className="flex-1">
        {/* Dashboard content */}
      </main>
    </div>
  );
}
```

### Example 2: Dynamic Role Switcher (Admin)
```tsx
'use client';
import { useState } from 'react';
import { AllRolesNavigationComparison } from '@/components/ui/RoleNavigation';

export default function RoleSwitcher() {
  const [selectedRole, setSelectedRole] = useState<'staff' | 'admin' | 'customer'>('staff');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['staff', 'admin', 'customer'].map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role as any)}
            className={selectedRole === role ? 'bg-primary text-white' : 'bg-gray-200'}
          >
            {role}
          </button>
        ))}
      </div>
      <AllRolesNavigationComparison />
    </div>
  );
}
```

### Example 3: Custom Navigation with Filtering
```tsx
'use client';
import { useRoleNavigation } from '@/components/useRoleNavigation';
import NavButton from '@/components/ui/NavButton';

export default function FilteredNav() {
  const { getMainNav, getQuickActions } = useRoleNavigation('admin');

  // Filter to only show specific categories
  const mainNav = getMainNav().filter(item => 
    ['Dashboard', 'Orders'].includes(item.category || '')
  );

  return (
    <nav className="space-y-2">
      {mainNav.map(item => (
        <NavButton
          key={item.id}
          href={item.href}
          label={item.label}
          icon={item.icon}
          variant="primary"
        />
      ))}
    </nav>
  );
}
```

### Example 4: Check Path Access Before Navigation
```tsx
'use client';
import { useRoleNavigation } from '@/components/useRoleNavigation';

export default function SafeNavigation() {
  const { canAccessPath, navigate } = useRoleNavigation('customer');

  const handleNavigate = (path: string) => {
    if (canAccessPath(path)) {
      navigate(path);
    } else {
      alert('You do not have access to this page');
    }
  };

  return (
    <button onClick={() => handleNavigate('/admin-dashboard')}>
      Go to Admin (Will fail for customer)
    </button>
  );
}
```

---

## 📍 Path Reference

### Staff Paths
```
✓ /staff-dashboard
✓ /staff-dashboard/assigned-tasks
✓ /staff-dashboard/orders
✓ /staff-dashboard/inventory
✓ /notifications
✓ /settings?role=staff
```

### Admin Paths
```
✓ /admin-dashboard
✓ /real-time-production-dashboard
✓ /catalog
✓ /orders
✓ /admin/inventory
✓ /admin/team
✓ /notifications
✓ /settings?role=admin
```

### Customer Paths
```
✓ /customer-dashboard
✓ /customer-dashboard/order-status
✓ /customer-dashboard/shop
✓ /support
✓ /notifications
✓ /settings?role=customer
```

---

## 🔒 Access Control

### Check if user can access a path
```tsx
import { isPathAvailableForRole } from '@/components/roleNavigation';

// Returns true if path available for role
const hasAccess = isPathAvailableForRole('staff', '/orders');

// Use in middleware or guards
if (!isPathAvailableForRole(userRole, currentPath)) {
  redirect('/unauthorized');
}
```

---

## 🎓 Best Practices

1. **Always pass the correct role** to components
2. **Use CompleteRoleNavigation** for full navigation UI
3. **Use MainNavigation** for just main items
4. **Use useRoleNavigation hook** for custom logic
5. **Check canAccessPath** before navigating
6. **Use icons** from lucide-react for consistency
7. **Test each role** to ensure correct buttons appear

---

## ✅ Checklist

- [x] All staff buttons defined
- [x] All admin buttons defined
- [x] All customer buttons defined
- [x] All paths mapped
- [x] Navigation hook created
- [x] Pre-built components created
- [x] Access control functions
- [x] Type safety ensured
- [x] 5+ examples included
- [x] Complete documentation

---

## 🚀 Next Steps

1. **Identify the current user role** in your app
2. **Pass the role to navigation components**
3. **Use CompleteRoleNavigation** in your layout
4. **Test each role** to verify correct buttons appear
5. **Customize** button styling as needed

---

## 📞 Quick Reference

```tsx
// Component usage
<CompleteRoleNavigation role="staff" />
<MainNavigation role="admin" />
<QuickActions role="customer" />

// Hook usage
const { getMainNav, navigateToRolePath } = useRoleNavigation('staff');

// Configuration
import { roleNavigationConfig, getRoleMainNav } from '@/components/roleNavigation';

// Access control
import { isPathAvailableForRole } from '@/components/roleNavigation';
```

---

Everything is ready to use! Start integrating role-based navigation into your app now! 🎉
