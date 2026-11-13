'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Clock, CheckCircle2, Truck, Loader2, ChevronRight, TrendingUp, ShoppingBag, MessageSquare, Eye, Upload, Box, FileText, Armchair } from 'lucide-react';
import { statusLabel, statusVariant } from '@/lib/orders';
import { stageDot, stageRank, STAGE_HINT } from '@/lib/orderGroups';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { dataUserId } from '@/lib/viewer';
import { readPageCache, writePageCache } from '@/lib/pageCache';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import CancelOrderButton from '@/components/CancelOrderButton';
import { furnitureLabel } from '@/lib/pieces';
import { CustomerOverviewSkeleton as PageSkeleton } from '@/components/ui/LoadingSkeleton';

import { peso } from '@/lib/money';
import { PAYMENT_LABEL, type PaymentMethod } from '@/lib/delivery';
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
  payment_method: PaymentMethod | null;
  delivery_fee: number | null;
  delivery_km: number | null;
  quantity: number;
  material: string;
  dimensions: string;
  image_url: string;
  delivery_address: string;
  delivery_city: string;
  created_at: string;
  updated_at: string;
}

// order statuses shown as a stepper: approval, the five process stages, delivery
const QUEUE_STAGES = [
  { key: 'pending', icon: Clock },
  { key: 'confirmed', icon: CheckCircle2 },
  { key: 'upload', icon: Upload },
  { key: 'reconstruction_3d', icon: Box },
  { key: 'detect_defects', icon: Eye },
  { key: 'results', icon: FileText },
  { key: 'recommendation', icon: TrendingUp },
  { key: 'delivered', icon: Truck },
].map((st) => ({ ...st, label: statusLabel(st.key) }));

// -1 for cancelled (nothing highlighted)
const getStageIndex = (status: string) => QUEUE_STAGES.findIndex((st) => st.key === status);

