'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { RotateCcw, CheckCircle2, AlertTriangle, Loader2, X, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';

interface ReworkLog {
  id: string;
  order_id: string;
  stage_name: string;
  reason: string;
  rework_status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  notes: string;
  created_at: string;
  updated_at: string;
  orders?: { order_ref: string; product_name: string } | null;
  assigned_user?: { full_name: string } | null;
}

export default function AdminReworkPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [reworks, setReworks] = useState<ReworkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedRework, setSelectedRework] = useState<ReworkLog | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchReworks = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('rework_logs')
      .select('*, orders(order_ref, product_name), assigned_user:user_profiles!rework_logs_assigned_to_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('rework_status', statusFilter);
    const { data, error } = await query;
    if (!error && data) setReworks(data as ReworkLog[]);
    setLoading(false);
  }, [supabase, statusFilter]);

  useEffect(() => { fetchReworks(); }, [fetchReworks]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    try {
      const updateData: any = { rework_status: newStatus };
      if (newStatus === 'resolved') {
        updateData.resolved_by = user?.id;
        updateData.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('rework_logs').update(updateData).eq('id', id);
      if (error) throw error;
      showToast('success', `Rework status updated to ${newStatus}`);
      fetchReworks();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  }

  const statusVariant: Record<string, any> = {
    pending: 'warning',
    in_progress: 'info',
    resolved: 'ok',
    rejected: 'danger',
  };

  const counts = {
    all: reworks.length,
    pending: reworks.filter((r) => r.rework_status === 'pending').length,
    in_progress: reworks.filter((r) => r.rework_status === 'in_progress').length,
    resolved: reworks.filter((r) => r.rework_status === 'resolved').length,
  };

  return (
    <AppLayout role="admin" currentPath="/admin/rework">
      <div className="space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
            style={{ background: toast.type === 'success' ? '#22C55E' : '#EF4444', color: '#fff' }}>
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.message}
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-2">Quality Management</p>
          <h1 className="text-3xl font-bold text-foreground">Rework Queue</h1>
          <p className="text-sm text-muted-foreground mt-2">Manage rework requests, track resolution, and approve reinspections.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: counts.all, color: 'text-foreground' },
            { label: 'Pending', value: counts.pending, color: 'text-warning' },
            { label: 'In Progress', value: counts.in_progress, color: 'text-info' },
            { label: 'Resolved', value: counts.resolved, color: 'text-success' },
          ].map((stat) => (
            <div key={stat.label} className="card-dark p-4 rounded-3xl border border-border">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'in_progress', 'resolved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1)}
            </button>
          ))}
        </div>

        {/* Rework Table */}
        <div className="card-dark rounded-3xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          ) : reworks.length === 0 ? (
            <div className="text-center py-16">
              <RotateCcw size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No rework entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reworks.map((rework) => (
                    <tr key={rework.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{rework.orders?.order_ref || '—'}</p>
                        <p className="text-xs text-muted-foreground">{rework.orders?.product_name}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{rework.stage_name?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <p className="truncate text-xs">{rework.reason}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{rework.assigned_user?.full_name || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={statusVariant[rework.rework_status]} label={rework.rework_status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(rework.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {rework.rework_status === 'pending' && (
                            <button
                              onClick={() => updateStatus(rework.id, 'in_progress')}
                              disabled={updating === rework.id}
                              className="px-2 py-1 rounded-lg bg-info/20 text-info text-xs font-semibold hover:bg-info/30 transition-all"
                            >
                              {updating === rework.id ? <Loader2 size={10} className="animate-spin" /> : 'Start'}
                            </button>
                          )}
                          {rework.rework_status === 'in_progress' && (
                            <button
                              onClick={() => updateStatus(rework.id, 'resolved')}
                              disabled={updating === rework.id}
                              className="px-2 py-1 rounded-lg bg-success/20 text-success text-xs font-semibold hover:bg-success/30 transition-all"
                            >
                              {updating === rework.id ? <Loader2 size={10} className="animate-spin" /> : 'Resolve'}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedRework(rework)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selectedRework && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSelectedRework(null)}>
            <div className="card-dark rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Rework Details</h3>
                <button onClick={() => setSelectedRework(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Order</span><span className="font-semibold text-foreground">{selectedRework.orders?.order_ref}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-semibold text-foreground">{selectedRework.orders?.product_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stage</span><span className="font-semibold text-foreground capitalize">{selectedRework.stage_name?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge variant={statusVariant[selectedRework.rework_status]} label={selectedRework.rework_status} /></div>
                <div>
                  <p className="text-muted-foreground mb-1">Reason</p>
                  <p className="text-foreground bg-muted rounded-lg p-3 text-xs">{selectedRework.reason}</p>
                </div>
                {selectedRework.notes && (
                  <div>
                    <p className="text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground bg-muted rounded-lg p-3 text-xs">{selectedRework.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                {selectedRework.rework_status === 'pending' && (
                  <button onClick={() => { updateStatus(selectedRework.id, 'in_progress'); setSelectedRework(null); }} className="btn-primary flex-1 text-sm">Mark In Progress</button>
                )}
                {selectedRework.rework_status === 'in_progress' && (
                  <button onClick={() => { updateStatus(selectedRework.id, 'resolved'); setSelectedRework(null); }} className="btn-primary flex-1 text-sm">Mark Resolved</button>
                )}
                <button onClick={() => setSelectedRework(null)} className="btn-secondary px-4 text-sm">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
