'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DollarSign, Package, Users, Bell, FileText, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const COLORS = ['#7C3AED', '#A78BFA', '#F59E0B', '#22C55E', '#38BDF8'];

export default function AdminDashboardContent() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [ordersRes, defectsRes, usersRes, notifRes, inventoryRes] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('defects').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('user_profiles').select('*').eq('is_active', true),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('inventory').select('*').eq('is_active', true),
      ]);
      setOrders(ordersRes.data || []);
      setDefects(defectsRes.data || []);
      setUsers(usersRes.data || []);
      setNotifications(notifRes.data || []);
      setInventory(inventoryRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  // Compute stats
  const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const inProductionCount = orders.filter((o) => o.status === 'in_production').length;
  const staffCount = users.filter((u) => u.role === 'staff').length;
  const defectRate = orders.length > 0 ? ((defects.length / orders.length) * 100).toFixed(1) : '0.0';

  // Revenue trend (last 6 months - simulated from orders)
  const revenueTrend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => ({
    month,
    value: Math.round(totalRevenue * (0.6 + i * 0.08) / 6),
  }));

  // Product mix from orders
  const productMix = orders.reduce((acc: Record<string, number>, o) => {
    const cat = o.product_category || 'furniture';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const orderMixData = Object.entries(productMix).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const lowStockItems = inventory.filter((i) => i.stock_level < i.min_stock);

  const summaryCards = [
    { label: 'Total Revenue', value: `$${(totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, delta: '+18%', detail: 'All orders combined' },
    { label: 'Orders in Progress', value: inProductionCount.toString(), icon: Package, delta: `${orders.length} total`, detail: 'Currently in production' },
    { label: 'Active Staff', value: staffCount.toString(), icon: Users, delta: `${users.length} total users`, detail: 'Production team' },
    { label: 'Defect Rate', value: `${defectRate}%`, icon: Bell, delta: `${defects.length} defects`, detail: 'Quality score' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.3em] mb-2">Administrator Overview</p>
          <h1 className="text-3xl font-bold text-foreground">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Monitor revenue, orders, production efficiency, and supplier readiness in one premium woodworks management view.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/reports" className="btn-secondary flex items-center gap-2">
            <FileText size={16} /> Export Reports
          </Link>
          <Link href="/real-time-production-dashboard" className="btn-primary flex items-center gap-2">
            <TrendingUp size={16} /> Production Monitor
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const CardIcon = card.icon;
          return (
            <div key={card.label} className="card-dark p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{card.value}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
                </div>
                <div className="rounded-2xl bg-muted p-3 text-primary">
                  <CardIcon size={20} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{card.detail}</span>
                <span className="font-semibold text-foreground">{card.delta}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <p className="text-sm text-warning font-medium">
            {lowStockItems.length} inventory item{lowStockItems.length > 1 ? 's' : ''} below minimum stock level: {lowStockItems.map((i) => i.name).join(', ')}
          </p>
          <Link href="/admin/inventory" className="ml-auto text-xs text-warning font-semibold hover:underline whitespace-nowrap">
            View Inventory →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <section className="xl:col-span-2 card-dark rounded-3xl border border-border p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Revenue Trend</h2>
              <p className="text-sm text-muted-foreground mt-1">Sales performance across the last six months.</p>
            </div>
            <StatusBadge variant="ok" label="Stable Growth" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3' }} />
                <Tooltip contentStyle={{ background: '#1F1F1F', borderColor: '#383838' }} labelStyle={{ color: '#F5F5F5' }} />
                <Area type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={3} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Product Mix */}
        <section className="card-dark rounded-3xl border border-border p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Product Mix</h2>
              <p className="text-sm text-muted-foreground mt-1">Order volume by category.</p>
            </div>
            <span className="text-xs text-muted-foreground">{orders.length} orders</span>
          </div>
          <div className="h-72">
            {orderMixData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No order data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderMixData} innerRadius={58} outerRadius={90} paddingAngle={4} dataKey="value" stroke="transparent">
                    {orderMixData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1F1F1F', borderColor: '#383838' }} labelStyle={{ color: '#F5F5F5' }} />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <section className="xl:col-span-2 card-dark rounded-3xl border border-border p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
              <p className="text-sm text-muted-foreground mt-1">Latest orders and current stage updates.</p>
            </div>
            <Link href="/orders" className="text-xs text-primary hover:text-accent font-medium transition-colors">View all →</Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-4 text-foreground font-semibold">{order.order_ref}</td>
                      <td className="px-4 py-4 text-muted-foreground">{order.customer_name}</td>
                      <td className="px-4 py-4">
                        <StatusBadge
                          variant={order.status === 'pending' ? 'warning' : order.status === 'delivered' ? 'ok' : order.status === 'quality_check' ? 'info' : 'neutral'}
                          label={order.status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        />
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{order.due_date || '—'}</td>
                      <td className="px-4 py-4 text-foreground font-semibold">${order.amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Live Alerts */}
        <section className="card-dark rounded-3xl border border-border p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Live Alerts</h2>
              <p className="text-sm text-muted-foreground mt-1">Quality and logistics notifications.</p>
            </div>
            <Bell size={18} className="text-accent" />
          </div>
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No alerts</p>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                    </div>
                    <StatusBadge
                      variant={notif.notification_type === 'error' ? 'danger' : notif.notification_type === 'warning' ? 'warning' : 'info'}
                      label={notif.notification_type === 'error' ? 'Action' : notif.notification_type === 'warning' ? 'Watch' : 'Info'}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/admin/audit-logs" className="mt-4 block text-center text-xs text-primary hover:text-accent font-medium transition-colors">
            View audit logs →
          </Link>
        </section>
      </div>
    </div>
  );
}
