'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Search, Truck, ClipboardCheck, Loader2, CheckCircle2, AlertTriangle, X, Package } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { moveOrderStage, ORDER_STATUSES, PROCESS_STAGES, statusLabel, statusVariant } from '@/lib/orders';
import { SkeletonRegion, SplitContentSkeleton } from '@/components/ui/LoadingSkeleton';

const GATE_HINTS: Record<string, string> = {
  scan_done: 'Needs a defect scan saved for this order during Detect Defects',
  scan_passed: 'Needs the latest defect scan to pass',
};

export default function OrderManagementContent() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customer_id(full_name, email, phone)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setOrders(data);
      if (!selectedOrderId && data.length > 0) setSelectedOrderId(data[0].id);
    }
    setLoading(false);
  }, [supabase, selectedOrderId]);

  useEffect(() => { fetchOrders(); }, []);

  // FSM edges (supabase/migrations/*_order_stage_fsm.sql). The database rejects any other move; this only greys out buttons.
  const [transitions, setTransitions] = useState<{ from_status: string; to_status: string; gate: string | null }[]>([]);
  useEffect(() => {
    supabase.from('order_status_transitions').select('*').then(({ data, error }) => {
      if (error) showToast('error', `Could not load stage rules: ${error.message}`);
      else setTransitions(data || []);
    });
  }, [supabase]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchSearch = order.order_ref?.toLowerCase().includes(search.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'All' || (order.extended_status || 'pending') === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus]);

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

  async function approveOrder(orderId: string) {
    await updateOrderStatus(orderId, 'confirmed');
  }

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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] mb-2">Order Management</p>
          <h1 className="text-3xl font-bold text-foreground">Track orders through the inspection process</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', 'pending', 'confirmed', ...PROCESS_STAGES.map(st => st.key), 'delivered'].map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-all ${filterStatus === status ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {status === 'All' ? 'All' : statusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonRegion label="Loading orders"><SplitContentSkeleton /></SkeletonRegion>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row">
          {/* Orders List */}
          <section className="xl:w-[55%] card-dark rounded-3xl border border-border p-6">
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
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedOrderId === order.id ? 'bg-primary/10' : ''}`}
                      >
                        <td className="px-4 py-4 font-semibold text-foreground">{order.order_ref}</td>
                        <td className="px-4 py-4 text-muted-foreground">{order.customer_name}</td>
                        <td className="px-4 py-4">
                          <StatusBadge
                            variant={statusVariant(order.extended_status || order.status)}
                            label={statusLabel(order.extended_status || order.status)}
                          />
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{order.due_date || '—'}</td>
                        <td className="px-4 py-4 font-semibold text-foreground">${order.amount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Order Details */}
          <aside className="xl:w-[45%] space-y-4">
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
                      <span className="text-foreground font-semibold">${activeOrder.amount?.toLocaleString()}</span>
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
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${activeOrder.completion_pct || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Update Status */}
                <section className="card-dark rounded-3xl border border-border p-6">
                  <h3 className="text-base font-semibold text-foreground mb-4">Update Process Stage</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER_STATUSES.filter(s => s !== 'cancelled').map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateOrderStatus(activeOrder.id, status)}
                        disabled={updating || !canMoveTo(status)}
                        title={GATE_HINTS[nextMoves.find(t => t.to_status === status)?.gate || '']}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                          (activeOrder.extended_status || 'pending') === status
                            ? 'bg-primary text-primary-foreground' :'bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50'
                        }`}
                      >
                        {updating && <Loader2 size={10} className="inline animate-spin mr-1" />}
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
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
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 py-3 text-sm text-danger hover:bg-danger/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <X size={16} /> Cancel Order
                    </button>
                  </div>
                </section>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
