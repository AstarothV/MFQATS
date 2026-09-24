'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, Ruler, Box, User, Hash, Layers, Loader2, X, Eye, Filter, ArrowRight, CheckCircle2, Clock, Truck, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';

interface AROrder {
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
  quantity: number;
  material: string;
  dimensions: string;
  image_url: string;
  delivery_address: string;
  delivery_city: string;
  pickup_type: string;
  notes: string;
  created_at: string;
  customer?: { full_name: string; email: string; phone: string } | null;
  product?: {
    height_cm: number; width_cm: number; length_cm: number;
    material_type: string; images: any[]; ar_model_support: boolean;
    specifications: any;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', designing: 'Designing',
  material_preparation: 'Material Prep', cutting: 'Cutting', assembly: 'Assembly',
  sanding: 'Sanding', finishing: 'Finishing', quality_inspection: 'Quality Inspection',
  ready_for_delivery: 'Ready for Delivery', delivered: 'Delivered',
  cancelled: 'Cancelled', in_production: 'In Production',
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
  if (['cutting', 'assembly', 'sanding', 'finishing', 'material_preparation', 'designing', 'in_production', 'confirmed'].includes(status)) return 'purple';
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

// AR Preview Component
function ARPreviewPanel({ order }: { order: AROrder }) {
  const [arMode, setArMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const dims = order.product
    ? `${order.product.width_cm}W × ${order.product.height_cm}H × ${order.product.length_cm}D cm`
    : order.dimensions || 'Dimensions not specified';

  const material = order.product?.material_type || order.material || 'Not specified';

  const productImages = order.product?.images || [];
  const mainImage = productImages.length > 0
    ? (typeof productImages[0] === 'string' ? productImages[0] : productImages[0]?.url)
    : order.image_url || null;

  function simulateARLoad() {
    setLoading(true);
    setTimeout(() => { setLoading(false); setArMode(true); }, 1500);
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* AR Viewport */}
      <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 aspect-video flex items-center justify-center overflow-hidden">
        {arMode ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* AR Grid Overlay */}
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {/* Furniture Preview */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={order.product_name}
                  className="max-h-48 max-w-xs object-contain drop-shadow-2xl rounded-xl"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-40 h-40 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-6xl">
                  🪑
                </div>
              )}
              {/* AR Dimension Overlays */}
              <div className="flex gap-3">
                {order.product && (
                  <>
                    <div className="bg-purple-500/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                      W: {order.product.width_cm}cm
                    </div>
                    <div className="bg-violet-500/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                      H: {order.product.height_cm}cm
                    </div>
                    <div className="bg-indigo-500/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                      D: {order.product.length_cm}cm
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* AR Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-purple-500/90 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-bold text-white">AR Preview</span>
            </div>
            <button
              type="button"
              onClick={() => setArMode(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center px-6">
            {mainImage ? (
              <img
                src={mainImage}
                alt={order.product_name}
                className="max-h-36 max-w-xs object-contain opacity-60 rounded-xl"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="text-6xl opacity-50">🪑</div>
            )}
            <div>
              <p className="text-white/80 text-sm font-semibold">{order.product_name}</p>
              <p className="text-white/50 text-xs mt-1">Click to launch AR preview</p>
            </div>
            <button
              type="button"
              onClick={simulateARLoad}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-70"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Loading AR...</>
              ) : (
                <><Eye size={14} /> Launch AR View</>
              )}
            </button>
            {!order.product?.ar_model_support && (
              <p className="text-white/40 text-xs">Image-based preview (3D model not available)</p>
            )}
          </div>
        )}
      </div>

      {/* Furniture Details */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{order.product_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{order.product_category}</p>
          </div>
          <StatusBadge
            variant={getStatusVariant(order.extended_status || order.status)}
            label={STATUS_LABELS[order.extended_status || order.status] || order.status}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Ruler size={12} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Dimensions</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{dims}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers size={12} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Material</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{material}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Hash size={12} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Price</p>
            </div>
            <p className="text-sm font-semibold text-foreground">${order.amount?.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Box size={12} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Quantity</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{order.quantity || 1}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffARVisualizationContent() {
  const { user } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<AROrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<AROrder | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customer_id(full_name, email, phone), product:product_id(height_cm, width_cm, length_cm, material_type, images, ar_model_support, specifications)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setOrders(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('ar_orders_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredOrders = orders.filter(o => {
    const matchSearch = o.order_ref?.toLowerCase().includes(search.toLowerCase()) ||
      o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || (o.extended_status || o.status) === filterStatus;
    return matchSearch && matchStatus;
  });

  function openARView(order: AROrder) {
    setSelectedOrder(order);
    setShowModal(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Staff Tool</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AR Visualization</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            View furniture in AR with full order and customer details
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orders, products, customers..."
            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map(order => {
            const st = order.extended_status || order.status;
            const stageIdx = getStageIndex(st);
            const productImages = order.product?.images || [];
            const mainImage = productImages.length > 0
              ? (typeof productImages[0] === 'string' ? productImages[0] : productImages[0]?.url)
              : order.image_url || null;

            return (
              <div key={order.id} className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all duration-200">
                {/* Image / Preview */}
                <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 aspect-video flex items-center justify-center">
                  {mainImage ? (
                    <img
                      src={mainImage}
                      alt={order.product_name}
                      className="max-h-32 max-w-full object-contain p-4"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-5xl">🪑</span>
                  )}
                  <div className="absolute top-2 right-2">
                    <StatusBadge variant={getStatusVariant(st)} label={STATUS_LABELS[st] || st} />
                  </div>
                  {order.queue_position && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                      <span className="text-xs font-bold text-white">Queue #{order.queue_position}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{order.product_name}</h3>
                    <p className="text-xs text-muted-foreground">#{order.order_ref}</p>
                  </div>

                  {/* Customer */}
                  {order.customer && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User size={11} />
                      <span>{order.customer.full_name}</span>
                    </div>
                  )}

                  {/* Dimensions */}
                  {order.product && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Ruler size={11} />
                      <span>{order.product.width_cm}W × {order.product.height_cm}H × {order.product.length_cm}D cm</span>
                    </div>
                  )}

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span className="font-semibold">{order.completion_pct || 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500"
                        style={{ width: `${order.completion_pct || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openARView(order)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-semibold hover:bg-primary/90 transition-all"
                    >
                      <Eye size={12} /> AR View
                    </button>
                    <Link
                      href="/staff-dashboard/orders"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                    >
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AR Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">AR Visualization</h2>
                <p className="text-xs text-muted-foreground mt-0.5">#{selectedOrder.order_ref} · {selectedOrder.product_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* AR Preview */}
              <ARPreviewPanel order={selectedOrder} />

              {/* Order & Customer Details */}
              <div className="space-y-4">
                {/* Customer Info */}
                {selectedOrder.customer && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Customer</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold text-foreground">{selectedOrder.customer.full_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-5">{selectedOrder.customer.email}</p>
                      {selectedOrder.customer.phone && (
                        <p className="text-xs text-muted-foreground pl-5">{selectedOrder.customer.phone}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Details */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Order Details</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Order Ref', value: `#${selectedOrder.order_ref}` },
                      { label: 'Status', value: STATUS_LABELS[selectedOrder.extended_status || selectedOrder.status] || selectedOrder.status },
                      { label: 'Queue Position', value: selectedOrder.queue_position ? `#${selectedOrder.queue_position}` : '—' },
                      { label: 'Order Date', value: new Date(selectedOrder.created_at).toLocaleDateString() },
                      { label: 'Due Date', value: selectedOrder.due_date || 'TBD' },
                      { label: 'Quantity', value: selectedOrder.quantity || 1 },
                      { label: 'Price', value: `$${selectedOrder.amount?.toLocaleString()}` },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-semibold text-foreground text-right">{String(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Info */}
                {selectedOrder.delivery_address && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Delivery</p>
                    <p className="text-sm text-foreground">
                      {selectedOrder.delivery_address}{selectedOrder.delivery_city ? `, ${selectedOrder.delivery_city}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{selectedOrder.pickup_type || 'Delivery'}</p>
                  </div>
                )}

                {/* Queue Progress */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Queue Progress</p>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {QUEUE_STAGES.map((stage, idx) => {
                      const stageIdx = getStageIndex(selectedOrder.extended_status || selectedOrder.status);
                      const StageIcon = stage.icon;
                      const isDone = idx < stageIdx;
                      const isActive = idx === stageIdx;
                      return (
                        <React.Fragment key={stage.key}>
                          <div className={`flex flex-col items-center gap-1 shrink-0 ${isActive ? 'opacity-100' : isDone ? 'opacity-100' : 'opacity-30'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                              isDone ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/40' : isActive ?'bg-purple-50 border-purple-300 dark:bg-purple-500/15 dark:border-purple-500/40': 'bg-muted border-border'
                            }`}>
                              <StageIcon size={12} className={isDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-purple-600 dark:text-purple-300' : 'text-muted-foreground'} />
                            </div>
                            <span className="text-2xs text-muted-foreground whitespace-nowrap hidden sm:block">{stage.label}</span>
                          </div>
                          {idx < QUEUE_STAGES.length - 1 && (
                            <div className={`flex-1 h-0.5 min-w-[8px] ${idx < stageIdx ? 'bg-emerald-400' : 'bg-border'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Link
                    href="/staff-dashboard/orders"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-all"
                  >
                    Open Order <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
