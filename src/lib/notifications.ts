// Shared by the notification bell (Topbar) and the admin's Live Alerts.

export type Role = 'staff' | 'admin' | 'customer';
export interface NotificationLike { title: string; entity_type?: string | null; entity_id?: string | null }

/** Where a notification leads: the page that shows what it is about, for this role. */
export function notificationLink(n: NotificationLike, role: Role): string | null {
  const type = (n.entity_type ?? '').replace(/s$/, ''); // 'orders' and 'order' are the same thing
  const id = n.entity_id;
  if (type === 'inventory') return role === 'admin' ? '/admin/inventory' : role === 'staff' ? '/staff-dashboard/inventory' : null;
  if (type === 'product_item') return role === 'staff' ? '/staff-dashboard/assigned-tasks' : null;
  if (type !== 'order' || !id) return null;
  if (role === 'customer') return `/customer-dashboard/order-view?order=${id}`;
  if (role === 'staff') return `/staff/quality-scan?order=${id}`;
  if (/scan review/i.test(n.title)) return '/admin/rework';
  if (/message/i.test(n.title)) return `/real-time-production-dashboard?order=${id}`;
  return `/orders?order=${id}`;
}

/** Defect names come from the detector as codes (dead_knot); show them as words (dead knot). */
export const readable = (text: string) => text.replace(/([a-z])_([a-z])/gi, '$1 $2');

/** "just now", "5m ago", "3h ago", "2d ago", then the date. */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
