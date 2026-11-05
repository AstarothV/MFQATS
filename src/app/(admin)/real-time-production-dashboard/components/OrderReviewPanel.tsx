'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, ExternalLink, Loader2, X } from 'lucide-react';
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
    <div role="dialog" aria-modal="true" aria-label={`Review of ${order.order_ref}`} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={onClose}>
      {/* centered and never taller than the screen; the defects fold away so the whole panel fits without zooming out */}
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:max-h-[calc(100dvh-3rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">{order.order_ref} · {order.product_name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge variant={statusVariant(order.status)} label={statusLabel(order.status)} />
              {order.staff ? `Worked on by ${order.staff}` : 'No staff assigned'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost shrink-0 p-2"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          {/* detected defects: a one-line summary that opens into the list */}
          <details className="group rounded-2xl border border-border bg-muted/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Detected defects</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {scan === undefined ? 'Loading the last scan…'
                    : !scan ? 'No scan saved for this order yet'
                    : `Last scan ${scan.overall_result === 'fail' ? 'failed' : scan.overall_result === 'pass' ? 'passed' : scan.overall_result} · ${dets.length} defect${dets.length === 1 ? '' : 's'} · ${when(scan.created_at)}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {!!dets.length && <span className="badge status-danger">{dets.length}</span>}
                {scan === undefined ? <Loader2 size={15} className="animate-spin text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground transition-transform duration-200 group-open:rotate-180" />}
              </span>
            </summary>
            <div className="space-y-2 border-t border-border px-4 py-3">
              {!scan ? (
                <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
              ) : dets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No defects found.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dets.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold capitalize text-foreground">{formatLabel(d.class_name)}</span>
                        <span className="text-xs text-muted-foreground">{d.confidence_score}% sure{d.side ? ` · ${d.side}` : ''}</span>
                      </span>
                      <StatusBadge variant={SEV[d.severity] ?? 'info'} label={d.severity.charAt(0).toUpperCase() + d.severity.slice(1)} />
                    </li>
                  ))}
                </ul>
              )}
              {scan?.confidence_avg ? <p className="text-xs text-muted-foreground">Average confidence {Math.round(scan.confidence_avg)}%</p> : null}
              {scan?.review_status === 'requested' && (
                <Link href="/admin/rework" className="btn-secondary inline-flex items-center gap-2 text-sm">
                  <ExternalLink size={14} /> Review the photos and 3D model in Rework Queue
                </Link>
              )}
            </div>
          </details>

          <OrderChat orderId={order.id} compact title="Comments and review" hint="The staff working on it and the customer see your comments and can reply." />
        </div>
      </div>
    </div>,
    document.body,
  );
}
