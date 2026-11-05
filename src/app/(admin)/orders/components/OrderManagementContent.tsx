'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Search, Truck, ClipboardCheck, Loader2, CheckCircle2, AlertTriangle, X, Package, UserPlus, UserMinus, Trash2, ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { moveOrderStage, ORDER_STATUSES, PROCESS_STAGES, statusLabel, statusVariant } from '@/lib/orders';
import { SkeletonRegion, SplitContentSkeleton } from '@/components/ui/LoadingSkeleton';

import { peso } from '@/lib/money';
import { deleteOrder } from '@/lib/orderMedia';
import { useAuth } from '@/contexts/AuthContext';
import { assignOrder, fetchStaff, isActive, watchOrders, workload, type StaffMember } from '@/lib/staffAssignment';
const GATE_HINTS: Record<string, string> = {
  scan_done: 'Needs a defect scan saved for this order during Detect Defects',
  scan_passed: 'Needs the latest defect scan to pass',
};

const STATUS_GROUPS = {
  All: [],
  New: ['pending', 'confirmed'],
  'In production': PROCESS_STAGES.map((st) => st.key),
  Closed: ['delivered', 'cancelled'],
} as const;

export default function OrderManagementContent({ eyebrow = 'Order Management' }: { eyebrow?: string }) {
  const supabase = createClient();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin'; // this page is also the staff's Order Workflow
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // filters in four groups (a group shows all its statuses; the dropdown narrows it to one)
  const [filterGroup, setFilterGroup] = useState<keyof typeof STATUS_GROUPS>('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [choosingStaff, setChoosingStaff] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  // Only the first load shows the skeleton; the refreshes that follow (live updates) keep the page in place.
  const fetchOrders = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    const query = (staffJoin: boolean) => supabase.from('orders')
      .select(`*, customer:customer_id(full_name, email, phone)${staffJoin ? ', staff:assigned_to(full_name)' : ''}`)
      .order('created_at', { ascending: false }).limit(50);
    let { data, error } = await query(true);
    if (error) ({ data } = await query(false)); // the staff column is not in the database yet (migration not run)
    const rows = (data || null) as any[] | null;
    if (rows) {
      setOrders(rows);
      // a notification link (?order=<id>) opens that order, the first time the list loads
      const wanted = !loadedOnce.current ? new URLSearchParams(window.location.search).get('order') : null;
      if (wanted && rows.some((r) => r.id === wanted)) {
        setSelectedOrderId(wanted);
        window.setTimeout(() => document.getElementById('order-panels')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      } else setSelectedOrderId((id) => id ?? rows[0]?.id ?? null);
    }
    loadedOnce.current = true;
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchStaff(supabase).then(setStaff).catch(() => setStaff([])); }, [supabase]);

  // FSM edges (supabase/migrations/*_order_stage_fsm.sql). The database rejects any other move; this only greys out buttons.
  const [transitions, setTransitions] = useState<{ from_status: string; to_status: string; gate: string | null }[]>([]);
  useEffect(() => {
    supabase.from('order_status_transitions').select('*').then(({ data, error }) => {
      if (error) showToast('error', `Could not load stage rules: ${error.message}`);
      else setTransitions(data || []);
    });
  }, [supabase]);

  // Keeps the stage and the staff up to date while staff work on the orders
  useEffect(() => watchOrders(supabase, 'orders_management', fetchOrders), [supabase, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchSearch = order.order_ref?.toLowerCase().includes(search.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(search.toLowerCase());
      const st = order.extended_status || 'pending';
      const matchStatus = filterStatus !== 'All' ? st === filterStatus : filterGroup === 'All' || (STATUS_GROUPS[filterGroup] as readonly string[]).includes(st);
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus, filterGroup]);

  const activeOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  async function updateOrderStatus(orderId: string, newStatus: string) {
    setUpdating(true);
    try {
      await moveOrderStage(supabase, orders.find(o => o.id === orderId) || { id: orderId }, newStatus);

      showToast('success', `Order moved to ${statusLabel(newStatus)}`);
      fetchOrders();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  // Only cancelled orders, only admins (the database checks both too). Its scans, photos and history go with it.
  async function removeOrder(order: any) {
    if (!window.confirm(`Delete ${order.order_ref} for good? Its scans, photos and history are deleted too. This cannot be undone.`)) return;
    setUpdating(true);
    try {
      await deleteOrder(supabase, order.id);
      showToast('success', `${order.order_ref} was deleted`);
      setSelectedOrderId(null);
      fetchOrders();
    } catch (err: any) {
      showToast('error', err?.message || 'Could not delete the order');
    } finally {
      setUpdating(false);
    }
  }

  async function approveOrder(orderId: string) {
    await updateOrderStatus(orderId, 'confirmed');
    setChoosingStaff(true); // approved: show who can work on it
  }

  async function setStaffFor(orderId: string, staffId: string | null) {
    setAssigning(staffId ?? 'none');
    try {
      await assignOrder(supabase, orderId, staffId);
      const name = staff.find((m) => m.id === staffId)?.full_name;
      showToast('success', staffId ? `${name} will work on this order. They were notified.` : 'The order no longer has a staff member.');
      setChoosingStaff(false);
      fetchOrders();
    } catch (err: any) {
      showToast('error', err?.message || 'Could not assign the staff member');
    } finally {
      setAssigning(null);
    }
  }

  // each staff member's active orders, and the list to choose from with the available ones first
  const busy = workload(orders);
  const staffChoices = [...staff].sort((a, b) => (busy.get(a.id)?.length || 0) - (busy.get(b.id)?.length || 0) || a.full_name.localeCompare(b.full_name));
  useEffect(() => { setChoosingStaff(false); }, [selectedOrderId]);

  const nextMoves = transitions.filter(t => t.from_status === (activeOrder?.extended_status || 'pending'));
  const canMoveTo = (status: string) => nextMoves.some(t => t.to_status === status);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.message}
        </div>
      )}

      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">Track orders through the inspection process</h1>
        <p className="page-subtitle">Pick an order in the list to see its details, assigned staff and stage below.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status group">
          {(Object.keys(STATUS_GROUPS) as (keyof typeof STATUS_GROUPS)[]).map((g) => {
            const n = g === 'All' ? orders.length : orders.filter((o) => (STATUS_GROUPS[g] as readonly string[]).includes(o.extended_status || 'pending')).length;
            return (
              <button key={g} type="button" onClick={() => { setFilterGroup(g); setFilterStatus('All'); }} aria-pressed={filterGroup === g}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${filterGroup === g ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {g} <span className="ml-0.5 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        {filterGroup !== 'All' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Status in {filterGroup}</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-dark py-2 pr-8 text-sm">
              <option value="All">All {filterGroup.toLowerCase()}</option>
              {STATUS_GROUPS[filterGroup].map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <SkeletonRegion label="Loading orders"><SplitContentSkeleton /></SkeletonRegion>
      ) : (
        <div className="space-y-4">
          {/* Orders List: full width, so every column fits without scrolling sideways */}
          <section className="card-dark rounded-3xl border border-border p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Active orders</h2>
                <p className="text-sm text-muted-foreground mt-1">{filteredOrders.length} orders</p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders" className="input-dark w-full pl-11" />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          requestAnimationFrame(() => document.getElementById('order-panels')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedOrderId === order.id ? 'bg-primary/10' : ''}`}
                      >
                        <td className="px-4 py-4 font-semibold text-foreground whitespace-nowrap">{order.order_ref}</td>
                        <td className="px-4 py-4 text-muted-foreground">{order.customer_name}</td>
                        <td className="px-4 py-4">
                          <StatusBadge
                            variant={statusVariant(order.extended_status || order.status)}
                            label={statusLabel(order.extended_status || order.status)}
                          />
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {order.staff?.full_name || (isActive(order.extended_status) ? <span className="text-warning">Not assigned</span> : '—')}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{order.due_date || '—'}</td>
                        <td className="px-4 py-4 font-semibold text-foreground">{peso(order.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* The picked order: details, staff, stage and actions, below the list */}
          <div id="order-panels" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
            {activeOrder && (
              <>
                <section className="card-dark rounded-3xl border border-border p-6">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Order details</h2>
                      <p className="text-sm text-muted-foreground mt-1">{activeOrder.order_ref}</p>
                    </div>
                    <StatusBadge
                      variant={statusVariant(activeOrder.extended_status || activeOrder.status)}
                      label={statusLabel(activeOrder.extended_status || activeOrder.status)}
                    />
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex justify-between gap-4">
                      <span>Customer</span>
                      <span className="text-foreground font-semibold">{activeOrder.customer_name}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Product</span>
                      <span className="text-foreground font-semibold">{activeOrder.product_name}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Order value</span>
                      <span className="text-foreground font-semibold">{peso(activeOrder.amount)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Due date</span>
                      <span className="text-foreground font-semibold">{activeOrder.due_date || '—'}</span>
                    </div>
                    {activeOrder.delivery_address && (
                      <div className="flex justify-between gap-4">
                        <span>Delivery</span>
                        <span className="text-foreground font-semibold text-right">{activeOrder.delivery_address}, {activeOrder.delivery_city}</span>
                      </div>
                    )}
                    <div className="rounded-3xl bg-muted p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-3">
                        <span>Process progress</span>
                        <span>{activeOrder.completion_pct || 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${activeOrder.completion_pct || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Assigned staff */}
                <section className="card-dark rounded-3xl border border-border p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-foreground">Assigned staff</h3>
                    {activeOrder.assigned_to && isActive(activeOrder.extended_status) && !choosingStaff && (
                      <button type="button" onClick={() => setChoosingStaff(true)} className="text-sm font-semibold text-primary hover:underline">Change</button>
                    )}
                  </div>
                  {activeOrder.assigned_to ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">{activeOrder.staff?.full_name || 'Staff member'}</p>
                        <p className="text-xs text-muted-foreground">
                          {activeOrder.assigned_at ? `Assigned ${new Date(activeOrder.assigned_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Assigned'}
                          {isActive(activeOrder.extended_status) ? ` · working on it, now at ${statusLabel(activeOrder.extended_status)}` : ''}
                        </p>
                      </div>
                      {isActive(activeOrder.extended_status) && (
                        <button type="button" onClick={() => setStaffFor(activeOrder.id, null)} disabled={!!assigning}
                          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-danger disabled:opacity-50">
                          <UserMinus size={14} /> Remove
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {(activeOrder.extended_status || 'pending') === 'pending' ? 'Approve the order first, then choose who will work on it.'
                        : isActive(activeOrder.extended_status) ? 'Nobody is working on this order yet.' : 'No staff member was assigned.'}
                    </p>
                  )}
                  {isActive(activeOrder.extended_status) && (!activeOrder.assigned_to || choosingStaff) && (
                    staff.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No active staff accounts. Add staff in User Management.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {staffChoices.filter((m) => m.id !== activeOrder.assigned_to).map((m) => {
                          const theirs = busy.get(m.id) || [];
                          return (
                            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-2.5 text-sm">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">{m.full_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {theirs.length === 0 ? <span className="font-semibold text-success">Available</span>
                                    : `Working on ${theirs.length}: ${theirs.map((o: any) => o.order_ref).join(', ')}`}
                                  {m.department ? ` · ${m.department}` : ''}
                                </p>
                              </div>
                              <button type="button" onClick={() => setStaffFor(activeOrder.id, m.id)} disabled={!!assigning}
                                className="btn-secondary flex items-center gap-1.5 text-xs disabled:opacity-50">
                                {assigning === m.id ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Assign
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )
                  )}
                </section>

                {/* Update Status */}
                <section className="card-dark rounded-3xl border border-border p-6">
                  <h3 className="text-base font-semibold text-foreground">Update Process Stage</h3>
                  <p className="mt-1 mb-4 text-sm text-muted-foreground">Now at <span className="font-semibold text-foreground">{statusLabel(activeOrder.extended_status || 'pending')}</span>. Only the moves allowed from here are shown.</p>
                  {(() => {
                    // the official process decides the next steps; cancelling and delivering live in Quick Actions
                    const moves = ORDER_STATUSES.filter((st) => st !== 'cancelled' && st !== 'delivered' && st !== (activeOrder.extended_status || 'pending') && canMoveTo(st));
                    return moves.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No stage moves from here.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {moves.map((st) => (
                          <button key={st} type="button" onClick={() => updateOrderStatus(activeOrder.id, st)} disabled={updating}
                            title={GATE_HINTS[nextMoves.find((t) => t.to_status === st)?.gate || '']}
                            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50">
                            {updating ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Move to {statusLabel(st)}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </section>

                {/* Actions */}
                <section className="card-dark rounded-3xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
                  </div>
                  <div className="space-y-3">
                    {(activeOrder.extended_status || activeOrder.status) === 'pending' && (
                      <button
                        type="button"
                        onClick={() => approveOrder(activeOrder.id)}
                        disabled={updating}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        <ClipboardCheck size={16} /> Approve Order
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(activeOrder.id, 'delivered')}
                      disabled={updating || !canMoveTo('delivered')}
                      title={GATE_HINTS.scan_passed}
                      className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                      <Truck size={16} /> Mark as Delivered
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(activeOrder.id, 'cancelled')}
                      disabled={updating || !canMoveTo('cancelled')}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 py-3 text-sm text-danger hover:bg-danger/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <X size={16} /> Cancel Order
                    </button>
                    {isAdmin && activeOrder.extended_status === 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => removeOrder(activeOrder)}
                        disabled={updating}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-danger py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                      >
                        <Trash2 size={16} /> Delete Order
                      </button>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
