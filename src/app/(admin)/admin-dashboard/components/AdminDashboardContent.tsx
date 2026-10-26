'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, CartesianGrid, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { PhilippinePeso, Package, Users, Bell, FileText, TrendingUp, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { PageSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { readPageCache, writePageCache } from '@/lib/pageCache';
import { isProcessStage, statusLabel, statusVariant } from '@/lib/orders';
import { defectRate, fetchInspectionCounts } from '@/lib/inspections';
import { peso, pesoShort } from '@/lib/money';
import Link from 'next/link';

const COLORS = ['#7C3AED', '#A78BFA', '#F59E0B', '#22C55E', '#38BDF8'];
const SHOW_MONEY_KEY = 'mfqats-show-money';
const HIDDEN = '••••';

export default function AdminDashboardContent() {
  const supabase = createClient();
  const { user } = useAuth();
  // Revisits show the last data immediately; the effect below still refetches.
  const [cached] = useState(() => readPageCache<Record<string, any[]>>(user?.id, 'admin-dashboard'));
  const [loading, setLoading] = useState(!cached);
  const [orders, setOrders] = useState<any[]>(cached?.orders ?? []);
  const [users, setUsers] = useState<any[]>(cached?.users ?? []);
  const [notifications, setNotifications] = useState<any[]>(cached?.notifications ?? []);
  const [inventory, setInventory] = useState<any[]>(cached?.inventory ?? []);
  const [inspections, setInspections] = useState<{ failed: number; total: number }>(cached?.inspections?.[0] ?? { failed: 0, total: 0 });
  // Money is hidden until shown (someone may be looking at the screen); the choice is remembered on this browser.
  const [showMoney, setShowMoney] = useState(false);
  useEffect(() => {
    try { setShowMoney(localStorage.getItem(SHOW_MONEY_KEY) === '1'); } catch { /* storage blocked: stay hidden */ }
  }, []);
  function toggleMoney() {
    setShowMoney((v) => {
      try { localStorage.setItem(SHOW_MONEY_KEY, v ? '0' : '1'); } catch { /* storage blocked */ }
      return !v;
    });
  }
  const money = (text: string) => (showMoney ? text : HIDDEN);

  useEffect(() => {
    const fetchData = async () => {
      const [ordersRes, usersRes, notifRes, inventoryRes, counts] = await Promise.all([
        // ponytail: every order is loaded for the totals; switch the sums to a SQL view if orders reach the thousands
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').eq('is_active', true),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('inventory').select('*').eq('is_active', true),
        fetchInspectionCounts(supabase),
      ]);
      setOrders(ordersRes.data || []);
      setUsers(usersRes.data || []);
      setNotifications(notifRes.data || []);
      setInventory(inventoryRes.data || []);
      setInspections(counts);
      writePageCache(user?.id, 'admin-dashboard', {
        orders: ordersRes.data || [],
        users: usersRes.data || [],
        notifications: notifRes.data || [],
        inventory: inventoryRes.data || [],
        inspections: [counts],
      });
      setLoading(false);
    };
    fetchData();
  }, [supabase, user?.id]);

  // Compute stats. Revenue leaves out cancelled orders: they were never paid.
  const paid = orders.filter((o) => (o.extended_status || o.status) !== 'cancelled');
  const totalRevenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
  const inProductionCount = orders.filter((o) => isProcessStage(o.extended_status)).length;
  const staffCount = users.filter((u) => u.role === 'staff').length;

  // Revenue per calendar month (by order date), the last six months up to this one
  const now = new Date();
  const revenueTrend = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const value = paid
      .filter((o) => {
        const d = new Date(o.created_at);
        return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
      })
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    return { month: month.toLocaleString('en-PH', { month: 'short' }), value };
  });
  const thisMonth = revenueTrend[5].value;
  const lastMonth = revenueTrend[4].value;
  // a % only means something when both months have orders; otherwise say what happened
  const growth =
    thisMonth === 0 ? 'No orders yet this month'
    : lastMonth === 0 ? 'No orders last month'
    : `${thisMonth >= lastMonth ? '+' : ''}${(((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)}% vs last month`;

  // Product mix from orders
  const productMix = orders.reduce((acc: Record<string, number>, o) => {
    const cat = o.product_category || 'furniture';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const orderMixData = Object.entries(productMix).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const lowStockItems = inventory.filter((i) => i.stock_level < i.min_stock);

  const summaryCards = [
    { label: 'Total Revenue', value: money(pesoShort(totalRevenue)), icon: PhilippinePeso, delta: money(growth), detail: `${paid.length} orders, excluding cancelled`, sensitive: true },
    { label: 'Orders in Progress', value: inProductionCount.toString(), icon: Package, delta: `${orders.length} total`, detail: 'Currently in the inspection process' },
    { label: 'Active Staff', value: staffCount.toString(), icon: Users, delta: `${users.length} total users`, detail: 'Production team' },
    { label: 'Defect Rate', value: `${defectRate(inspections).toFixed(1)}%`, icon: Bell, delta: `${inspections.failed} of ${inspections.total} failed`, detail: 'Inspections that failed' },
  ];

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="page-eyebrow">Administrator Overview</p>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Monitor revenue, orders, inspection progress, and supplier readiness in one premium woodworks management view.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:flex-nowrap lg:shrink-0 lg:justify-end">
          <Link href="/admin/reports" className="btn-secondary flex items-center gap-2">
            <FileText size={16} /> Export Reports
          </Link>
          <Link href="/real-time-production-dashboard" className="btn-primary flex items-center gap-2">
            <TrendingUp size={16} /> Inspection Monitor
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-foreground">{card.value}</h2>
                    {card.sensitive && (
                      <button
                        onClick={toggleMoney}
                        aria-label={showMoney ? 'Hide amounts' : 'Show amounts'}
                        aria-pressed={showMoney}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {showMoney ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
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
              <p className="text-sm text-muted-foreground mt-1">Revenue per month from orders placed, excluding cancelled orders.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMoney}
                aria-label={showMoney ? 'Hide amounts' : 'Show amounts'}
                aria-pressed={showMoney}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showMoney ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3A3A3' }} tickFormatter={(v) => money(pesoShort(Number(v)))} />
                <Tooltip contentStyle={{ background: '#1F1F1F', borderColor: '#383838' }} labelStyle={{ color: '#F5F5F5' }} formatter={(v) => [money(peso(Number(v))), 'Revenue']} />
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
                          variant={statusVariant(order.extended_status || order.status)}
                          label={statusLabel(order.extended_status || order.status)}
                        />
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{order.due_date || '—'}</td>
                      <td className="px-4 py-4 text-foreground font-semibold">{money(peso(order.amount))}</td>
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
