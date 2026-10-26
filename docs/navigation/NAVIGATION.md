# Navigation: pages, menus and who can open what

MFQATS has three roles: **admin**, **staff** and **customer**. Each role has its own pages, its own sidebar menu and its
own home page. Two files control all of it:

| File | What it controls |
|---|---|
| [`src/components/ui/Sidebar.tsx`](../../src/components/ui/Sidebar.tsx) | The sidebar menu each role sees |
| [`src/middleware.ts`](../../src/middleware.ts) | Which pages each role is allowed to open |

---

## Home page per role

After logging in, each role lands on its home page. If someone opens a page their role can't use, they're sent back here.

| Role | Home page |
|---|---|
| Admin | `/admin-dashboard` |
| Staff | `/staff-dashboard` |
| Customer | `/customer-dashboard` |

## Sidebar menu per role

**Admin**

| Group | Pages |
|---|---|
| Overview | Admin Overview, Inspection Progress |
| Operations | Order Management, Product Catalog, Inventory, Team |
| Quality | Defect Analytics, Rework Queue, Reports |
| Admin | User Management, Audit Logs, Messages |

**Staff**

| Group | Pages |
|---|---|
| Workshop | Workshop, Assigned Tasks, Order Workflow, Quality Scan |
| Resources | Inventory, Messages |

**Customer:** Overview, OrderView, Inquiry, Shop Products.

## Who can open which pages

The middleware checks the start of each page's address against the role's list:

| Role | Can open addresses starting with |
|---|---|
| Admin | `/admin-dashboard`, `/real-time-production-dashboard`, `/catalog`, `/orders`, `/admin` |
| Staff | `/staff-dashboard`, `/staff` |
| Customer | `/customer-dashboard`, `/support` |

- **Customer only:** `/customer-dashboard/shop` and `/customer-dashboard/order-status` are blocked for admin and staff.
- **Open to everyone, no login:** the landing page (`/landing`) and the login page (`/sign-up-login-screen`).

The database applies its own rules too (Supabase row-level security), so a customer can only ever read their own
orders, even through the API.

## Where the pages live

Pages are grouped by role in `src/app/`. The folder names in brackets don't appear in the address:

| Folder | Example page | Address |
|---|---|---|
| `src/app/(admin)/` | `(admin)/admin/reports/page.tsx` | `/admin/reports` |
| `src/app/(staff)/` | `(staff)/staff/quality-scan/page.tsx` | `/staff/quality-scan` |
| `src/app/(customer)/` | `(customer)/customer-dashboard/shop/page.tsx` | `/customer-dashboard/shop` |

Each group's `layout.tsx` keeps the top bar and sidebar on screen while you move between pages.

---

## Adding a page

1. **Create the page.** Add a `page.tsx` in the right role's folder, for example
   `src/app/(admin)/admin/suppliers/page.tsx` for `/admin/suppliers`. Wrap its content in `AppLayout`, like the pages
   around it.
2. **Add it to the menu.** In `Sidebar.tsx`, add an entry to the right group in `navByRole`:
   ```ts
   { label: 'Suppliers', href: '/admin/suppliers', icon: Truck },
   ```
   Icons come from [lucide-react](https://lucide.dev/icons).
3. **Allow it, if it's a new address.** If the address starts with something not yet in that role's list in
   `middleware.ts` (`ROLE_ROUTES`), add it there. Otherwise the role is sent back to its home page.

To **remove** a page from the menu, delete its entry in `navByRole`. To **move** it to another group, cut and paste the
entry.

---

## Unused files

These files are an older navigation helper. The app doesn't use them (only the two example files import them), so you
can ignore them, or delete them in a cleanup:

`src/components/navigation.ts`, `src/components/roleNavigation.ts`, `src/components/useRoleNavigation.ts`,
`src/components/ui/NavButton.tsx`, `src/components/ui/RoleNavigation.tsx`, `src/components/NavigationExample.tsx`,
`src/components/RoleNavigationExample.tsx`
