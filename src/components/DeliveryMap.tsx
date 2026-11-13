'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin, Maximize2, Store, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { findOnMap, type ShopSettings } from '@/lib/delivery';
import LiveMap, { type MapPin as Pin } from '@/components/LiveMap';

type MapOrder = {
  id?: string;
  pickup_type?: string | null;
  delivery_address?: string | null;
  delivery_city?: string | null;
  delivery_lat?: number | string | null;
  delivery_lng?: number | string | null;
  delivery_km?: number | string | null;
};

type Spot = { lat: number; lng: number; approx: boolean };

// Where the order goes (migration 037), on a street map inside the page: the shop and the customer's address, each
// with a pin, and the road route between them; a pick-up order shows the shop. An older order saved without a map
// position is looked up by its address (marked approximate). "Bigger map" opens a larger map over the page.
export default function DeliveryMap({ order }: { order: MapOrder | null | undefined }) {
  const supabase = useRef(createClient()).current;
  const [shop, setShop] = useState<Pick<ShopSettings, 'pickup_address' | 'shop_lat' | 'shop_lng'> | null>(null);
  const [found, setFound] = useState<Spot | null | undefined>(undefined); // looked up from the address
  const [big, setBig] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('pickup_address, shop_lat, shop_lng').eq('id', 1).maybeSingle()
      .then(({ data }) => setShop(data ?? null));
  }, [supabase]);

  const pickup = order?.pickup_type === 'pickup';
  const saved = !pickup && order?.delivery_lat != null && order?.delivery_lng != null && order.delivery_lat !== '' && order.delivery_lng !== '';
  const street = order?.delivery_address ?? '', city = order?.delivery_city ?? '';

  // an address without a saved position: find it on the map once
  useEffect(() => {
    setFound(undefined);
    if (!order || pickup || saved || !(street || city)) return;
    let live = true;
    findOnMap(street, city).then((p) => { if (live) setFound(p ? { ...p, approx: true } : null); });
    return () => { live = false; };
  }, [order?.id, pickup, saved, street, city]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!big) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [big]);

  if (!order) return null;
  const where = pickup ? (shop?.pickup_address || 'the shop') : [street, city].filter(Boolean).join(', ');
  if (!pickup && !where) return null; // an older order without an address

  const spot: Spot | null | undefined = pickup
    ? (shop ? { lat: Number(shop.shop_lat), lng: Number(shop.shop_lng), approx: false } : undefined)
    : saved ? { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng), approx: false } : found;

  const shopPin: Pin | null = shop ? { lat: Number(shop.shop_lat), lng: Number(shop.shop_lng), kind: 'shop', label: 'MVCA WoodWorks (shop)' } : null;
  const pins: Pin[] = pickup
    ? (shopPin ? [shopPin] : [])
    : [shopPin, spot ? { lat: spot.lat, lng: spot.lng, kind: 'home' as const, label: spot.approx ? `Customer (approximate): ${where}` : `Customer: ${where}` } : null].filter(Boolean) as Pin[];
  const legend = !pickup && (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#7C3AED]" /> Shop</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" /> Customer</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#7C3AED]" /> Road route</span>
    </p>
  );
  const title = pickup ? 'Pick-up location' : 'Delivery location';

  return (
    <section className="self-start rounded-2xl border border-border bg-card p-5" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {pickup ? <Store size={15} className="text-primary dark:text-accent" /> : <MapPin size={15} className="text-primary dark:text-accent" />}
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {where}{!pickup && order.delivery_km != null ? ` · ${order.delivery_km} km from the shop` : ''}
          </p>
          {spot?.approx && <p className="mt-0.5 text-xs text-muted-foreground">Approximate: placed from the address.</p>}
        </div>
        {spot && (
          <button type="button" onClick={() => setBig(true)} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Maximize2 size={13} /> Bigger map
          </button>
        )}
      </div>

      {spot ? (
        <>
          <LiveMap pins={pins} route={!pickup} />
          {legend}
        </>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          {spot === undefined ? <><Loader2 size={14} className="animate-spin" /> Finding it on the map…</> : 'This address could not be found on the map.'}
        </p>
      )}

      {big && spot && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title} onClick={() => setBig(false)}>
          <div className="flex h-full max-h-[52rem] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="truncate text-sm text-muted-foreground">{where}</p>
              </div>
              <button type="button" onClick={() => setBig(false)} aria-label="Close the map" autoFocus className="btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-1 flex-col border-t border-border p-3">
              <LiveMap pins={pins} route={!pickup} className="h-full min-h-[18rem] flex-1" />
              {legend}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
