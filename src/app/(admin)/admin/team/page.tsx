'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Users, UserCheck, Coffee, AlertTriangle, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { statusLabel, statusVariant } from '@/lib/orders';
import { ACTIVE_STATUSES, assignOrder, fetchStaff, watchOrders, workload, type StaffMember } from '@/lib/staffAssignment';

interface ActiveOrder {
  id: string;
  order_ref: string;
  customer_name: string;
  product_name: string;
  extended_status: string;
  assigned_to: string | null;
  due_date: string | null;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

// Who works on which order. Reads and writes orders.assigned_to, the same column Order Management and the staff's
// Assigned Tasks use, so an assignment made here shows up there too.
export default function TeamManagementPage() {
  const supabase = createClient();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('orders')
      .select('id, order_ref, customer_name, product_name, extended_status, assigned_to, due_date')
      .in('extended_status', ACTIVE_STATUSES).order('due_date', { ascending: true });
    setSetupNeeded(!!error && /assigned_to/.test(error.message));
    if (data) setOrders(data as ActiveOrder[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    fetchStaff(supabase).then(setStaff).catch(() => setStaff([]));
  }, [supabase, load]);
  useEffect(() => watchOrders(supabase, 'team_management', load), [supabase, load]);

  const busy = useMemo(() => workload(orders), [orders]);
  const unassigned = orders.filter((o) => !o.assigned_to);
  const working = staff.filter((m) => busy.has(m.id));
  const available = staff.filter((m) => !busy.has(m.id));
  const staffById = new Map(staff.map((m) => [m.id, m]));
  // available staff first in the list, then the least busy
  const staffChoices = [...staff].sort((a, b) => (busy.get(a.id)?.length || 0) - (busy.get(b.id)?.length || 0) || a.full_name.localeCompare(b.full_name));
  const chosen = staffById.get(selectedStaff);

  async function assign() {
    if (!selectedStaff || !selectedOrder) return;
    setSaving(true);
    try {
      await assignOrder(supabase, selectedOrder, selectedStaff);
      const order = orders.find((o) => o.id === selectedOrder);
      showToast('success', `${chosen?.full_name} will work on ${order?.order_ref}. They were notified.`);
      setSelectedOrder('');
      load();
    } catch (err: any) {
      showToast('error', err?.message || 'Could not assign the staff member');
    } finally {
      setSaving(false);
    }
  }

  const stat = (Icon: React.ElementType, tone: string, label: string, value: number, note: string) => (
    <div className="card-dark p-5 rounded-3xl border border-border">
      <div className="flex items-center gap-3 mb-3">
        <Icon className={tone} size={20} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{loading ? '—' : value}</p>
      <p className="text-xs text-muted-foreground mt-1">{note}</p>
    </div>
  );

  return (
    <AppLayout role="admin" currentPath="/admin/team">
      <div className="space-y-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        )}

        <div>
          <h1 className="page-title">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-2">
            See who is working on which order, and assign staff to the orders customers placed.
          </p>
        </div>

        {setupNeeded && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <p className="text-foreground">Staff assignment is not set up in the database yet. Run <code>supabase/migrations/20261030000009_order_staff_assignment.sql</code> in the Supabase SQL Editor.</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card-dark rounded-3xl border border-border p-6 xl:col-span-2">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">New Staff Assignment</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose a staff member and an approved order. It also shows in Order Management and in the staff member&apos;s Assigned Tasks.</p>
              </div>
              <ClipboardList className="text-primary shrink-0" size={18} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2" htmlFor="team-staff">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Staff member</span>
                <select id="team-staff" className="input-dark w-full" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                  <option value="">Choose staff member</option>
                  {staffChoices.map((m) => {
                    const n = busy.get(m.id)?.length || 0;
                    return <option key={m.id} value={m.id}>{m.full_name} ({n === 0 ? 'available' : `working on ${n}`})</option>;
                  })}
                </select>
              </label>

              <label className="space-y-2" htmlFor="team-order">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Order</span>
                <select id="team-order" className="input-dark w-full" value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} disabled={orders.length === 0}>
                  <option value="">{orders.length === 0 ? 'No approved orders' : 'Choose order'}</option>
                  {[...unassigned, ...orders.filter((o) => o.assigned_to)].map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_ref} · {o.customer_name} · {o.product_name}{o.assigned_to ? ` (now ${staffById.get(o.assigned_to)?.full_name ?? 'assigned'})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={assign} disabled={!selectedStaff || !selectedOrder || saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Assign to order
              </button>
              <p className="text-xs text-muted-foreground">
                {chosen ? `${chosen.full_name} is ${busy.has(chosen.id) ? `working on ${busy.get(chosen.id)!.map((o) => o.order_ref).join(', ')}` : 'available'}.` : 'Available staff are listed first.'}
              </p>
            </div>

            <div className="mt-6 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-foreground">Orders without staff</p>
                <span className="text-xs text-muted-foreground">{unassigned.length} waiting</span>
              </div>
              {unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every approved order has a staff member.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unassigned.map((o) => (
                    <button key={o.id} type="button" onClick={() => setSelectedOrder(o.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${selectedOrder === o.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}>
                      {o.order_ref} · {o.customer_name} · {o.product_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card-dark rounded-3xl border border-border p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Who is working on what</h2>
              <p className="text-sm text-muted-foreground mt-1">Approved orders and the stage each one is at now.</p>
            </div>
            {orders.filter((o) => o.assigned_to).length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders are assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.filter((o) => o.assigned_to).map((o) => (
                  <div key={o.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{o.order_ref} · {o.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{o.customer_name}</p>
                      </div>
                      <StatusBadge variant={statusVariant(o.extended_status)} label={statusLabel(o.extended_status)} />
                    </div>
                    <p className="mt-3 text-xs font-medium text-primary">{staffById.get(o.assigned_to!)?.full_name ?? 'Staff member'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stat(Users, 'text-primary', 'Staff', staff.length, 'active staff accounts')}
          {stat(UserCheck, 'text-success', 'Working now', working.length, 'on at least one approved order')}
          {stat(Coffee, 'text-info', 'Available', available.length, 'not on any order')}
          {stat(AlertTriangle, 'text-warning', 'Orders without staff', unassigned.length, 'approved, nobody assigned yet')}
        </div>

        <div className="card-dark rounded-3xl border border-border p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Team Overview</h2>
              <p className="text-sm text-muted-foreground mt-1">Every staff member and the orders they are working on.</p>
            </div>
            <span className="text-xs text-muted-foreground">{staff.length} members</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Working on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">{loading ? 'Loading…' : 'No active staff accounts. Add staff in User Management.'}</td></tr>
                ) : staff.map((m) => {
                  const theirs = busy.get(m.id) || [];
                  return (
                    <tr key={m.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary text-xs font-bold text-primary-foreground flex items-center justify-center">{initials(m.full_name)}</div>
                          <div>
                            <p className="font-semibold text-foreground">{m.full_name}</p>
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{m.department || '—'}</td>
                      <td className="px-4 py-4">
                        <StatusBadge variant={theirs.length ? 'ok' : 'neutral'} label={theirs.length ? 'Working' : 'Available'} />
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {theirs.length === 0 ? 'Available for a new order' : (
                          <ul className="space-y-1">
                            {theirs.map((o) => <li key={o.id}><span className="font-semibold text-foreground">{o.order_ref}</span> · {o.product_name} · {statusLabel(o.extended_status)}</li>)}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
