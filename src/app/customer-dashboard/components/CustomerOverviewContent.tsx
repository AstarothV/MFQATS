'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Clock, CheckCircle2, Truck, Loader2, ChevronRight, TrendingUp, ShoppingBag, MessageSquare, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';

interface Order {
  id: string;
  order_ref: string;
  product_name: string;
  product_category: string;
  amount: number;
  status: string;
  extended_status: string;
  current_stage: string;
  completion_pct: number;
  due_date: string;
  queue_position: number | null;
  payment_status: string;
  pickup_type: string;
  quantity: number;
  material: string;
  dimensions: string;
  image_url: string;
  delivery_address: string;
  delivery_city: string;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  designing: 'Designing',
  material_preparation: 'Material Prep',
  cutting: 'Cutting',
  assembly: 'Assembly',
  sanding: 'Sanding',
  finishing: 'Finishing',
  quality_inspection: 'Quality Inspection',
  ready_for_delivery: 'Ready for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  in_production: 'In Production',
};

const QUEUE_STAGES = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'in_production', label: 'In Production', icon: TrendingUp },
  { key: 'quality_inspection', label: 'Quality Check', icon: Eye },
  { key: 'ready_for_delivery', label: 'Ready', icon: Package },
  { key: 'delivered', label: 'Delivered', icon: Truck },
];

function getStatusVariant(status: string): 'ok' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' {
  if (status === 'delivered') return 'ok';
  if (status === 'cancelled') return 'danger';
  if (status === 'quality_inspection' || status === 'ready_for_delivery') return 'info';
  if (status === 'pending') return 'warning';
  if (['cutting', 'assembly', 'sanding', 'finishing', 'material_preparation', 'designing', 'in_production'].includes(status)) return 'purple';
  return 'neutral';
}

function getStageIndex(status: string): number {
  const map: Record<string, number> = {
    pending: 0, confirmed: 1, designing: 2, material_preparation: 2,
    cutting: 2, assembly: 2, sanding: 2, finishing: 2, in_production: 2,
    quality_inspection: 3, ready_for_delivery: 4, delivered: 5, cancelled: -1,
  };
  return map[status] ?? 0;
}

