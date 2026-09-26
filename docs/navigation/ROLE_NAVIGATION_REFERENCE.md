# Role-Based Navigation - Complete Reference

## 📊 All Buttons by Role - Complete List

### STAFF ROLE (Production Worker)

| # | Button | Path | Category | Type |
|---|--------|------|----------|------|
| 1 | 🏭 Workshop | `/staff-dashboard` | Main | Dashboard |
| 2 | ✅ Assigned Tasks | `/staff-dashboard/assigned-tasks` | Main | Work |
| 3 | 📦 Order Workflow | `/staff-dashboard/orders` | Main | Work |
| 4 | 🛒 Inventory | `/staff-dashboard/inventory` | Main | Work |
| 5 | ⏱️ Start Task Timer | `/staff-dashboard?action=start-timer` | Quick | Action |
| 6 | ⚠️ Report Issue | `/staff-dashboard?action=report` | Quick | Action |
| 7 | 👁️ QA Check | `/staff-dashboard?action=qa` | Quick | Action |
| 8 | 🔔 Notifications | `/notifications` | Secondary | Utility |
| 9 | ⚙️ Settings | `/settings?role=staff` | Secondary | Utility |

**Total: 9 buttons**

---

### ADMIN ROLE (Administrator)

| # | Button | Path | Category | Type |
|---|--------|------|----------|------|
| 1 | 📊 Admin Overview | `/admin-dashboard` | Main | Dashboard |
| 2 | 📈 Production* | `/real-time-production-dashboard` | Main | Analytics |
| 3 | 📦 Product Catalog | `/catalog` | Main | Products |
| 4 | 🎁 Order Management | `/orders` | Main | Orders |
| 5 | 🚚 Inventory Management | `/admin/inventory` | Main | Inventory |
| 6 | 👥 Team Management | `/admin/team` | Main | Staff |
| 7 | ➕ Create Order | `/orders?action=new` | Quick | Action |
| 8 | ➕ Add Product | `/catalog?action=add` | Quick | Action |
| 9 | ➕ Add Team Member | `/admin/team?action=add` | Quick | Action |
| 10 | 📊 Analytics | `/admin-dashboard?section=analytics` | Quick | Action |
| 11 | 🔔 Notifications | `/notifications` | Secondary | Utility |
| 12 | ⚙️ Settings | `/settings?role=admin` | Secondary | Utility |

*Badge: "Live" (indicates real-time data)

**Total: 12 buttons**

---

### CUSTOMER ROLE (Shopper)

| # | Button | Path | Category | Type |
|---|--------|------|----------|------|
| 1 | 📦 My Orders | `/customer-dashboard` | Main | Orders |
| 2 | 👁️ Order Status | `/customer-dashboard/order-status` | Main | Orders |
| 3 | 🛍️ Shop Products | `/customer-dashboard/shop` | Main | Shopping |
| 4 | 💬 Support | `/support` | Main | Help |
| 5 | ➕ Place Order | `/customer-dashboard/shop?action=order` | Quick | Action |
| 6 | 📍 Track Order | `/customer-dashboard/order-status?action=track` | Quick | Action |
| 7 | 💬 Contact Support | `/support?action=contact` | Quick | Action |
| 8 | 🔔 Notifications | `/notifications` | Secondary | Utility |
| 9 | ⚙️ Settings | `/settings?role=customer` | Secondary | Utility |

**Total: 9 buttons**

---

## 🔧 Function Reference

### Configuration Functions

```typescript
// Get complete navigation config for a role
getRoleNavigation(role: UserRole)
// Returns: RoleNavigationConfig | null

// Get main navigation items
getRoleMainNav(role: UserRole): NavItem[]

// Get quick action items
getRoleQuickActions(role: UserRole): NavItem[]

// Get secondary navigation items
getRoleSecondaryNav(role: UserRole): NavItem[]

// Get specific navigation item
getRoleNavItem(role: UserRole, itemId: string): NavItem | null

// Get all available paths for a role
getRolePaths(role: UserRole): string[]

// Check if a path is available for a role
isPathAvailableForRole(role: UserRole, path: string): boolean
```

### Hook Functions (useRoleNavigation)

