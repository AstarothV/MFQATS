# Navigation System - Complete Index

## 📍 Location Map

### Core Files
| File | Purpose | Location |
|------|---------|----------|
| Navigation Hook | useNavigation hook & utilities | `src/components/navigation.ts` |
| NavButton Component | Reusable nav button | `src/components/ui/NavButton.tsx` |
| Navigation Example | Working demo | `src/components/NavigationExample.tsx` |
| Updated Sidebar | Uses new path detection | `src/components/ui/Sidebar.tsx` |

### Documentation Files
| File | Purpose |
|------|---------|
| `NAVIGATION_GUIDE.md` | Complete detailed guide (11KB) |
| `NAVIGATION_QUICKREF.md` | Quick reference card (3KB) |
| `IMPLEMENTATION_SUMMARY.md` | Overview and summary |
| `NAVIGATION_INDEX.md` | This file - complete index |

---

## 🔍 Quick Lookup

### I want to...

#### Navigate to a page
```tsx
// Option 1: Use NavButton (simplest)
<NavButton href="/orders" label="Orders" />

// Option 2: Use navigate function
const { navigate } = useNavigation();
navigate('/orders');
```

#### Check if a button is active
```tsx
const { isActive, isPathActive } = useNavigation();

// Exact match
if (isActive('/orders')) { /* on /orders page */ }

// Prefix match (includes children)
if (isPathActive('/staff-dashboard')) { /* in any /staff-dashboard/* */  }
```

#### Get current page
```tsx
const { currentPath } = useNavigation();
console.log(currentPath); // "/orders"
```

#### Add back/forward buttons
```tsx
const { navigateBack, navigateForward } = useNavigation();

<button onClick={navigateBack}>Back</button>
<button onClick={navigateForward}>Forward</button>
```

#### Style active buttons differently
```tsx
// Automatic with NavButton
<NavButton href="/orders" label="Orders" showActiveIndicator={true} />

// Manual with useNavigation
<div className={isActive('/orders') ? 'bg-primary' : 'bg-gray-200'}>
  Orders
</div>
```

#### Use different button styles
```tsx
// Primary button
<NavButton href="/orders" label="Orders" variant="primary" />

// Outline button
<NavButton href="/orders" label="Orders" variant="outline" />

// Ghost button (subtle)
<NavButton href="/orders" label="Orders" variant="ghost" />

// Default button
<NavButton href="/orders" label="Orders" variant="default" />
```

#### Use different button sizes
```tsx
<NavButton href="/orders" label="Orders" size="sm" />   // Small
<NavButton href="/orders" label="Orders" size="md" />   // Medium (default)
<NavButton href="/orders" label="Orders" size="lg" />   // Large
```

#### Add icons to buttons
```tsx
import { Package } from 'lucide-react';

<NavButton 
  href="/orders" 
  label="Orders" 
  icon={Package}  // Any lucide-react icon
/>
```

#### Handle external links
```tsx
<NavButton
  href="https://example.com"
  label="External"
  external={true}
/>
```

#### Add click handlers
```tsx
<NavButton
  href="/orders"
  label="Orders"
  onClick={() => console.log('Clicked!')}
/>
```

#### Create a navigation menu
```tsx
import NavButton from '@/components/ui/NavButton';
import { Package, ShoppingBag, User } from 'lucide-react';

export function Menu() {
  return (
    <div className="flex gap-2">
      <NavButton href="/orders" label="Orders" icon={Package} />
      <NavButton href="/shop" label="Shop" icon={ShoppingBag} />
      <NavButton href="/profile" label="Profile" icon={User} />
    </div>
  );
}
```

---

## 📦 All Available Functions

### From `useNavigation()` Hook

```tsx
'use client';
import { useNavigation } from '@/components/navigation';

const {
  navigate,          // (href: string, options?) => void
  isActive,          // (href: string) => boolean
  isPathActive,      // (basePath: string) => boolean
  getCurrentPath,    // () => string
  navigateBack,      // () => void
  navigateForward,   // () => void
  currentPath        // string (property)
} = useNavigation();
```

### From Navigation Utilities

```tsx
import { getNavItemStatus, isRouteActive } from '@/components/navigation';

// Get status of navigation item
const status = getNavItemStatus(currentPath, '/orders');
// Returns: 'active' or 'inactive'

// Check if route matches with options
const exactMatch = isRouteActive('/staff-dashboard', '/staff-dashboard', true);
const prefixMatch = isRouteActive('/staff-dashboard/orders', '/staff-dashboard', false);
```

### NavButton Component Props

```tsx
import NavButton from '@/components/ui/NavButton';

<NavButton
  href={string}                    // REQUIRED
  label={string}                   // REQUIRED
  icon={LucideIcon}                // Optional: lucide-react icon
  onClick={() => void}             // Optional: click handler
  variant={string}                 // Optional: 'default' | 'primary' | 'outline' | 'ghost'
  size={string}                    // Optional: 'sm' | 'md' | 'lg'
  external={boolean}               // Optional: external link
  className={string}               // Optional: custom CSS
  showActiveIndicator={boolean}    // Optional: show active dot
/>
```

