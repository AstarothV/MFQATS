'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ReviewDialog from './ReviewDialog';

export interface Review {
  id: string;
  order_id: string;
  image_url: string | null;
  detections: any[] | null; // the saved detections, each with its side
  notes: string | null;
  created_at: string;
  review_requested_at: string | null;
  orders: { order_ref: string; product_name: string } | null;
  piece?: string | null; // a set of chairs...: which piece this scan was for (migration 026)
}

// Failed scans the staff think are false alarms. The admin looks at the photo and the detections and decides:
// approve (the piece can be finished and delivered) or confirm the defects (it goes to rework). See migration 015.
export default function ScanReviews({ onDecided }: { onDecided: () => void }) {
  const supabase = createClient();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null); // the review shown in the pop-up

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('detection_logs')
      .select('*, orders(order_ref, product_name)')
      .eq('review_status', 'requested').order('review_requested_at');
    setSetupNeeded(!!error && /review_/.test(error.message));
    setReviews(error ? [] : ((data ?? []) as unknown as Review[]));
  }, [supabase]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(r: Review, status: 'approved' | 'rejected') {
    setBusy(r.id);
    setMessage(null);
    const { error } = await supabase.from('detection_logs')
      .update({ review_status: status, review_note: notes[r.id]?.trim() || null }).eq('id', r.id);
    setBusy(null);
    if (error) { setMessage({ ok: false, text: error.message }); return; }
    setMessage({ ok: true, text: status === 'approved'
      ? `${r.orders?.order_ref}: approved as a false alarm. Its rework task was closed and the staff can finish it.`
      : `${r.orders?.order_ref}: defects confirmed. The staff were told to send it back for rework.` });
    await load();
    onDecided();
  }

  // the pop-up stays on the same place in the list after a decision, so the next review comes up
  const count = reviews?.length ?? 0;
  const shown = open !== null && count ? Math.min(open, count - 1) : null;

  if (setupNeeded) {
    return <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">Scan reviews need the latest database update: run migration 20261105000015_scan_review.sql.</p>;
  }
  if (!reviews?.length && !message) return null;

  return (
    <section className="card-dark space-y-4 rounded-3xl border border-amber-500/30 p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-warning" />
        <h2 className="text-base font-semibold text-foreground">Scan reviews</h2>
        {!!reviews?.length && <span className="badge status-warning">{reviews.length} waiting</span>}
      </div>
      <p className="text-sm text-muted-foreground">The staff think these failed scans may be false alarms. Look at the photo and what was found, then decide.</p>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>
      )}
      {reviews?.map((r) => {
        const failing = (r.detections ?? []).filter((d) => d.severity !== 'low');
        return (
          <div key={r.id} className="grid gap-4 rounded-2xl border border-border p-4 md:grid-cols-[280px_1fr]">
            <button type="button" onClick={() => setOpen(reviews.indexOf(r))} aria-label={`Open the review of ${r.orders?.order_ref}`} className="block overflow-hidden rounded-xl">
              {r.image_url ? (
                <img src={r.image_url} alt={`Failed scan of ${r.orders?.order_ref}`} className="h-56 w-full bg-black object-contain transition hover:opacity-90 md:h-full" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-muted text-xs text-muted-foreground">No photo saved</div>
              )}
            </button>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">{r.orders?.order_ref} · {r.orders?.product_name}{r.piece ? ` · ${r.piece}` : ''}</p>
                <p className="text-xs text-muted-foreground">
                  Scanned {new Date(r.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {r.review_requested_at && ` · review asked ${new Date(r.review_requested_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Found ({failing.length} failing)</p>
                <ul className="flex flex-wrap gap-1.5">
                  {failing.map((d, i) => (
                    <li key={i} className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs capitalize text-foreground">
                      {d.class_name.replace(/_/g, ' ')} {d.confidence_score}%{d.side ? ` · ${d.side}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              {r.notes && <p className="rounded-xl bg-muted p-3 text-xs text-foreground"><span className="font-semibold">Staff notes:</span> {r.notes}</p>}
              <textarea
                value={notes[r.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                rows={2}
                placeholder="Note for the staff (optional)"
                className="input-dark w-full resize-none text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOpen(reviews.indexOf(r))} className="btn-secondary flex items-center gap-2 text-sm">
                  <Eye size={14} /> Open review
                </button>
                <button onClick={() => decide(r, 'approved')} disabled={busy === r.id} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                  {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} False alarm, approve
                </button>
                <button onClick={() => decide(r, 'rejected')} disabled={busy === r.id} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
                  <XCircle size={14} /> Defects confirmed
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {shown !== null && reviews && (
        <ReviewDialog
          review={reviews[shown]}
          position={shown + 1}
          total={count}
          busy={busy === reviews[shown].id}
          note={notes[reviews[shown].id] ?? ''}
          onNote={(text) => setNotes((n) => ({ ...n, [reviews[shown].id]: text }))}
          onPrev={() => setOpen((shown - 1 + count) % count)}
          onNext={() => setOpen((shown + 1) % count)}
          onClose={() => setOpen(null)}
          onDecide={(status) => decide(reviews[shown], status)}
        />
      )}
    </section>
  );
}