```typescript
const {
  // Navigation methods
  navigate(path: string) => void,
  navigateToRolePath(itemId: string) => void,
  canAccessPath(path: string) => boolean,

  // Get items
  getMainNav() => NavItem[],
  getQuickActions() => NavItem[],
  getSecondaryNav() => NavItem[],
  getAllItems() => NavItem[],
  getAllRolePaths() => string[],

  // Active state
  isActive(path: string) => boolean,
  getActiveNavItem() => NavItem | null,
  currentPath: string,

  // Current role
  role: UserRole
} = useRoleNavigation(role);
```

### Component Props

**MainNavigation**
```tsx
<MainNavigation
  role="staff"              // REQUIRED
  variant="primary"         // default | primary | outline | ghost
  layout="vertical"         // horizontal | vertical
  showIcons={true}          // boolean
  className=""              // string
/>
```

**QuickActions**
```tsx
<QuickActions
  role="admin"              // REQUIRED
  variant="outline"         // default | primary | outline | ghost
  layout="horizontal"       // horizontal | vertical
  showIcons={true}          // boolean
  className=""              // string
/>
```

**SecondaryNavigation**
```tsx
<SecondaryNavigation
  role="customer"           // REQUIRED
  className=""              // string
/>
```

**CompleteRoleNavigation**
```tsx
<CompleteRoleNavigation
  role="staff"              // REQUIRED
  showDescriptions={false}  // boolean
  className=""              // string
/>
```

---

## 💡 Usage Patterns

### Pattern 1: Simple Role-Based Nav
```tsx
import { MainNavigation } from '@/components/ui/RoleNavigation';

export default function Sidebar() {
  return <MainNavigation role="staff" variant="primary" />;
}
```

### Pattern 2: Custom Logic with Hook
```tsx
import { useRoleNavigation } from '@/components/useRoleNavigation';

export default function CustomNav() {
  const { getMainNav, navigateToRolePath } = useRoleNavigation('admin');
  
  return getMainNav().map(item => (
    <button onClick={() => navigateToRolePath(item.id)}>
      {item.label}
    </button>
  ));
}
```

### Pattern 3: Access Control
```tsx
import { useRoleNavigation } from '@/components/useRoleNavigation';

export default function ProtectedLink() {
  const { canAccessPath, navigate } = useRoleNavigation('customer');
  
  return (
    <button 
      onClick={() => {
        if (canAccessPath('/orders')) {
          navigate('/orders');
        } else {
          alert('Access denied');
        }
      }}
    >
      View Orders
    </button>
  );
}
```

### Pattern 4: Conditional Rendering
```tsx
import { getRolePaths } from '@/components/roleNavigation';

export default function AdminPanel() {
  const adminPaths = getRolePaths('admin');
  const isAdmin = adminPaths.includes(currentPath);
  
  return isAdmin ? <AdminUI /> : <RestrictedUI />;
}
```

### Pattern 5: Multi-Role View
```tsx
import { AllRolesNavigationComparison } from '@/components/ui/RoleNavigation';

export default function ComparisonPage() {
  return <AllRolesNavigationComparison />;
}
```

---

## 📊 Data Structure

### NavItem Structure
```typescript
interface NavItem {
  id: string;                              // e.g., 'staff-workshop'
  label: string;                           // e.g., 'Workshop'
  href: string;                            // e.g., '/staff-dashboard'
  icon: LucideIcon;                        // e.g., LayoutDashboard
  description?: string;                    // e.g., 'Production workshop overview'
  category?: string;                       // e.g., 'Main', 'Quick', 'Secondary'
  badge?: string;                          // e.g., 'Live'
  badgeVariant?: 'primary' | 'danger' | 'success' | 'warning'; // Badge style
}
```

### Role Navigation Config
```typescript
interface RoleNavigationConfig {
  staff: {
    mainNav: NavItem[];       // 4 items
    quickActions: NavItem[];  // 3 items
    secondaryNav: NavItem[];  // 2 items
  };
  admin: {
    mainNav: NavItem[];       // 6 items
    quickActions: NavItem[];  // 4 items
    secondaryNav: NavItem[];  // 2 items
  };
  customer: {
    mainNav: NavItem[];       // 4 items
    quickActions: NavItem[];  // 3 items
    secondaryNav: NavItem[];  // 2 items
  };
}
```

---

## 🎯 Path Matrix

