'use client';

import React, { useState, useEffect } from 'react';
import OrderStatusTimeline from './OrderStatusTimeline';
import PhotoGallery from './PhotoGallery';
import ProductDetail3D from './ProductDetail3D';
import InquirySystem from '@/components/ui/InquirySystem';
import { Package, Image, Box, Loader2, MessageSquare, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

type Tab = 'timeline' | 'gallery' | 'product' | 'inquiry';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'timeline', label: 'Order Queue', icon: Package },
  { key: 'gallery', label: 'Photo Gallery', icon: Image },
  { key: 'product', label: '3D Preview & AR', icon: Box },
  { key: 'inquiry', label: 'Inquiry', icon: MessageSquare },
];

export default function CustomerDashboardContent() {
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const { user } = useAuth();
  const supabase = createClient();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setOrder(data);
      setLoading(false);
    };
    fetchOrder();

    // Real-time order updates
    if (!user) return;
    const channel = supabase
      .channel('customer_order_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, (payload) => {
        setOrder(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-purple-600 dark:text-purple-300" />
      </div>
    );
  }

  const statusLabel = order?.extended_status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ||
    order?.status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Pending';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order Queue</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {order ? `Latest: #${order.order_ref} · ${order.product_name}` : 'No active orders found'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {order && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-100">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              {statusLabel}
            </span>
          )}
          <Link href="/customer-dashboard/shop" className="btn-primary flex items-center gap-2 text-sm">
            <ShoppingBag size={15} /> Shop
          </Link>
        </div>
      </div>

      {!order ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <Package size={32} className="mx-auto mb-3 text-purple-600 dark:text-purple-300" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No orders found</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your orders will appear here once placed</p>
          <Link href="/customer-dashboard/shop" className="btn-primary inline-flex items-center gap-2 mt-4">
            <ShoppingBag size={15} /> Browse Products
          </Link>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 sm:flex-row">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150 ${
                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <TabIcon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'timeline' && <OrderStatusTimeline order={order} />}
          {activeTab === 'gallery' && <PhotoGallery orderId={order.id} />}
          {activeTab === 'product' && <ProductDetail3D order={order} />}
          {activeTab === 'inquiry' && <InquirySystem userRole="customer" />}
        </>
      )}
    </div>
  );
}
