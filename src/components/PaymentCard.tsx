'use client';

import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Truck, Store, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { peso } from '@/lib/money';
import { PAYMENT_LABEL, PAYMENT_STATUS_LABEL, type PaymentMethod } from '@/lib/delivery';

export type PaymentOrder = {
  id: string;
  order_ref: string;
  amount: number;
  extended_status?: string;
  pickup_type?: string;
  delivery_km?: number | null;
  delivery_fee?: number;
  down_payment?: number;
  payment_method?: string | null;
  payment_reference?: string;
  payment_status?: string;
};

// An order's delivery and payment (migration 040): the delivery fee, the down payment and the balance, and where the
// payment stands. The customer sends the reference of an online payment; an admin marks the down payment and the full
// payment as received (each after a confirmation). Orders from before migration 040 have no payment_status: nothing shows.
export default function PaymentCard({ order, as = 'customer', onChanged }: { order: PaymentOrder; as?: 'customer' | 'admin' | 'view'; onChanged?: () => void }) {
  const supabase = useRef(createClient()).current;
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askFirst, confirmBox] = useConfirm();
  if (!order.payment_status) return null;

  const fee = Number(order.delivery_fee ?? 0);
  const total = Number(order.amount ?? 0) + fee;
  const dp = Number(order.down_payment ?? 0);
  const status = order.payment_status;
  const cancelled = order.extended_status === 'cancelled';

  async function sendRef(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('submit_payment_reference', { p_order: order.id, p_reference: ref });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setRef('');
    setMsg({ ok: true, text: 'Sent. The store will check it and mark your payment received.' });
    onChanged?.();
  }

  async function mark(next: 'down_paid' | 'paid' | 'unpaid') {
    const what = next === 'down_paid' ? `the down payment of ${peso(dp)}` : next === 'paid' ? `the full payment of ${peso(total)}` : 'this order as not paid';
    if (!(await askFirst({
      title: next === 'unpaid' ? 'Undo the payment?' : 'Mark payment received?',
      message: `Order ${order.order_ref}: mark ${what}${next === 'unpaid' ? '' : ' as received'}? The customer is notified.`,
      confirmLabel: next === 'unpaid' ? 'Undo' : 'Mark received', cancelLabel: 'Cancel', danger: next === 'unpaid',
    }))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('orders').update({ payment_status: next }).eq('id', order.id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    onChanged?.();
  }

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className={strong ? 'font-bold text-foreground' : 'font-semibold text-foreground'}>{value}</span></div>
  );

  return (
    <section className="card-dark space-y-3 rounded-3xl border border-border p-5 text-sm">
      {confirmBox}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Wallet size={16} className="text-primary dark:text-accent" /> Payment</h2>
        <span className={`badge ${status === 'paid' ? 'status-ok' : status === 'down_paid' ? 'status-info' : 'status-warning'}`}>{PAYMENT_STATUS_LABEL[status] ?? status}</span>
      </div>
      <div className="space-y-1.5">
        {row('Furniture', peso(Number(order.amount ?? 0)))}
        {row(order.pickup_type === 'pickup' ? 'Pick-up at the store' : `Delivery${order.delivery_km != null ? ` (${order.delivery_km} km)` : ''}`, fee === 0 ? 'Free' : peso(fee))}
        <div className="border-t border-border pt-1.5">{row('Total', peso(total), true)}</div>
        {row('Down payment', peso(dp))}
        {row(`Balance${order.payment_method ? ` · ${PAYMENT_LABEL[order.payment_method as PaymentMethod] ?? order.payment_method}` : ''}`, peso(total - dp))}
        {order.payment_reference && row('Reference sent', order.payment_reference)}
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        {order.pickup_type === 'pickup' ? <Store size={14} className="mt-px shrink-0" /> : <Truck size={14} className="mt-px shrink-0" />}
        {status === 'unpaid' ? 'Work on the furniture starts once the down payment is received.' : status === 'down_paid' ? 'Down payment received. The balance is paid before or on delivery or pick-up.' : 'Fully paid. Thank you!'}
      </p>

      {as === 'customer' && !cancelled && status !== 'paid' && (
        <form onSubmit={sendRef} className="flex flex-col gap-2 sm:flex-row">
          <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={40} placeholder="GCash or bank reference number" aria-label="Payment reference number" className="input-dark flex-1" />
          <button type="submit" disabled={busy || ref.trim().length < 4} className="btn-primary flex items-center justify-center gap-2 text-sm">
            {busy && <Loader2 size={14} className="animate-spin" />} Send reference
          </button>
        </form>
      )}

      {as === 'admin' && !cancelled && (
        <div className="flex flex-wrap gap-2">
          {status === 'unpaid' && <button type="button" disabled={busy} onClick={() => mark('down_paid')} className="btn-primary flex items-center gap-2 text-sm"><CheckCircle2 size={14} /> Down payment received</button>}
          {status !== 'paid' && <button type="button" disabled={busy} onClick={() => mark('paid')} className="btn-secondary flex items-center gap-2 text-sm"><CheckCircle2 size={14} /> Fully paid</button>}
          {status !== 'unpaid' && <button type="button" disabled={busy} onClick={() => mark('unpaid')} className="btn-ghost text-sm text-danger">Undo</button>}
        </div>
      )}
      {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </section>
  );
}
