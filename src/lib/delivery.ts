// Delivery and payment: the same distance and fee rule the database uses (migration 037, km_between / delivery_fee_for),
// so checkout can show the fee before the order is placed. The database works it out again when the order is saved.

export type PaymentMethod = 'cash' | 'gcash' | 'bank_transfer';
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash (pay on delivery or pick-up)',
  gcash: 'GCash',
  bank_transfer: 'Bank transfer',
};

/** The shop on the map (migration 037 default; the admin can move it in the settings). */
export const SHOP_SPOT = { lat: 14.6460477, lng: 120.9806895 };

export interface ShopSettings {
  pickup_address: string;
  shop_lat: number;
  shop_lng: number;
  delivery_base_fee: number;
  delivery_free_km: number;
  delivery_per_km: number;
  gcash_name: string;
  gcash_number: string;
  bank_details: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

/** Straight-line distance in km, one decimal (haversine). */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/** Base fee covers the first free km; each started km after that adds the per-km rate. */
export function deliveryFee(km: number, s: Pick<ShopSettings, 'delivery_base_fee' | 'delivery_free_km' | 'delivery_per_km'>): number {
  return Math.round(Number(s.delivery_base_fee) + Number(s.delivery_per_km) * Math.ceil(Math.max(km - Number(s.delivery_free_km), 0)));
}

/**
 * Finds an address on OpenStreetMap (free, no key). Null when it cannot be found. Tries the whole address, then
 * without the house number, then just the area at its end ("Tondo Manila"), then the city: the first hit wins.
 */
export async function findOnMap(street: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const s = street.trim(), c = city.trim();
  const noNumber = s.replace(/^\s*[\d\-/]+\s*/, '');
  const area = s.split(',').map((x) => x.trim()).filter(Boolean).slice(1).join(', ');
  const tries = [...new Set([[s, c], [noNumber, c], [area, c], [c]].map((p) => p.filter(Boolean).join(', ')).filter(Boolean))];
  for (const q of tries.slice(0, 4)) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(`${q}, Philippines`)}`, { headers: { Accept: 'application/json' } });
      const hit = (await res.json())?.[0];
      if (hit) return { lat: Number(hit.lat), lng: Number(hit.lon) };
    } catch { return null; } // offline or blocked: the shop confirms the fee
  }
  return null;
}

/** The phone's own location (asks permission). */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser cannot share its location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Location was not shared. Allow it in the browser, or type the address.')),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
