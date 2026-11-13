// Delivery addresses (migrations 037, 038): suggestions of real places while an address is typed, and the address
// where the customer is ("Use my location"). Payment and delivery methods are a future recommendation (Chapter 6).

/** The shop (Caloocan): suggestions favour places near it until the customer shares their location. */
export const SHOP_SPOT = { lat: 14.6460477, lng: 120.9806895 };

export interface SavedAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  phone: string;
  is_default: boolean;
}

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
