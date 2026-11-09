'use client';
import React, { useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { moveOrderStage } from '@/lib/orders';

/** A customer's own order can be cancelled while it is still Pending (the database allows nothing else, migration 025). */
export default function CancelOrderButton({ order, onCancelled, className = '' }: {
  order: { id: string; order_ref: string; extended_status?: string | null; status?: string | null };
  onCancelled?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  if ((order.extended_status || order.status || 'pending') !== 'pending') return null;

  async function cancel() {
    if (!window.confirm(`Cancel order ${order.order_ref}? The workshop has not started on it yet. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await moveOrderStage(createClient(), order, 'cancelled');
      onCancelled?.();
    } catch (err: any) {
      window.alert(err?.message || 'Could not cancel the order. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={cancel} disabled={busy}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60 ${className}`}>
      {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
      Cancel order
    </button>
  );
}
