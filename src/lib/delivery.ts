// Delivery addresses, the delivery fee and payment (migrations 037, 038, 040): suggestions of real places while an
// address is typed, the address where the customer is ("Use my location"), and the same distance, fee and down
// payment rule the database uses, so checkout can show them before the order is placed.

/** The shop (Caloocan): suggestions favour places near it until the customer shares their location. */
export const SHOP_SPOT = { lat: 14.6460477, lng: 120.9806895 };

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

export interface ShopSettings {
  pickup_address: string;
  shop_lat: number;
  shop_lng: number;
  delivery_base_fee: number;
  delivery_free_km: number;
  delivery_per_km: number;
  down_payment_percent: number;
}

/** Cash only, no online payment: the down payment is paid at the store, the balance by cash on delivery (delivery)
 *  or at the store when the furniture is picked up (pick-up). */
export type PaymentMethod = 'cod' | 'store';
export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cod: 'Cash on delivery', store: 'Cash at the store on pick-up' };
export const balanceMethod = (pickup: string | null | undefined): PaymentMethod => (pickup === 'delivery' ? 'cod' : 'store');
export const PAYMENT_STATUS_LABEL: Record<string, string> = { unpaid: 'Waiting for down payment', down_paid: 'Down payment received', paid: 'Fully paid' };

/** Straight-line distance in km, one decimal (haversine), as km_between in the database. */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/** Base fee covers the first free km; each started km after that adds the per-km rate (delivery_fee_for). */
export function deliveryFee(km: number, s: Pick<ShopSettings, 'delivery_base_fee' | 'delivery_free_km' | 'delivery_per_km'>): number {
  return Math.round(Number(s.delivery_base_fee) + Number(s.delivery_per_km) * Math.ceil(Math.max(km - Number(s.delivery_free_km), 0)));
}

/** The down payment: a percent of the furniture plus the delivery fee (as the database works it out). */
export const downPayment = (total: number, s: Pick<ShopSettings, 'down_payment_percent'>) => Math.round((total * Number(s.down_payment_percent)) / 100);

/** A real place picked from the address suggestions. */
export interface Place { key: string; title: string; detail: string; street: string; city: string; lat: number; lng: number }

// Photon (photon.komoot.io): free OpenStreetMap search made for suggestions while typing, no key. Results are kept to
// the Philippines and favour places near `near` (the customer, or the shop).
const PH_BOX = '116.9,4.5,126.7,21.2';
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };

function toPlace(f: PhotonFeature, named = true): Place | null {
  // named = false: the nearest shop or bank is not the customer's house, so only the street and area are kept
  const p = named ? f.properties : { ...f.properties, name: undefined };
  if (p.countrycode && p.countrycode !== 'PH') return null;
  const [lng, lat] = f.geometry.coordinates;
  const road = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  const area = p.district || p.locality;
  const city = p.city || p.county || p.state || '';
  const title = p.name || road || area || city;
  if (!title) return null;
  const parts = [p.name && p.name !== road ? p.name : '', road, area].filter((x, i, a) => x && a.indexOf(x) === i) as string[];
  const street = parts.join(', ') || title;
  const detail = [p.name ? road : '', area, city, p.state !== city ? p.state : ''].filter((x, i, a) => x && x !== title && a.indexOf(x) === i).join(', ');
  return { key: `${p.osm_type}${p.osm_id}`, title, detail, street, city, lat, lng };
}

/** Suggestions for what has been typed so far (at most 6, no repeats). */
export async function searchPlaces(q: string, near?: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<Place[]> {
  const at = near ?? SHOP_SPOT;
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=${PH_BOX}&lat=${at.lat}&lon=${at.lng}`, { signal });
  const feats: PhotonFeature[] = (await res.json())?.features ?? [];
  const seen = new Set<string>();
  return feats.map((f) => toPlace(f)).filter((x): x is Place => {
    if (!x) return false;
    const k = `${x.title}|${x.detail}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);
}

/** The address at a position (for "Use my location"). */
export async function placeAt(lat: number, lng: number): Promise<Place | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`);
    const f: PhotonFeature | undefined = (await res.json())?.features?.[0];
    const p = f ? toPlace(f, false) : null;
    return p ? { ...p, lat, lng } : null; // keep the phone's exact position
  } catch { return null; }
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

/** Philippine mobile numbers: typed as the 10 digits after +63 (9XX XXX XXXX). */
export const PH_MOBILE = /^9\d{9}$/;
/** Keeps only the 10 digits after +63 from what was typed or pasted (0917…, +63917…, 917…). */
export const phDigits = (s: string) => s.replace(/\D/g, '').replace(/^(63|0)(?=9)/, '').slice(0, 10);
export const phPhone = (d: string) => `+63 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
