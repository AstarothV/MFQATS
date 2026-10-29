'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, Package, ChevronRight } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { statusLabel, statusVariant } from '@/lib/orders';
import { ACTIVE_STATUSES, watchOrders } from '@/lib/staffAssignment';

interface Task {
  id: string;
  order_ref: string;
  product_name: string;
  customer_name: string;
  extended_status: string;
  due_date: string | null;
  assigned_at: string | null;
}

// The orders the admin assigned to the signed-in staff member (orders.assigned_to), kept up to date.
export default function AssignedTasksList() {
  const { user } = useAuth();
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('orders')
      .select('id, order_ref, product_name, customer_name, extended_status, due_date, assigned_at')
      .eq('assigned_to', user.id).in('extended_status', ACTIVE_STATUSES).order('due_date', { ascending: true });
    setSetupNeeded(!!error && /assigned_/.test(error.message));
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => watchOrders(supabase, 'assigned_tasks', load), [supabase, load]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Assigned Tasks</h3>
        <span className="text-xs text-muted-foreground">{tasks.length} order{tasks.length === 1 ? '' : 's'} assigned to you</span>
      </div>

      {setupNeeded ? (
        <p className="text-sm text-muted-foreground">Staff assignment is not set up in the database yet. Ask the admin to run the order staff assignment migration.</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Package size={20} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No orders are assigned to you right now. The admin assigns them in Order Management or Team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const overdue = !!t.due_date && t.due_date < today;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Package size={15} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{t.order_ref}</span>
                        <StatusBadge variant={statusVariant(t.extended_status)} label={statusLabel(t.extended_status)} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.product_name} · {t.customer_name}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className={`flex items-center gap-1 ${overdue ? 'text-warning' : 'text-muted-foreground'}`}>
                          {overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          {t.due_date ? `${overdue ? 'Overdue, was due' : 'Due'} ${t.due_date}` : 'No due date'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link href={`/staff/quality-scan?order=${t.id}`}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition">
                    Open in Quality Scan <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
