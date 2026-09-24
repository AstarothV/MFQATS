'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string;
  created_at: string;
  user_profiles?: { full_name: string; email: string; role: string } | null;
}

const PAGE_SIZE = 20;

export default function AdminAuditLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*, user_profiles(full_name, email, role)', { count: 'exact' });
    if (search) query = query.ilike('action', `%${search}%`);
    query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (!error && data) {
      setLogs(data as AuditLog[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [supabase, search, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const actionColor: Record<string, string> = {
    user_login: 'text-info',
    user_logout: 'text-muted-foreground',
    stage_update: 'text-accent',
    defect_reported: 'text-warning',
    qa_submitted: 'text-success',
    rework_created: 'text-danger',
    order_updated: 'text-info',
  };

  return (
    <AppLayout role="admin" currentPath="/admin/audit-logs">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-2">Administration</p>
            <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
            <p className="text-sm text-muted-foreground mt-2">Track all system actions, logins, and data changes.</p>
          </div>
          <div className="text-sm text-muted-foreground">{total} total entries</div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by action..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="input-dark w-full pl-10"
            />
          </div>
        </div>

        <div className="card-dark rounded-3xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground text-xs">{log.user_profiles?.full_name || 'System'}</p>
                            <p className="text-xs text-muted-foreground">{log.user_profiles?.role || ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${actionColor[log.action] || 'text-foreground'}`}>
                            {log.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                          {log.entity_type?.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-xs text-accent">
                          {expandedId === log.id ? 'Hide ▲' : 'View ▼'}
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr className="bg-muted/20">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {log.old_values && Object.keys(log.old_values).length > 0 && (
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1">Previous Values</p>
                                  <pre className="bg-muted rounded-lg p-2 text-foreground overflow-auto max-h-32">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.new_values && Object.keys(log.new_values).length > 0 && (
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1">New Values</p>
                                  <pre className="bg-muted rounded-lg p-2 text-foreground overflow-auto max-h-32">
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
