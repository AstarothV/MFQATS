'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, X, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { mediaLinks } from '@/lib/orderMedia';
import DefectsBySide, { formatLabel, type Detection, type SideTile } from '@/app/(staff)/staff/quality-scan/DefectsBySide';
import ModelDefectsView, { type Pin } from '@/app/(staff)/staff/quality-scan/ModelDefectsView';
import { VIEWS } from '@/app/(staff)/staff/quality-scan/PhotoSet';
import type { Review } from './ScanReviews';

type SideDetection = Detection & { side?: string };

// One failed scan, full screen: every side's photo with what was found on it, and the defects on the order's 3D model,
// so the admin can judge a possible false alarm. Previous / Next go through the waiting reviews one by one.
export default function ReviewDialog({ review, position, total, busy, note, onNote, onPrev, onNext, onClose, onDecide }: {
  review: Review; position: number; total: number; busy: boolean; note: string;
  onNote: (text: string) => void; onPrev: () => void; onNext: () => void; onClose: () => void;
  onDecide: (status: 'approved' | 'rejected') => void;
}) {
  const supabase = createClient();
  const [media, setMedia] = useState<{ photos: Record<string, string>; model: string | null } | null>(null);

  // the side photos (a close-up where there is one, as the scan used) and the 3D model saved for the order
  useEffect(() => {
    let stale = false;
    setMedia(null);
    (async () => {
      const [{ data: rows }, { data: order }] = await Promise.all([
        supabase.from('inspection_images').select('caption, image_url').eq('order_id', review.order_id),
        supabase.from('orders').select('model_3d_path').eq('id', review.order_id).single(),
      ]);
      const own = (rows ?? []).filter((r) => r.image_url && !r.image_url.startsWith('http'));
      const modelPath: string | null = order?.model_3d_path ?? null;
      const links = await mediaLinks(supabase, [...own.map((r) => r.image_url), ...(modelPath ? [modelPath] : [])]);
      const photos: Record<string, string> = {};
      for (const kind of ['photo', 'close-up']) { // close-ups last, so they win
        for (const r of own) if (r.caption.endsWith(` ${kind}`) && links[r.image_url]) photos[r.caption.split(' ')[0]] = links[r.image_url];
      }
      if (!stale) setMedia({ photos, model: modelPath ? links[modelPath] ?? null : null });
    })().catch(() => !stale && setMedia({ photos: {}, model: null }));
    return () => { stale = true; };
  }, [review.order_id, supabase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLTextAreaElement)) onPrev();
      if (e.key === 'ArrowRight' && !(e.target instanceof HTMLTextAreaElement)) onNext();
    };
    document.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = before; };
  }, [onClose, onPrev, onNext]);

  const dets = (review.detections ?? []) as SideDetection[];
  const failing = dets.filter((d) => d.severity !== 'low');
  const tiles: SideTile[] = VIEWS.map((v) => ({
    label: v,
    image: media?.photos[v] ?? null,
    detections: dets.some((d) => d.side === v) || media?.photos[v] ? dets.filter((d) => d.side === v) : null,
  }));
  const pins: Pin[] = dets.flatMap((d) => {
    const slot = VIEWS.indexOf(d.side as (typeof VIEWS)[number]);
    const b = d.bounding_box;
    return slot < 0 || !b ? [] : [{ slot, u: b.x + b.width / 2, v: b.y + b.height / 2, w: b.width, h: b.height, label: formatLabel(d.class_name), severity: d.severity }];
  });
  const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Review of ${review.orders?.order_ref}`} className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div className="mx-auto max-w-5xl space-y-5 rounded-3xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">{review.orders?.order_ref} · {review.orders?.product_name}</h2>
            <p className="text-xs text-muted-foreground">
              Scanned {when(review.created_at)}{review.review_requested_at && ` · review asked ${when(review.review_requested_at)}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs font-medium tabular-nums text-muted-foreground" aria-live="polite">{position} of {total} waiting</span>
            <button type="button" onClick={onPrev} disabled={total < 2} aria-label="Previous review" className="btn-ghost p-2 disabled:opacity-30"><ChevronLeft size={18} /></button>
            <button type="button" onClick={onNext} disabled={total < 2} aria-label="Next review" className="btn-ghost p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
            <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost p-2"><X size={18} /></button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Found ({failing.length} failing)</p>
          <ul className="flex flex-wrap gap-1.5">
            {failing.map((d, i) => (
              <li key={i} className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs capitalize text-foreground">
                {formatLabel(d.class_name)} {d.confidence_score}%{d.side ? ` · ${d.side}` : ''}
              </li>
            ))}
          </ul>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Each side, with what was found</h3>
          {!media ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading the photos…</div>
          ) : (
            <DefectsBySide tiles={tiles} />
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Where the defects are on the piece</h3>
          {!media ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading the 3D model…</div>
          ) : media.model ? (
            <ModelDefectsView modelUrl={media.model} pins={pins} />
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No 3D model was saved for this order.</p>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          {review.notes && <p className="rounded-xl bg-muted p-3 text-sm text-foreground"><span className="font-semibold">Staff notes:</span> {review.notes}</p>}
          <textarea value={note} onChange={(e) => onNote(e.target.value)} rows={2} placeholder="Note for the staff (optional)" className="input-dark w-full resize-none text-sm" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onDecide('approved')} disabled={busy} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} False alarm, approve
            </button>
            <button onClick={() => onDecide('rejected')} disabled={busy} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
              <XCircle size={14} /> Defects confirmed
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