export default function CustomerOverviewContent() {
  const { user } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setOrders(data);
      if (!selectedOrder && data.length > 0) setSelectedOrder(data[0]);
    }
    setLoading(false);
  }, [user, supabase, selectedOrder]);

  useEffect(() => {
    fetchOrders();
    if (!user) return;
    const channel = supabase
      .channel('overview_orders')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } as Order : o));
        setSelectedOrder(prev => prev?.id === payload.new.id ? { ...prev, ...payload.new } as Order : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!selectedOrder) return;
    const fetchLogs = async () => {
      setLogsLoading(true);
      const { data } = await supabase
        .from('order_history_logs')
        .select('*')
        .eq('order_id', selectedOrder.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setHistoryLogs(data || []);
      setLogsLoading(false);
    };
    fetchLogs();
  }, [selectedOrder?.id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
      </div>
    );
  }

  const activeStatus = selectedOrder?.extended_status || selectedOrder?.status || 'pending';
  const stageIdx = getStageIndex(activeStatus);
  const completionPct = selectedOrder?.completion_pct || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {orders.length > 0 ? `${orders.length} order${orders.length !== 1 ? 's' : ''} found` : 'No orders yet'}
          </p>
        </div>
        <Link href="/customer-dashboard/shop" className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
          <ShoppingBag size={15} /> Shop Products
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-purple-600 dark:text-purple-300" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No orders yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your orders will appear here once placed</p>
          <Link href="/customer-dashboard/shop" className="btn-primary inline-flex items-center gap-2 mt-4">
            <ShoppingBag size={15} /> Browse Products
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5 xl:flex-row">
          {/* Orders List */}
          <div className="xl:w-[38%] space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-3">Your Orders</p>
            {orders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const st = order.extended_status || order.status;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-150 ${
                    isSelected
                      ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 text-lg">
                        🪑
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{order.product_name}</p>
                        <p className="text-xs text-muted-foreground">#{order.order_ref}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge variant={getStatusVariant(st)} label={STATUS_LABELS[st] || st} />
                      {order.queue_position && (
                        <span className="text-xs text-muted-foreground">Queue #{order.queue_position}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span className="font-semibold">{order.completion_pct || 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all duration-500"
                        style={{ width: `${order.completion_pct || 0}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail Panel */}
          {selectedOrder && (
            <div className="xl:flex-1 space-y-4">
              {/* Order Header */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-3xl shrink-0">🪑</div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selectedOrder.product_name}</h2>
                      <p className="text-sm text-muted-foreground">Order #{selectedOrder.order_ref}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Placed {new Date(selectedOrder.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    variant={getStatusVariant(activeStatus)}
                    label={STATUS_LABELS[activeStatus] || activeStatus}
                    dot
                  />
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Production Progress</span>
                    <span className="font-bold text-foreground">{completionPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all duration-700"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Stage Progress */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {QUEUE_STAGES.map((stage, idx) => {
                    const StageIcon = stage.icon;
                    const isDone = idx < stageIdx;
                    const isActive = idx === stageIdx;
                    return (
                      <React.Fragment key={stage.key}>
                        <div className={`flex flex-col items-center gap-1 shrink-0 ${isActive ? 'opacity-100' : isDone ? 'opacity-100' : 'opacity-40'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                            isDone ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40' : isActive ?'bg-purple-50 border-purple-300 dark:bg-purple-500/15 dark:border-purple-500/40': 'bg-muted border-border'
                          }`}>
                            <StageIcon size={14} className={isDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-purple-600 dark:text-purple-300' : 'text-muted-foreground'} />
                          </div>
                          <span className="text-2xs text-muted-foreground whitespace-nowrap hidden sm:block">{stage.label}</span>
                        </div>
                        {idx < QUEUE_STAGES.length - 1 && (
                          <div className={`flex-1 h-0.5 min-w-[12px] ${idx < stageIdx ? 'bg-emerald-400' : 'bg-border'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Order Details Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Order Value</p>
                  <p className="text-base font-bold text-foreground">${selectedOrder.amount?.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Queue Position</p>
                  <p className="text-base font-bold text-foreground">
                    {selectedOrder.queue_position ? `#${selectedOrder.queue_position}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                  <p className="text-base font-bold text-foreground">{selectedOrder.due_date || 'TBD'}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Payment</p>
                  <p className="text-sm font-semibold text-foreground capitalize">{selectedOrder.payment_status || 'Pending'}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                  <p className="text-base font-bold text-foreground">{selectedOrder.quantity || 1}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Delivery</p>
                  <p className="text-sm font-semibold text-foreground capitalize">{selectedOrder.pickup_type || 'Delivery'}</p>
                </div>
              </div>

              {/* Delivery Info */}
              {selectedOrder.delivery_address && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Address</p>
                  <p className="text-sm text-foreground">{selectedOrder.delivery_address}{selectedOrder.delivery_city ? `, ${selectedOrder.delivery_city}` : ''}</p>
                </div>
              )}

              {/* Recent History */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
                  <Link
                    href="/customer-dashboard/order-view"
                    className="text-xs text-accent hover:text-primary font-medium flex items-center gap-1"
                  >
                    View full history <ChevronRight size={12} />
                  </Link>
                </div>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={18} className="animate-spin text-muted-foreground" />
                  </div>
                ) : historyLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {historyLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{log.title}</p>
                          {log.description && <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>}
                          <p className="text-2xs text-muted-foreground/60 mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/customer-dashboard/order-view"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted transition-all"
                >
                  <Package size={15} /> View Full Order
                </Link>
                <Link
                  href="/customer-dashboard/inquiry"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-all"
                >
                  <MessageSquare size={15} /> Send Inquiry
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
