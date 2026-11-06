'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { dataUserId } from '@/lib/viewer';

interface Scan {
  id: string;
  overall_result: string;
  defect_count: number;
  created_at: string;
  orders: { order_ref: string; product_name: string } | null;
}

// The scans this staff member saved most recently.
export default function RecentQAFeed() {
  const { user } = useAuth();
  const supabase = createClient();
  const [scans, setScans] = useState<Scan[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('detection_logs').select('id, overall_result, defect_count, created_at, orders(order_ref, product_name)')
      .eq('inspector_id', dataUserId(user)).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setScans((data ?? []) as unknown as Scan[]));
  }, [supabase, user]);

  return (
    <div className="card-dark p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Your recent scans</h3>
        <Link href="/staff/quality-scan" className="text-xs text-primary hover:text-accent transition-colors font-medium">Quality Scan</Link>
      </div>

      {scans === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : scans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved scans yet. Scans you save in Quality Scan appear here.</p>
      ) : (
        <div className="space-y-3">
          {scans.map((s) => {
            const pass = s.overall_result === 'pass';
            const Icon = pass ? CheckCircle2 : XCircle;
            return (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${pass ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                  <Icon size={15} className={pass ? 'text-success' : 'text-danger'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{s.orders?.order_ref ?? 'Practice scan'}</span>
                    <StatusBadge variant={pass ? 'ok' : 'danger'} label={pass ? 'Passed' : 'Failed'} />
                    {s.orders?.product_name && <span className="text-xs text-muted-foreground">{s.orders.product_name}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.defect_count} defect{s.defect_count === 1 ? '' : 's'} found</p>
                  <span className="mt-1.5 flex items-center gap-1 text-2xs text-muted-foreground/70">
                    <Clock size={10} /> {new Date(s.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
