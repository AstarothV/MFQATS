'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, ChevronDown, ChevronUp, Loader2, Clock, CheckCircle2, Truck, AlertCircle, TrendingUp, Eye, X, FileText, Image, Box, MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';
import PhotoGallery from './PhotoGallery';
import ProductDetail3D from './ProductDetail3D';
import OrderStatusTimeline from './OrderStatusTimeline';
import Icon from '@/components/ui/AppIcon';


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
  delivery_address: string;
  delivery_city: string;
  delivery_phone: string;
  customization_notes: string;
  notes: string;
  created_at: string;
  updated_at: string;
  product_id?: string;
}

interface HistoryLog {
  id: string;
  event_type: string;
  title: string;
  description: string;
  old_status: string;
  new_status: string;
  queue_position: number | null;
  created_at: string;
}

type TabKey = 'queue' | 'gallery' | '3d' | 'inquiry';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', designing: 'Designing',
  material_preparation: 'Material Prep', cutting: 'Cutting', assembly: 'Assembly',
  sanding: 'Sanding', finishing: 'Finishing', quality_inspection: 'Quality Inspection',
  ready_for_delivery: 'Ready for Delivery', delivered: 'Delivered',
  cancelled: 'Cancelled', in_production: 'In Production',
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  order_created: Package, order_confirmed: CheckCircle2, queue_moved: TrendingUp,
  production_started: TrendingUp, stage_completed: CheckCircle2, quality_check: Eye,
  production_completed: CheckCircle2, ready_for_delivery: Package,
  delivered: Truck, cancelled: X, status_updated: Clock, note_added: FileText,
};

function getStatusVariant(status: string): 'ok' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' {
  if (status === 'delivered') return 'ok';
  if (status === 'cancelled') return 'danger';
  if (status === 'quality_inspection' || status === 'ready_for_delivery') return 'info';
  if (status === 'pending') return 'warning';
  if (['cutting', 'assembly', 'sanding', 'finishing', 'material_preparation', 'designing', 'in_production', 'confirmed'].includes(status)) return 'purple';
  return 'neutral';
}

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'queue', label: 'Order Queue', icon: Package },
  { key: 'gallery', label: 'Photo Gallery', icon: Image },
  { key: '3d', label: '3D Preview & AR', icon: Box },
  { key: 'inquiry', label: 'Inquiry', icon: MessageSquare },
];

export default function OrderViewContent() {
  const { user } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('queue');
  const [historyLogs, setHistoryLogs] = useState<Record<string, HistoryLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<Record<string, boolean>>({});
  const [showOrderList, setShowOrderList] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setOrders(data);
      // Auto-select first order if none selected
      if (!selectedOrderId && data.length > 0) {
        setSelectedOrderId(data[0].id);
      }
    }
    setLoading(false);
  }, [user, supabase, selectedOrderId]);

  useEffect(() => {
    fetchOrders();
    if (!user) return;
    const channel = supabase
      .channel('order_view_updates')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchHistoryLogs = async (orderId: string) => {
    if (historyLogs[orderId]) return;
    setLogsLoading(prev => ({ ...prev, [orderId]: true }));
    const { data } = await supabase
      .from('order_history_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    setHistoryLogs(prev => ({ ...prev, [orderId]: data || [] }));
    setLogsLoading(prev => ({ ...prev, [orderId]: false }));
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowOrderList(false);
    // Pre-fetch logs for the selected order
    fetchHistoryLogs(orderId);
  };

  const filteredOrders = orders.filter(o =>
    o.order_ref?.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order History</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Track your furniture orders</p>
        </div>
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Your orders will appear here once placed</p>
        </div>
      </div>
    );
  }

  const st = selectedOrder ? (selectedOrder.extended_status || selectedOrder.status) : '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order History</h1>
          {selectedOrder && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Latest: #{selectedOrder.order_ref} · {selectedOrder.product_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedOrder && (
            <div className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-200">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              {STATUS_LABELS[st] || st || 'Pending'}
            </div>
          )}
          <Link
            href="/customer-dashboard/shop"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all"
          >
            🛍 Shop
          </Link>
        </div>
      </div>

      {/* Order Selector */}
      {orders.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowOrderList(v => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">🪑</div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {selectedOrder?.product_name || 'Select an order'}
                </p>
                <p className="text-xs text-muted-foreground">
                  #{selectedOrder?.order_ref} · {orders.length} order{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {showOrderList ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
          </button>

          {showOrderList && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search orders..."
                    className="w-full rounded-lg border border-border bg-muted pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredOrders.map(order => {
                  const orderSt = order.extended_status || order.status;
                  const isSelected = order.id === selectedOrderId;
                  return (
                    <button
                      key={order.id}
                      onClick={() => handleSelectOrder(order.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/10' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">🪑</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{order.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">#{order.order_ref}</p>
                      </div>
                      <StatusBadge variant={getStatusVariant(orderSt)} label={STATUS_LABELS[orderSt] || orderSt} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="rounded-2xl border border-border bg-card p-1.5">
        <div className="grid grid-cols-4 gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content — all driven by selectedOrder */}
      {activeTab === 'queue' && (
        <OrderStatusTimeline order={selectedOrder} />
      )}

      {activeTab === 'gallery' && (
        <PhotoGallery orderId={selectedOrder?.id} />
      )}

      {activeTab === '3d' && (
        <ProductDetail3D order={selectedOrder} />
      )}

      {activeTab === 'inquiry' && (
        <div className="space-y-4">
          {/* Inquiry shortcut card */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <MessageSquare size={22} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">Order Inquiry</h3>
                {selectedOrder && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Ask about <strong>{selectedOrder.product_name}</strong> (#{selectedOrder.order_ref})
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Our team typically responds within 24 hours
                </p>
              </div>
            </div>

            {selectedOrder && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Order Ref', value: `#${selectedOrder.order_ref}` },
                  { label: 'Status', value: STATUS_LABELS[st] || st || 'Pending' },
                  { label: 'Queue', value: selectedOrder.queue_position ? `#${selectedOrder.queue_position}` : '—' },
                  { label: 'Progress', value: `${selectedOrder.completion_pct || 0}%` },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-muted/50 p-2.5">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Link
                href="/customer-dashboard/inquiry"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all active:scale-95"
              >
                <MessageSquare size={15} /> Open Inquiry Center
              </Link>
              <Link
                href="/customer-dashboard/inquiry"
                className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-all"
              >
                <AlertCircle size={15} /> New Inquiry
              </Link>
            </div>
          </div>

          {/* Order History Logs */}
          {selectedOrder && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Order Activity Log</h3>
              {logsLoading[selectedOrder.id] ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-muted-foreground" />
                </div>
              ) : (historyLogs[selectedOrder.id] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-muted/30">
                  No activity events yet
                </p>
              ) : (
                <div className="space-y-0">
                  {(historyLogs[selectedOrder.id] || []).map((log, idx) => {
                    const EventIcon = EVENT_ICONS[log.event_type] || Clock;
                    const isLast = idx === (historyLogs[selectedOrder.id] || []).length - 1;
                    return (
                      <div key={log.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200 dark:bg-purple-500/15 dark:border-purple-500/30 flex items-center justify-center shrink-0">
                            <EventIcon size={13} className="text-purple-600 dark:text-purple-300" />
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-border my-1 min-h-[16px]" />}
                        </div>
                        <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                          <p className="text-xs font-semibold text-foreground">{log.title}</p>
                          {log.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                          )}
                          {log.new_status && (
                            <span className="inline-block mt-1 text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                              → {STATUS_LABELS[log.new_status] || log.new_status}
                            </span>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
