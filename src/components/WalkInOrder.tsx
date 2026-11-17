'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Loader2, Plus, Store, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import PlaceSearch from '@/components/PlaceSearch';
import { peso } from '@/lib/money';
import { maxQty } from '@/lib/pieces';
import { phDigits, phPhone, PH_MOBILE, SHOP_SPOT, PAYMENT_LABEL, type PaymentMethod } from '@/lib/delivery';

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false, loading: () => <div className="h-56 w-full animate-pulse rounded-xl bg-muted" /> });

type Product = { id: string; name: string; category: string; price: number; stock_type?: string; stock_qty?: number; estimated_production_days?: number; availability: string };
type Line = { productId: string; qty: number };

// Admin: an order taken at the store (migration 042, order_source 'walk_in'). The customer may have no account; their
// name and mobile number are kept on the order. In-stock pieces come off the stock, and the database works out the
// delivery fee and down payment as for online orders. It then goes through the same stages and inspection.
export default function WalkInOrder({ onPlaced }: { onPlaced: (ref: string) => void }) {
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', qty: 1 }]);
  const [pickup, setPickup] = useState<'pickup' | 'delivery'>('pickup');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('store');
  const [paidNow, setPaidNow] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [askFirst, confirmBox] = useConfirm();

  useEffect(() => {
    if (!open || products.length) return;
    supabase.from('products').select('*').eq('is_active', true).order('name').then(({ data }) => setProducts((data ?? []) as Product[]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pickup === 'pickup' && payment === 'cod') setPayment('store'); }, [pickup, payment]);

  const byId = (id: string) => products.find((p) => p.id === id);
  const cap = (p?: Product) => (!p ? 1 : p.stock_type === 'in_stock' ? Math.min(maxQty(p.category), p.stock_qty ?? 0) : maxQty(p.category));
  const chosen = lines.filter((l) => l.productId).map((l) => ({ ...l, p: byId(l.productId)! })).filter((l) => l.p);
  const total = chosen.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);

  function reset() {
    setName(''); setPhone(''); setLines([{ productId: '', qty: 1 }]); setPickup('pickup'); setStreet(''); setCity(''); setPin(null);
    setPayment('store'); setPaidNow(true); setNotes(''); setErr('');
  }

  async function place(e: React.FormEvent) {
    e.preventDefault();
    const digits = phDigits(phone);
    if (!name.trim()) return setErr('Enter the customer name.');
    if (!PH_MOBILE.test(digits)) return setErr('Enter the customer mobile number: the 10 digits after +63.');
    if (!chosen.length) return setErr('Choose at least one product.');
    const over = chosen.find((l) => l.qty < 1 || l.qty > cap(l.p));
    if (over) return setErr(cap(over.p) === 0 ? `${over.p.name} is out of stock.` : `At most ${cap(over.p)} of ${over.p.name} in one order.`);
    if (pickup === 'delivery' && (!street.trim() || !city.trim() || !pin)) return setErr('For delivery, search the address so it is pinned on the map, and check the street and city.');
    if (!(await askFirst({ title: 'Place this walk-in order?', message: `${name.trim()}: ${chosen.map((l) => `${l.p.name} × ${l.qty}`).join(', ')}, ${peso(total)}${pickup === 'delivery' ? ' plus the delivery fee' : ''}.${paidNow ? ' The down payment is marked received.' : ''}`, confirmLabel: 'Place order', cancelLabel: 'Cancel' }))) return;
    setBusy(true); setErr('');
    const first = chosen[0].p;
    const days = Math.max(...chosen.map((l) => l.p.estimated_production_days || 14));
    const orderRef = `ORD-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from('orders').insert({
      order_ref: orderRef, customer_id: null, customer_name: name.trim(), customer_phone: phPhone(digits),
      product_name: chosen.length === 1 ? first.name : `${first.name} + ${chosen.length - 1} more`, product_category: first.category, product_id: first.id,
      amount: total, quantity: chosen.reduce((s, l) => s + l.qty, 0), status: 'pending', extended_status: 'pending', completion_pct: 0,
      items: chosen.map((l) => ({ product_id: l.p.id, name: l.p.name, category: l.p.category, quantity: l.qty })),
      pickup_type: pickup, delivery_address: pickup === 'delivery' ? street.trim() : '', delivery_city: pickup === 'delivery' ? city.trim() : '',
      delivery_phone: phPhone(digits), delivery_lat: pickup === 'delivery' ? pin!.lat : null, delivery_lng: pickup === 'delivery' ? pin!.lng : null,
      payment_method: payment, order_source: 'walk_in', notes: notes.trim(),
      ...(paidNow ? { payment_status: 'down_paid', down_paid_at: new Date().toISOString() } : {}),
      due_date: new Date(Date.now() + days * 864e5).toISOString().split('T')[0],
    });
    setBusy(false);
    if (error) return setErr(/order_source|customer_phone/.test(error.message) ? 'Walk-in orders need the latest database update (migration 042).' : error.message);
    setOpen(false);
    reset();
    onPlaced(orderRef);
  }

  const choice = (on: boolean) => `flex-1 rounded-2xl border p-3 text-left text-sm transition-colors ${on ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`;

  return (
    <>
      {confirmBox}
      <button type="button" onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 text-sm"><Store size={15} /> New walk-in order</button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setOpen(false)}>
          <form onSubmit={place} onClick={(e) => e.stopPropagation()} className="card-dark max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">New walk-in order</h2>
                <p className="text-sm text-muted-foreground">For a customer ordering at the store. It goes through the same stages and inspection as online orders.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-muted-foreground">Customer name *
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="input-dark mt-1 w-full" placeholder="Juan Dela Cruz" />
              </label>
              <label className="block space-y-1 text-sm text-muted-foreground">Mobile number *
                <span className="mt-1 flex">
                  <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-sm text-foreground">+63</span>
                  <input value={phone} onChange={(e) => setPhone(phDigits(e.target.value))} type="tel" inputMode="numeric" maxLength={16} className="input-dark w-full rounded-l-none" placeholder="917 123 4567" />
                </span>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground/80">Products</p>
              {lines.map((l, i) => {
                const p = byId(l.productId);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select value={l.productId} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { productId: e.target.value, qty: 1 } : x)))} className="input-dark min-w-0 flex-1" aria-label="Product">
                      <option value="">Choose a product…</option>
                      {products.map((x) => (
                        <option key={x.id} value={x.id} disabled={x.stock_type === 'in_stock' && (x.stock_qty ?? 0) === 0}>
                          {x.name} · {peso(Number(x.price))} · {x.stock_type === 'in_stock' ? `${x.stock_qty ?? 0} in stock` : 'made to order'}
                        </option>
                      ))}
                    </select>
                    <input type="number" min={1} max={cap(p)} value={l.qty} aria-label="Quantity"
                      onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value, 10) || 1) } : x)))} className="input-dark w-20 text-center" />
                    {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove this product" className="btn-ghost p-1.5 text-danger"><Trash2 size={14} /></button>}
                  </div>
                );
              })}
              <button type="button" onClick={() => setLines((ls) => [...ls, { productId: '', qty: 1 }])} className="flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-accent"><Plus size={14} /> Add another product</button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Pick-up or delivery">
              <button type="button" role="radio" aria-checked={pickup === 'pickup'} onClick={() => setPickup('pickup')} className={choice(pickup === 'pickup')}><span className="font-semibold text-foreground">Pick-up at the store</span></button>
              <button type="button" role="radio" aria-checked={pickup === 'delivery'} onClick={() => setPickup('delivery')} className={choice(pickup === 'delivery')}><span className="font-semibold text-foreground">Delivery</span><span className="block text-xs text-muted-foreground">Fee by distance, worked out when saved</span></button>
            </div>
            {pickup === 'delivery' && (
              <div className="space-y-2">
                <PlaceSearch onPick={(pl) => { setStreet(pl.street); setCity(pl.city); setPin({ lat: pl.lat, lng: pl.lng }); }} />
                <LiveMap className="h-56" pins={[{ ...SHOP_SPOT, kind: 'shop', label: 'MVCA WoodWorks' }, ...(pin ? [{ ...pin, kind: 'home' as const, label: 'Customer' }] : [])]} onPick={(lat, lng) => setPin({ lat, lng })} fitKey={pin ? `${street}` : '0'} />
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                  <input value={street} onChange={(e) => setStreet(e.target.value)} className="input-dark" placeholder="House no., street, barangay" aria-label="Street" />
                  <input value={city} onChange={(e) => setCity(e.target.value)} className="input-dark" placeholder="City" aria-label="City" />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-muted-foreground">Balance paid by
                <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)} className="input-dark mt-1 w-full">
                  {(pickup === 'delivery' ? ['cod', 'store', 'online'] : ['store', 'online']).map((m) => <option key={m} value={m}>{PAYMENT_LABEL[m as PaymentMethod]}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
                <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Down payment received now
              </label>
            </div>
            <label className="block space-y-1 text-sm text-muted-foreground">Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-dark mt-1 min-h-[60px] w-full resize-none" placeholder="e.g. color, customization, preferred pick-up day" />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">Furniture total <span className="font-bold text-foreground">{peso(total)}</span>{pickup === 'delivery' ? ' + delivery fee' : ''}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2 text-sm">{busy && <Loader2 size={14} className="animate-spin" />} Place order</button>
              </div>
            </div>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          </form>
        </div>, document.body)}
    </>
  );
}