### Staff Access Matrix
| Path | Staff | Admin | Customer |
|------|:-----:|:-----:|:--------:|
| /staff-dashboard | ✅ | ✅ | ❌ |
| /staff-dashboard/* | ✅ | ✅ | ❌ |
| /admin-dashboard | ❌ | ✅ | ❌ |
| /customer-dashboard | ❌ | ✅ | ✅ |
| /orders | ❌ | ✅ | ❌ |
| /notifications | ✅ | ✅ | ✅ |
| /support | ✅ | ✅ | ✅ |

---

## 🔒 Security Considerations

### Client-Side Validation
```typescript
// Check path accessibility
if (!isPathAvailableForRole(userRole, requestedPath)) {
  // Redirect or show error
  redirect('/unauthorized');
}
```

### Server-Side Validation (Recommended)
```typescript
// Always validate on server
// Example middleware:
export function middleware(req: NextRequest) {
  const userRole = req.cookies.get('userRole');
  const path = req.nextUrl.pathname;
  
  if (!isPathAvailableForRole(userRole, path)) {
    return new NextResponse('Unauthorized', { status: 403 });
  }
}
```

---

## 📈 Statistics

| Metric | Staff | Admin | Customer | Total |
|--------|-------|-------|----------|-------|
| Main Navigation | 4 | 6 | 4 | 14 |
| Quick Actions | 3 | 4 | 3 | 10 |
| Secondary Nav | 2 | 2 | 2 | 6 |
| **Total Buttons** | **9** | **12** | **9** | **30** |
| **Available Paths** | 9 | 12 | 9 | 30 |

---

## ✅ Implementation Checklist

- [ ] Identify user's current role
- [ ] Import role navigation components
- [ ] Pass role to navigation components
- [ ] Test each role's navigation
- [ ] Implement server-side access control
- [ ] Add logging for navigation events
- [ ] Handle unauthorized access gracefully
- [ ] Test mobile responsive behavior
- [ ] Add animations/transitions
- [ ] Monitor analytics

---

## 🚀 Integration Steps

### Step 1: Identify Current Role
```tsx
// Get from auth context, session, or props
const userRole = getCurrentUserRole();
```

### Step 2: Use Navigation Component
```tsx
<CompleteRoleNavigation role={userRole} />
```

### Step 3: Test All Roles
```
□ Test as Staff
□ Test as Admin
□ Test as Customer
□ Verify all buttons appear
□ Verify all paths work
```

### Step 4: Deploy
```
□ Code review
□ QA testing
□ Performance testing
□ Accessibility check
□ Deploy to production
```

---

## 🧪 Testing Checklist

### Staff Role Tests
- [ ] All 4 main nav items visible
- [ ] All 3 quick actions visible
- [ ] Can navigate to all staff paths
- [ ] Cannot access admin paths
- [ ] Cannot access customer paths

### Admin Role Tests
- [ ] All 6 main nav items visible
- [ ] All 4 quick actions visible
- [ ] Can navigate to all admin paths
- [ ] Can see staff paths (admin view)
- [ ] Cannot access customer paths

### Customer Role Tests
- [ ] All 4 main nav items visible
- [ ] All 3 quick actions visible
- [ ] Can navigate to all customer paths
- [ ] Cannot access staff paths
- [ ] Cannot access admin paths

---

## 💬 FAQ

**Q: How do I add a new button?**
A: Edit `roleNavigation.ts`, add item to appropriate role's array.

**Q: How do I hide a button from a role?**
A: Remove it from that role's navigation config.

**Q: Can I customize button styling per role?**
A: Yes, pass different `variant` or `className` props.

**Q: How do I handle dynamic paths?**
A: Use the path with query params, e.g., `/orders?id=123`

**Q: Should I validate on client or server?**
A: Always validate on server - client-side is just UI.

---

## 📞 Quick Reference

```bash
# Import configuration
import { roleNavigationConfig, getRoleMainNav } from '@/components/roleNavigation';

# Import hook
import { useRoleNavigation } from '@/components/useRoleNavigation';

# Import components
import { 
  MainNavigation,
  QuickActions,
  CompleteRoleNavigation 
} from '@/components/ui/RoleNavigation';

# Import example
import RoleNavigationExample from '@/components/RoleNavigationExample';
```

---

Everything is documented and ready to use! 🎉
