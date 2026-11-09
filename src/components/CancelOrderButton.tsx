'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Loader2, X, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const REASONS = [
  'I changed my mind',
  'I ordered the wrong item or quantity',
  'I found a better price elsewhere',
  'It will take too long',
  'Other reason',
] as const;

type CancellableOrder = {
  id: string;
  order_ref: string;
  product_name?: string | null;
  extended_status?: string | null;
  status?: string | null;
  cancel_requested_at?: string | null;
};

/**
 * A customer asks to cancel an order that is still Pending, and says why; an admin approves or keeps the order
 * (migration 029). Once asked, it shows "Cancellation requested" until the shop decides.
 */
export default function CancelOrderButton({ order, onCancelled, className = '' }: {
  order: CancellableOrder;
  onCancelled?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | ''>('');
  const [more, setMore] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    document.addEventListener('keydown', esc);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = before; };
  }, [open, busy]);

  if ((order.extended_status || order.status || 'pending') !== 'pending') return null;

  if (order.cancel_requested_at) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning ${className}`}>
        <Clock size={13} aria-hidden="true" /> Cancellation requested · waiting for the shop
      </span>
    );
  }

  function start() {
    setReason(''); setMore(''); setError(''); setOpen(true);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError('Choose a reason.');
    if (reason === 'Other reason' && more.trim().length < 3) return setError('Tell us your reason in a few words.');
    const why = reason === 'Other reason' ? more.trim() : `${reason}${more.trim() ? `: ${more.trim()}` : ''}`;
    setBusy(true); setError('');
    const { error: err } = await createClient().rpc('request_order_cancel', { p_order: order.id, p_reason: why });
    setBusy(false);
    if (err) {
      setError(/schema cache|Could not find the function/i.test(err.message) // migration 029 not run yet
        ? 'Cancelling needs the latest database update (migration 029). Please tell the shop.'
        : err.message);
      return;
    }
    setOpen(false);
    onCancelled?.();
  }

  return (
    <>
      <button type="button" onClick={start}
        className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 ${className}`}>
        <XCircle size={14} aria-hidden="true" /> Cancel order
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <form onSubmit={send} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-title"
            className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="cancel-title" className="text-lg font-bold text-foreground">Cancel this order?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.order_ref}{order.product_name ? ` · ${order.product_name}` : ''}. The shop reviews your request and you get a notification with their answer.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close" className="btn-ghost -mr-1 -mt-1 p-2"><X size={18} /></button>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-foreground">Why do you want to cancel?</legend>
              {REASONS.map((r, i) => (
                <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${reason === r ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground/80 hover:bg-muted'}`}>
                  <input ref={i === 0 ? first : undefined} type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={() => { setReason(r); setError(''); }}
                    className="h-4 w-4 accent-[var(--primary)]" />
                  {r}
                </label>
              ))}
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground/80">{reason === 'Other reason' ? 'Your reason' : 'Anything else? (optional)'}</span>
              <textarea value={more} onChange={(e) => { setMore(e.target.value); setError(''); }} maxLength={300} rows={3}
                placeholder={reason === 'Other reason' ? 'Tell us why you want to cancel' : 'e.g. I need it in a different finish'}
                className="input-dark w-full resize-none" />
            </label>

            {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-secondary text-sm">Keep my order</button>
              <button type="submit" disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Send cancellation request
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