---

## 🗺️ Route Map (Your App)

### Staff Routes
```
/staff-dashboard                    → Workshop
/staff-dashboard/assigned-tasks     → Assigned Tasks
/staff-dashboard/orders             → Order Workflow
/staff-dashboard/inventory          → Inventory
```

### Admin Routes
```
/admin-dashboard                    → Admin Overview
/real-time-production-dashboard     → Production
/catalog                            → Product Catalog
/orders                             → Order Management
/admin/inventory                    → Inventory Management
/admin/team                         → Team Management
```

### Customer Routes
```
/customer-dashboard                 → My Orders
/customer-dashboard/order-status    → Order Status
/customer-dashboard/shop            → Shop Products
/support                            → Support
```

---

## 🎨 Button Variants Reference

### Default Variant
- Outlined style with dynamic colors
- Changes to primary color when active
- Best for: regular navigation

### Primary Variant
- Filled background color
- Prominent appearance
- Best for: main calls-to-action

### Outline Variant
- Bordered with primary color
- Light background on active
- Best for: secondary navigation

### Ghost Variant
- Minimal styling
- Subtle appearance
- Best for: tertiary/footer navigation

---

## 🧩 Component Examples

### Full Navigation Menu
```tsx
'use client';
import NavButton from '@/components/ui/NavButton';
import { LayoutDashboard, Package, Users, Settings } from 'lucide-react';

export default function NavigationMenu() {
  return (
    <nav className="flex flex-col gap-2">
      <NavButton href="/dashboard" label="Dashboard" icon={LayoutDashboard} variant="primary" />
      <NavButton href="/orders" label="Orders" icon={Package} />
      <NavButton href="/team" label="Team" icon={Users} />
      <NavButton href="/settings" label="Settings" icon={Settings} variant="ghost" />
    </nav>
  );
}
```

### Dynamic Navigation with Active Detection
```tsx
'use client';
import { useNavigation } from '@/components/navigation';

export default function CustomNav() {
  const { navigate, isActive, currentPath } = useNavigation();

  return (
    <div>
      <p>Current: {currentPath}</p>
      <div className={isActive('/orders') ? 'text-primary' : 'text-gray'}>
        You're viewing Orders
      </div>
    </div>
  );
}
```

### Breadcrumb Navigation
```tsx
'use client';
import { useNavigation } from '@/components/navigation';

export default function Breadcrumb() {
  const { navigate, currentPath } = useNavigation();
  const segments = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex gap-2">
      {segments.map((segment, idx) => (
        <div key={segment}>
          {idx > 0 && <span> / </span>}
          <button onClick={() => navigate('/' + segments.slice(0, idx + 1).join('/'))}>
            {segment}
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔧 Configuration

### Import Path Alias
Already configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

This allows:
```tsx
import NavButton from '@/components/ui/NavButton';  // ✅ Works
// Instead of:
import NavButton from '../../../components/ui/NavButton';  // ❌ Long path
```

---

## 📖 Documentation Structure

### Read First
1. `NAVIGATION_QUICKREF.md` - 5 min read, quick start

### Read Next
2. `NAVIGATION_GUIDE.md` - 20 min read, detailed guide

### Reference
3. This file - lookup specific functions or examples

### Learn by Doing
4. `NavigationExample.tsx` - working component to study

---

## ✅ Verification Checklist

- [x] Hook created: `useNavigation()`
- [x] Component created: `NavButton`
- [x] Example created: `NavigationExample.tsx`
- [x] Sidebar updated with hook
- [x] TypeScript configured
- [x] All imports use @/ alias
- [x] Documentation complete
- [x] lucide-react icons available
- [x] No breaking changes
- [x] Production ready

---

## 🚀 Getting Started

### Step 1: Choose Your Approach
- **Simplest:** Use `<NavButton>` component
- **Most Control:** Use `useNavigation()` hook
- **Mixed:** Use both together

### Step 2: Start Using
```tsx
// Copy this template:
'use client';
import NavButton from '@/components/ui/NavButton';
import { YourIcon } from 'lucide-react';

export default function YourComponent() {
  return (
    <NavButton
      href="/your-route"
      label="Button Text"
      icon={YourIcon}
    />
  );
}
```

### Step 3: Reference Documentation
- Need quick help? → `NAVIGATION_QUICKREF.md`
- Need details? → `NAVIGATION_GUIDE.md`
- Need examples? → `NavigationExample.tsx`

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Active state not updating | Add `'use client'` to top of file |
| Icon not showing | Import from 'lucide-react', pass component not string |
| Route not found | Check route path matches your app routes |
| Styling looks wrong | Verify Tailwind CSS is configured |
| TypeScript errors | Check imports use @/ alias correctly |

---

## 📞 Quick Links

| Need | File |
|------|------|
| Copy-paste examples | `NavigationExample.tsx` |
| Quick answers | `NAVIGATION_QUICKREF.md` |
| Detailed help | `NAVIGATION_GUIDE.md` |
| Component code | `src/components/ui/NavButton.tsx` |
| Hook code | `src/components/navigation.ts` |

---

**Happy navigating!** 🚀
