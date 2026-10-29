import type { SupabaseClient } from '@supabase/supabase-js';
import { PROCESS_STAGES } from './orders';

// Who works on each order (orders.assigned_to, see supabase/migrations/20261030000009_order_staff_assignment.sql).
// Shared by Order Management, Team Management and the staff's Assigned Tasks, so all three agree.

/** Orders someone is (or should be) working on: approved, and not yet delivered or cancelled. */
export const ACTIVE_STATUSES: string[] = ['confirmed', ...PROCESS_STAGES.map((s) => s.key)];
export const isActive = (status?: string | null) => ACTIVE_STATUSES.includes(status || '');

export interface StaffMember { id: string; full_name: string; email: string; department: string | null }

export async function fetchStaff(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data, error } = await supabase.from('user_profiles').select('id, full_name, email, department')
    .eq('role', 'staff').eq('is_active', true).order('full_name');
  if (error) throw error;
  return (data || []) as StaffMember[];
}

/** Each staff member's active orders, from a list of orders that includes assigned_to and extended_status. */
export function workload<T extends { assigned_to?: string | null; extended_status?: string | null }>(orders: T[]) {
  const byStaff = new Map<string, T[]>();
  for (const o of orders) {
    if (!o.assigned_to || !isActive(o.extended_status)) continue;
    byStaff.set(o.assigned_to, [...(byStaff.get(o.assigned_to) || []), o]);
  }
  return byStaff;
}

/** Assign an order to a staff member, or take it off them (staffId null). The database notifies the staff member. */
export async function assignOrder(supabase: SupabaseClient, orderId: string, staffId: string | null) {
  const { error } = await supabase.from('orders').update({ assigned_to: staffId }).eq('id', orderId);
  if (error) {
    if (/assigned_to/.test(error.message)) throw new Error('Staff assignment is not set up in the database yet. Run supabase/migrations/20261030000009_order_staff_assignment.sql in the Supabase SQL Editor.');
    throw error;
  }
}

/** Re-runs `load` when orders change (Supabase live updates) and every `ms` as a fallback, while the page is open. */
export function watchOrders(supabase: SupabaseClient, name: string, load: () => void, ms = 10000) {
  const channel = supabase.channel(name).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe();
  const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, ms);
  return () => { clearInterval(timer); supabase.removeChannel(channel); };
}
