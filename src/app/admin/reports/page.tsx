'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { Download, Loader2, CheckCircle2, AlertTriangle, BarChart3, Package, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';



interface ReportData {
  orders: any[];
  defects: any[];
  users: any[];
  reworks: any[];
  inventory: any[];
}

export default function AdminReportsPage() {
  const supabase = createClient();
  const [data, setData] = useState<ReportData>({ orders: [], defects: [], users: [], reworks: [], inventory: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [ordersRes, defectsRes, usersRes, reworksRes, inventoryRes] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('defects').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').eq('role', 'staff'),
        supabase.from('rework_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*').order('name'),
      ]);
      setData({
        orders: ordersRes.data || [],
        defects: defectsRes.data || [],
        users: usersRes.data || [],
        reworks: reworksRes.data || [],
        inventory: inventoryRes.data || [],
      });
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  function exportCSV(reportType: string) {
    setGenerating(reportType);
    let csvContent = '';
    let filename = '';

    if (reportType === 'production') {
      csvContent = 'Order Ref,Customer,Product,Status,Stage,Amount,Due Date\n';
      data.orders.forEach((o) => {
        csvContent += `${o.order_ref},${o.customer_name},${o.product_name},${o.status},${o.current_stage},${o.amount},${o.due_date || ''}\n`;
      });
      filename = 'production_report.csv';
    } else if (reportType === 'defects') {
      csvContent = 'Defect Type,Stage,Severity,Confidence,Resolved,Date\n';
      data.defects.forEach((d) => {
        csvContent += `${d.defect_type},${d.stage_name},${d.severity},${d.confidence_score}%,${d.is_resolved},${d.created_at}\n`;
      });
      filename = 'defect_report.csv';
    } else if (reportType === 'inventory') {
      csvContent = 'Item Ref,Name,Category,Supplier,Stock Level,Min Stock,Unit,Location\n';
      data.inventory.forEach((i) => {
        csvContent += `${i.item_ref},${i.name},${i.category},${i.supplier},${i.stock_level},${i.min_stock},${i.unit},${i.location}\n`;
      });
      filename = 'inventory_report.csv';
    } else if (reportType === 'rework') {
      csvContent = 'Stage,Reason,Status,Created\n';
      data.reworks.forEach((r) => {
        csvContent += `${r.stage_name},${r.reason},${r.rework_status},${r.created_at}\n`;
      });
      filename = 'rework_report.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setGenerating(null);
      showToast('success', `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded`);
    }, 800);
  }

  const reports = [
    {
      id: 'production',
      title: 'Production Report',
      description: 'All orders, stages, completion rates, and delivery status',
      icon: Package,
      count: data.orders.length,
      countLabel: 'orders',
      color: 'text-accent',
      bg: 'bg-primary/10 border-primary/20',
    },
    {
      id: 'defects',
      title: 'Defect Report',
      description: 'All detected defects, severity levels, and YOLO confidence scores',
      icon: AlertTriangle,
      count: data.defects.length,
      countLabel: 'defects',
      color: 'text-danger',
      bg: 'bg-danger/10 border-danger/20',
    },
    {
      id: 'inventory',
      title: 'Inventory Report',
      description: 'Stock levels, low stock alerts, and supplier information',
      icon: BarChart3,
      count: data.inventory.length,
      countLabel: 'items',
      color: 'text-info',
      bg: 'bg-info/10 border-info/20',
    },
    {
      id: 'rework',
      title: 'Rework Analysis',
      description: 'Rework logs, resolution rates, and stage-by-stage rework frequency',
      icon: RotateCcw,
      count: data.reworks.length,
      countLabel: 'rework entries',
      color: 'text-warning',
      bg: 'bg-warning/10 border-warning/20',
    },
  ];

  return (
    <AppLayout role="admin" currentPath="/admin/reports">
      <div className="space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
            style={{ background: toast.type === 'success' ? '#22C55E' : '#EF4444', color: '#fff' }}>
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-2">Administration</p>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-2">Generate and export production, QA, defect, and inventory reports.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reports.map((report) => {
                const Icon = report.icon;
                const isGenerating = generating === report.id;
                return (
                  <div key={report.id} className={`card-dark rounded-3xl border p-6 ${report.bg}`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-background`}>
                          <Icon size={20} className={report.color} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{report.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-2xl font-bold ${report.color}`}>{report.count}</span>
                        <span className="text-sm text-muted-foreground ml-2">{report.countLabel}</span>
                      </div>
                      <button
                        onClick={() => exportCSV(report.id)}
                        disabled={isGenerating || report.count === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background border border-border text-sm font-semibold text-foreground hover:bg-muted transition-all disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {isGenerating ? 'Generating...' : 'Export CSV'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Stats */}
            <div className="card-dark rounded-3xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Production Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Orders', value: data.orders.length },
                  { label: 'In Production', value: data.orders.filter((o) => o.status === 'in_production').length },
                  { label: 'Delivered', value: data.orders.filter((o) => o.status === 'delivered').length },
                  { label: 'Defect Rate', value: data.orders.length > 0 ? `${Math.round((data.defects.length / data.orders.length) * 100)}%` : '0%' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-4 rounded-2xl bg-muted/30">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
