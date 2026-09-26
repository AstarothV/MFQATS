# Navigation Quick Reference

## 🎯 Quick Start

### 1. In Your Component (add 'use client' at top)
```tsx
'use client';
import { useNavigation } from '@/components/navigation';

export default function MyComponent() {
  const { navigate, isActive, currentPath } = useNavigation();
  // Now use these functions!
}
```

### 2. Or Use NavButton Component
```tsx
import NavButton from '@/components/ui/NavButton';
import { Home } from 'lucide-react';

<NavButton href="/dashboard" label="Dashboard" icon={Home} />
```

---

## 📋 Function Reference

### `useNavigation()` Hook

| Function | Returns | Purpose |
|----------|---------|---------|
| `navigate(path)` | void | Navigate to route |
| `isActive(path)` | boolean | Check if exact route active |
| `isPathActive(path)` | boolean | Check if in route area |
| `getCurrentPath()` | string | Get current pathname |
| `navigateBack()` | void | Go to previous page |
| `navigateForward()` | void | Go to next page |
| `currentPath` | string | Current pathname (property) |

---

## 🎨 NavButton Props

```tsx
<NavButton
  href="/path"              // Required: Route to navigate to
  label="Button Text"        // Required: Button label
  icon={IconName}            // Optional: Lucide icon
  variant="primary"          // 'default' | 'primary' | 'outline' | 'ghost'
  size="md"                  // 'sm' | 'md' | 'lg'
  external={false}           // Opens external link if true
  showActiveIndicator={true} // Show dot when active
  onClick={() => {}}         // Extra click handler
  className="..."            // Additional CSS classes
/>
```

---

## 💡 Common Patterns

### Navigate on Button Click
```tsx
<button onClick={() => navigate('/orders')}>Go</button>
```

### Highlight Active Link
```tsx
<div className={isActive('/orders') ? 'bg-primary' : ''}>
  Active: {currentPath}
</div>
```

### Multiple Sub-Routes as Active
```tsx
// Show parent as active when in any child route
if (isPathActive('/staff-dashboard')) {
  // In any /staff-dashboard/* route
}
```

### External Link
```tsx
<NavButton
  href="https://example.com"
  label="External"
  external={true}
/>
```

---

## 📁 Files Created

- ✅ `src/components/navigation.ts` - Core hook & utilities
- ✅ `src/components/ui/NavButton.tsx` - Button component
- ✅ `src/components/NavigationExample.tsx` - Example usage
- ✅ `NAVIGATION_GUIDE.md` - Full documentation
- ✅ `NAVIGATION_QUICKREF.md` - This file

---

## 🔧 Updated Files

- `src/components/ui/Sidebar.tsx` - Now uses `usePathname()` hook

---

## ⚠️ Important Notes

1. Always use `'use client'` in components using hooks
2. For exact route matching, use `isActive()`
3. For parent route matching, use `isPathActive()`
4. Icons must be imported from 'lucide-react'
5. NavButton automatically styles active state

---

## 🚀 Next Steps

1. Read `NAVIGATION_GUIDE.md` for detailed examples
2. Check `NavigationExample.tsx` for working demo
3. Replace existing buttons with `NavButton` component
4. Use `useNavigation` hook in custom components

---

**Need help?** See `NAVIGATION_GUIDE.md` for complete documentation!