const duration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'under 1 min';
  return m < 60 ? `${m}m` : m < 2880 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.round(m / 1440)}d`;
};
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function CustomerOverviewContent() {
  const { user } = useAuth();
  const supabase = createClient();
  // Revisits show the last orders immediately; fetchOrders still runs on mount.
  const [cached] = useState(() => readPageCache<Order[]>(user?.id, 'customer-orders'));
  const [orders, setOrders] = useState<Order[]>(cached ?? []);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(cached?.[0] ?? null);
  const [loading, setLoading] = useState(!cached);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  // when the order entered and left each stage (the database records it), for the times under the stepper
  const [stageTimes, setStageTimes] = useState<{ status: string; entered_at: string; left_at: string | null }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const [logsLoading, setLogsLoading] = useState(false);
  const [page, setPage] = useState(0); // Your orders: 5 per page

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', dataUserId(user))
      .order('created_at', { ascending: false });
    if (data) {
      setOrders(data);
      writePageCache(user.id, 'customer-orders', data);
      // Keep the current selection but swap in its fresh row (it may have come from the cache).
      setSelectedOrder((prev) => (prev && data.find((o: Order) => o.id === prev.id)) || prev || data[0] || null);
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
        filter: `customer_id=eq.${dataUserId(user)}`,
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

  useEffect(() => {
    if (!selectedOrder) return;
    supabase.from('order_stage_history').select('status, entered_at, left_at').eq('order_id', selectedOrder.id).order('entered_at')
      .then(({ data }) => setStageTimes(data ?? []));
  }, [selectedOrder?.id, selectedOrder?.extended_status, supabase]);

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  const activeStatus = selectedOrder?.extended_status || selectedOrder?.status || 'pending';
  const stageIdx = getStageIndex(activeStatus);
  const completionPct = selectedOrder?.completion_pct || 0;
  const PER_PAGE = 5;
  const pages = Math.max(1, Math.ceil(orders.length / PER_PAGE));
  const at = Math.min(page, pages - 1);
  const stageOf = (o: Order) => o.extended_status || o.status;
  const sorted = [...orders].sort((a, b) => stageRank(stageOf(a)) - stageRank(stageOf(b))); // stable: newest first within a stage
  const pageOrders = sorted.slice(at * PER_PAGE, at * PER_PAGE + PER_PAGE);
  const inStage = (st: string) => orders.filter((o) => stageOf(o) === st).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow">Your account</p>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
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
        <>
          {selectedOrder && (
            <>
              {/* Order Header */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 text-muted-foreground"><Armchair size={28} aria-hidden="true" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        {furnitureLabel(selectedOrder as any)}
                      </h2>
                      <p className="text-sm text-muted-foreground">Order #{selectedOrder.order_ref}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Placed {new Date(selectedOrder.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge
                      variant={statusVariant(activeStatus)}
                      label={statusLabel(activeStatus)}
                      dot
                    />
                    <CancelOrderButton order={selectedOrder} onCancelled={fetchOrders} />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Process Progress</span>
                    <span className="font-bold text-foreground">{completionPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500 transition-[width] duration-700"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Stage Progress */}
                <div className="flex flex-col xl:flex-row xl:items-start xl:gap-1">
                  {QUEUE_STAGES.map((stage, idx) => {
                    const StageIcon = stage.icon;
                    const isDone = idx < stageIdx;
                    const isActive = idx === stageIdx;
                    // time spent in the stage (all its visits, e.g. after a rework) and when it last finished
                    const visits = stageTimes.filter((h) => h.status === stage.key);
                    const spent = visits.reduce((ms, h) => ms + ((h.left_at ? Date.parse(h.left_at) : now) - Date.parse(h.entered_at)), 0);
                    const finished = visits.at(-1)?.left_at;
                    return (
                      <React.Fragment key={stage.key}>
                        <div className={`flex items-center gap-3 xl:min-w-0 xl:flex-1 xl:basis-0 xl:flex-col xl:gap-1.5 xl:text-center ${isActive ? 'opacity-100' : isDone ? 'opacity-100' : 'opacity-40'}`}>
                          <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center border ${
                            isDone ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40' : isActive ?'bg-purple-50 border-purple-300 dark:bg-purple-500/15 dark:border-purple-500/40': 'bg-muted border-border'
                          }`}>
                            <StageIcon size={15} className={isDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-purple-600 dark:text-purple-300' : 'text-muted-foreground'} />
                          </div>
                          <div className="min-w-0 flex-1 xl:flex-none">
                          <span className={`block text-xs font-semibold leading-tight xl:flex xl:h-8 xl:items-center xl:justify-center ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{stage.label}</span>
                          {visits.length > 0 && stage.key !== 'delivered' && (
                            <span className={`block text-xs leading-5 tabular-nums ${isActive ? 'font-semibold text-purple-600 dark:text-purple-300' : 'text-foreground/80'}`}>
                              {isActive ? `${duration(spent)} so far` : duration(spent)}
                              {!isActive && finished && <span className="block text-2xs leading-4 text-muted-foreground">{when(finished)}</span>}
                            </span>
                          )}
                          {stage.key === 'delivered' && visits[0] && (
                            <span className="block text-2xs leading-4 text-muted-foreground xl:mt-5">{when(visits[0].entered_at)}</span>
                          )}
                          </div>
                        </div>
                        {idx < QUEUE_STAGES.length - 1 && (
                          <div className={`ml-[17px] h-4 w-0.5 shrink-0 xl:ml-0 xl:mt-[17px] xl:h-0.5 xl:w-3 ${idx < stageIdx ? 'bg-emerald-400' : 'bg-border'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

            </>
          )}
        <div className="flex flex-col gap-5 xl:flex-row">
          {/* Orders List */}
          <div className="xl:w-[38%] space-y-2">
            <h2 className="px-1 mb-3 text-base font-semibold text-foreground">Your orders</h2>
            {pageOrders.map((order, i) => {
              const isSelected = selectedOrder?.id === order.id;
              const st = stageOf(order);
              const done = st === 'delivered';
              const header = i === 0 || stageOf(pageOrders[i - 1]) !== st;
              return (
                <React.Fragment key={order.id}>
                {header && (
                  <p className={`flex items-center gap-2 px-1 ${i === 0 ? 'pt-0' : 'pt-3'} text-xs font-semibold uppercase tracking-wider ${done ? 'text-success' : 'text-muted-foreground'}`}>
                    <span className={`h-2 w-2 rounded-full ${stageDot(st)}`} aria-hidden="true" />
                    {statusLabel(st)}
                    {STAGE_HINT[st] && <span className="font-normal normal-case tracking-normal">· {STAGE_HINT[st]}</span>}
                    <span className="ml-auto font-normal">{inStage(st)}</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left rounded-2xl border p-4 transition duration-150 ${
                    isSelected
                      ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        <Armchair size={18} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{furnitureLabel(order as any)}</p>
                        <p className="text-xs text-muted-foreground">#{order.order_ref}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {done ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 size={14} aria-hidden="true" /> Done</span>
                      ) : st === 'cancelled' ? (
                        <StatusBadge variant={statusVariant(st)} label={statusLabel(st)} />
                      ) : order.queue_position ? (
                        <span className="text-xs text-muted-foreground">Queue #{order.queue_position}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span className="font-semibold">{order.completion_pct || 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${done ? 'bg-success' : 'bg-gradient-to-r from-purple-600 to-violet-500'}`}
                        style={{ width: `${order.completion_pct || 0}%` }}
                      />
                    </div>
                  </div>
                </button>
                </React.Fragment>
              );
            })}
            {pages > 1 && (
              <nav aria-label="Pages of your orders" className="flex items-center justify-between gap-2 px-1 pt-1">
                <button type="button" onClick={() => setPage(at - 1)} disabled={at === 0} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Previous</button>
                <span className="text-xs text-muted-foreground">
                  {at * PER_PAGE + 1}–{Math.min(orders.length, (at + 1) * PER_PAGE)} of {orders.length}
                </span>
                <button type="button" onClick={() => setPage(at + 1)} disabled={at >= pages - 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
              </nav>
            )}
          </div>

          {/* Detail Panel */}
          {selectedOrder && (
            <div className="xl:flex-1 space-y-4">
              {/* Order Details Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Order Value</p>
                  <p className="text-base font-bold text-foreground">{peso(Number(selectedOrder.amount) + Number(selectedOrder.delivery_fee ?? 0))}</p>
                  {Number(selectedOrder.delivery_fee) > 0 && <p className="text-[11px] text-muted-foreground">incl. {peso(Number(selectedOrder.delivery_fee))} delivery</p>}
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
                  <p className="text-sm font-semibold text-foreground">{selectedOrder.payment_status === 'paid' ? 'Paid' : 'Not paid yet'}</p>
                  {selectedOrder.payment_method && <p className="text-[11px] text-muted-foreground">{PAYMENT_LABEL[selectedOrder.payment_method]}</p>}
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                  <p className="text-base font-bold text-foreground">{selectedOrder.quantity || 1}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Delivery Method</p>
                  <p className="text-sm font-semibold text-foreground">{selectedOrder.pickup_type === 'pickup' ? 'Pick-up at the shop' : 'Delivery'}</p>
                  {selectedOrder.pickup_type !== 'pickup' && selectedOrder.delivery_km != null && <p className="text-[11px] text-muted-foreground">{selectedOrder.delivery_km} km from the shop</p>}
                </div>
              </div>

              {/* Delivery Info */}
              {selectedOrder.delivery_address && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{selectedOrder.pickup_type === 'pickup' ? 'Pick-up Address' : 'Delivery Address'}</p>
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
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted transition"
                >
                  <Package size={15} /> View Full Order
                </Link>
                <Link
                  href="/customer-dashboard/inquiry"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition"
                >
                  <MessageSquare size={15} /> Send Inquiry
                </Link>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
