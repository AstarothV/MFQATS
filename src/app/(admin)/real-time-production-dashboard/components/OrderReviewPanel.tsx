'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { statusLabel, statusVariant } from '@/lib/orders';
import StatusBadge from '@/components/ui/StatusBadge';
import OrderChat from '@/components/OrderChat';
import { formatLabel } from '@/app/(staff)/staff/quality-scan/DefectsBySide';
import type { FloorOrder } from './WorkstationGrid';

interface Scan {
  overall_result: string;
  created_at: string;
  confidence_avg: number | null;
  review_status: string | null;
  detections: { class_name: string; confidence_score: number; severity: string; side?: string }[] | null;
}

const SEV: Record<string, 'danger' | 'warning' | 'info'> = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' };

// One order in progress, opened from Orders in progress: the defects its last scan found, and the conversation where
// the admin comments on them (the staff and the customer see it too).
export default function OrderReviewPanel({ order, onClose }: { order: FloorOrder; onClose: () => void }) {
  const [scan, setScan] = useState<Scan | null | undefined>(undefined);

  useEffect(() => {
    createClient().from('detection_logs').select('overall_result, created_at, confidence_avg, review_status, detections')
      .eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setScan((data as Scan) ?? null), () => setScan(null));
  }, [order.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = before; };
  }, [onClose]);

  const dets = scan?.detections ?? [];
  const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Review of ${order.order_ref}`} className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-6" onClick={onClose}>
      <div className="w-full max-w-2xl space-y-5 rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">{order.order_ref} · {order.product_name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge variant={statusVariant(order.status)} label={statusLabel(order.status)} />
              {order.staff ? `Worked on by ${order.staff}` : 'No staff assigned'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost p-2"><X size={18} /></button>
        </div>

        <section className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">Detected defects</h3>
          {scan === undefined ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading the last scan…</p>
          ) : !scan ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No scan saved for this order yet.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Last scan {when(scan.created_at)} · {scan.overall_result === 'fail' ? 'failed' : scan.overall_result === 'pass' ? 'passed' : scan.overall_result}
                {scan.confidence_avg ? ` · average confidence ${Math.round(scan.confidence_avg)}%` : ''}
              </p>
              {dets.length === 0 ? (
                <p className="rounded-2xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">No defects found.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {dets.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold capitalize text-foreground">{formatLabel(d.class_name)}</span>
                        <span className="text-xs text-muted-foreground">{d.confidence_score}% sure{d.side ? ` · ${d.side}` : ''}</span>
                      </span>
                      <StatusBadge variant={SEV[d.severity] ?? 'info'} label={d.severity.charAt(0).toUpperCase() + d.severity.slice(1)} />
                    </li>
                  ))}
                </ul>
              )}
              {scan.review_status === 'requested' && (
                <Link href="/admin/rework" className="btn-secondary inline-flex items-center gap-2 text-sm">
                  <ExternalLink size={14} /> Review the photos and 3D model in Rework Queue
                </Link>
              )}
            </>
          )}
        </section>

        <div className="border-t border-border pt-4">
          <OrderChat orderId={order.id} title="Comments and review" hint="Your comments on this piece. The staff working on it and the customer see them and can reply." />
        </div>
      </div>
    </div>,
    document.body,
  );
}
