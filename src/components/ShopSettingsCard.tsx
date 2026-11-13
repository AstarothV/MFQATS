'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { deliveryFee, type ShopSettings } from '@/lib/delivery';
import { peso } from '@/lib/money';

// Admin: where customers pick up, how much delivery costs by distance, and where they pay (migration 037).
// The database uses these numbers when it works out each order's delivery fee.
export default function ShopSettingsCard() {
  const supabase = useRef(createClient()).current;
  const [s, setS] = useState<ShopSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from('shop_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setS((data as ShopSettings) ?? null));
  }, [supabase]);

  if (!s) return null; // before migration 037, or still loading

  const set = (k: keyof ShopSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setS({ ...s, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    const nums = [s.delivery_base_fee, s.delivery_free_km, s.delivery_per_km, s.shop_lat, s.shop_lng].map(Number);
    if (nums.some((n) => !Number.isFinite(n)) || nums.slice(0, 3).some((n) => n < 0)) return setMsg({ ok: false, text: 'Check the numbers: fees and kilometers cannot be negative.' });
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('shop_settings').update({
      pickup_address: s.pickup_address.trim(), shop_lat: nums[3], shop_lng: nums[4],
      delivery_base_fee: nums[0], delivery_free_km: nums[1], delivery_per_km: nums[2],
      gcash_name: s.gcash_name.trim(), gcash_number: s.gcash_number.trim(), bank_details: s.bank_details.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setBusy(false);
    setMsg(error ? { ok: false, text: 'Could not save. Please try again.' } : { ok: true, text: 'Saved. New orders use these settings.' });
  }

  const example = (km: number) => peso(deliveryFee(km, s));
  const num = (label: string, k: keyof ShopSettings, step = '1') => (
    <label className="block space-y-1 text-sm text-muted-foreground">
      {label}
      <input type="number" min={0} step={step} value={String(s[k] ?? '')} onChange={set(k)} className="input-dark mt-1 w-full" />
    </label>
  );

  return (
    <details className="card-dark group rounded-3xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Settings2 size={16} className="text-primary dark:text-accent" /> Delivery &amp; payment settings</span>
        <ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <form onSubmit={save} className="space-y-4 border-t border-border p-5">
        <label className="block space-y-1 text-sm text-muted-foreground">
          Pick-up address (also where the delivery distance is measured from)
          <input value={s.pickup_address} onChange={set('pickup_address')} className="input-dark mt-1 w-full" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {num('Shop latitude', 'shop_lat', 'any')}
          {num('Shop longitude', 'shop_lng', 'any')}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {num('Base delivery fee (₱)', 'delivery_base_fee')}
          {num('Base fee covers the first (km)', 'delivery_free_km', '0.5')}
          {num('Each km after that (₱)', 'delivery_per_km')}
        </div>
        <p className="text-xs text-muted-foreground">Example: 3 km costs {example(3)}, 10 km costs {example(10)}, 25 km costs {example(25)}. Distance is measured in a straight line from the shop.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm text-muted-foreground">GCash account name<input value={s.gcash_name} onChange={set('gcash_name')} className="input-dark mt-1 w-full" /></label>
          <label className="block space-y-1 text-sm text-muted-foreground">GCash number<input value={s.gcash_number} onChange={set('gcash_number')} inputMode="tel" placeholder="0917 123 4567" className="input-dark mt-1 w-full" /></label>
        </div>
        <label className="block space-y-1 text-sm text-muted-foreground">
          Bank transfer details (bank, account name, account number)
          <textarea value={s.bank_details} onChange={set('bank_details')} rows={2} className="input-dark mt-1 w-full resize-none" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2 text-sm">{busy && <Loader2 size={14} className="animate-spin" />} Save settings</button>
          {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
        </div>
      </form>
    </details>
  );
}
