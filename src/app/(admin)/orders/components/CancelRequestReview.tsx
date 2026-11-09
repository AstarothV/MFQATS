'use client';
import React, { useState } from 'react';
import { Check, Loader2, Undo2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** A customer asked to cancel a Pending order: the reason, and the admin's choice (migration 029). Staff only see it. */
export default function CancelRequestReview({ order, isAdmin, onDone, onError }: {
  order: { id: string; order_ref: string; cancel_reason?: string | null; cancel_requested_at?: string | null };
  isAdmin: boolean;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const when = order.cancel_requested_at
    ? new Date(order.cancel_requested_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

  async function decide(kind: 'approve' | 'decline') {
    setBusy(kind);
    const supabase = createClient();
    const { error } = kind === 'approve'
      ? await supabase.rpc('approve_order_cancel', { p_order: order.id })
      : await supabase.rpc('decline_order_cancel', { p_order: order.id, p_note: note.trim() || null });
    setBusy(null);
    if (error) return onError(error.message);
    onDone(kind === 'approve'
      ? `${order.order_ref} was cancelled. The customer was notified.`
      : `${order.order_ref} goes ahead. The customer was told their request was not approved.`);
  }

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">The customer asked to cancel this order</p>
        {order.cancel_reason && <p className="mt-1 text-sm text-foreground/90">&ldquo;{order.cancel_reason}&rdquo;</p>}
        <p className="mt-1 text-xs text-muted-foreground">Asked {when}</p>
      </div>
      {isAdmin ? (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground/80">Note to the customer if you keep the order (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="input-dark w-full resize-none text-sm"
              placeholder="e.g. Your piece is already being prepared; we can change the finish instead." />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => decide('approve')} disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
              {busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve cancellation
            </button>
            <button type="button" onClick={() => decide('decline')} disabled={!!busy} className="btn-secondary flex items-center justify-center gap-2 text-sm">
              {busy === 'decline' ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Keep the order
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">An admin decides whether to cancel it.</p>
      )}
    </div>
  );
}
