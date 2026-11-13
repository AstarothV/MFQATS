'use client';

import React, { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapPin = { lat: number; lng: number; kind: 'shop' | 'home'; label: string };

// The map layers to choose from, like Google Maps' layer button. All free and without a key; each shows its credit.
type Style = 'street' | 'satellite' | 'terrain';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const STYLES: Record<Style, { label: string; maxZoom: number; tiles: { url: string; attribution?: string }[] }> = {
  street: { label: 'Map', maxZoom: 19, tiles: [
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' },
  ] },
  satellite: { label: 'Satellite', maxZoom: 19, tiles: [
    { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
    { url: `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}` }, // roads on top of the photo
    { url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` }, // place names
  ] },
  terrain: { label: 'Terrain', maxZoom: 17, tiles: [
    { url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA), &copy; OpenStreetMap' },
  ] },
};
const STYLE_KEY = 'mfqats-map-style';
const savedStyle = (): Style => { try { const s = localStorage.getItem(STYLE_KEY); return s === 'satellite' || s === 'terrain' ? s : 'street'; } catch { return 'street'; } };

// one tile of a layer around a point, for the layer button's picture
function tileOf(style: Style, lat: number, lng: number, z: number) {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return STYLES[style].tiles[0].url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

// A real street map (OpenStreetMap tiles drawn by Leaflet: plain images, so it works without WebGL) with the shop and
// customer pins, and a layer button (Map, Satellite, Terrain) like Google Maps; the choice is remembered on the device. `route` draws the road route between the first two pins (OSRM; a dashed straight line if it is not
// available). `onPick` makes the home pin draggable, and a tap on the map moves it there. `fitKey`: the map re-frames
// its pins only when this changes (not while a pin is being dragged).
export default function LiveMap({ pins, route = false, onPick, fitKey, className = 'h-64 sm:h-80' }: {
  pins: MapPin[];
  route?: boolean;
  onPick?: (lat: number, lng: number) => void;
  fitKey?: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [ready, setReady] = React.useState(false);
  const [style, setStyle] = React.useState<Style>('street');
  const [layersOpen, setLayersOpen] = React.useState(false);
  const base = useRef<Leaflet.TileLayer[]>([]);
  useEffect(() => { setStyle(savedStyle()); }, []);

  // the map itself, once (Leaflet needs the browser, so it is loaded here)
  useEffect(() => {
    let gone = false;
    import('leaflet').then((mod) => {
      if (gone || !box.current) return;
      const lf = (mod.default ?? mod) as typeof Leaflet;
      L.current = lf;
      const m = lf.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      m.on('click', (e: Leaflet.LeafletMouseEvent) => pick.current?.(e.latlng.lat, e.latlng.lng));
      m.on('focus', () => m.scrollWheelZoom.enable());
      m.on('blur', () => m.scrollWheelZoom.disable());
      layer.current = lf.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => { gone = true; map.current?.remove(); map.current = null; };
  }, []);

  // the chosen layer's tiles (the pins and route stay on top)
  useEffect(() => {
    const lf = L.current, m = map.current;
    if (!ready || !lf || !m) return;
    base.current.forEach((l) => l.remove());
    const s = STYLES[style];
    base.current = s.tiles.map((tl) => lf.tileLayer(tl.url, { maxZoom: s.maxZoom, maxNativeZoom: s.maxZoom, attribution: tl.attribution }).addTo(m));
    m.setMaxZoom(s.maxZoom);
  }, [ready, style]);

  function choose(s: Style) {
    setStyle(s);
    setLayersOpen(false);
    try { localStorage.setItem(STYLE_KEY, s); } catch { /* private mode: not remembered */ }
  }

  // the pins and the route
  const pinKey = pins.map((p) => `${p.kind}:${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
  useEffect(() => {
    const lf = L.current, m = map.current, g = layer.current;
    if (!ready || !lf || !m || !g) return;
    g.clearLayers();
    for (const p of pins) {
      const marker = lf.marker([p.lat, p.lng], { icon: pinIcon(lf, p.kind), draggable: p.kind === 'home' && !!onPick, title: p.label, keyboard: true })
        .bindTooltip(p.label, { direction: 'top', offset: [0, -38] })
        .addTo(g);
      if (p.kind === 'home' && onPick) marker.on('dragend', () => { const ll = marker.getLatLng(); pick.current?.(ll.lat, ll.lng); });
    }
    let stale = false;
    if (route && pins.length >= 2) {
      const [a, b] = pins;
      const straight = () => lf.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#7C3AED', weight: 3, dashArray: '6 8', opacity: 0.8 }).addTo(g);
      fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`)
        .then((r) => r.json())
        .then((j) => {
          if (stale) return;
          const coords: [number, number][] | undefined = j?.routes?.[0]?.geometry?.coordinates;
          if (!coords?.length) return straight();
          lf.polyline(coords.map(([x, y]) => [y, x] as [number, number]), { color: '#7C3AED', weight: 5, opacity: 0.85 }).addTo(g);
        })
        .catch(() => { if (!stale) straight(); });
    }
    return () => { stale = true; };
  }, [ready, pinKey, route]); // eslint-disable-line react-hooks/exhaustive-deps

  // frame the pins
  useEffect(() => {
    const lf = L.current, m = map.current;
    if (!ready || !lf || !m || pins.length === 0) return;
    if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], 16);
    else m.fitBounds(lf.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 16 });
  }, [ready, fitKey ?? pinKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // the layer button's pictures show the part of the map being looked at
  // (a map that has no view yet throws when asked, so it is asked only once it has one)
  const shown = map.current && (map.current as unknown as { _loaded?: boolean })._loaded ? map.current : null;
  const c = shown?.getCenter() ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 14.646, lng: 120.98 });
  const z = Math.min(Math.max(Math.round(shown?.getZoom() ?? 13), 3), 15);
  const thumb = (s: Style) => tileOf(s, c.lat, c.lng, z);
  const other: Style = style === 'street' ? 'satellite' : 'street';

  return (
    <div className={`map-${style} relative w-full ${className}`}>
      {/* the style class sits here, not on the map box: Leaflet adds its own classes to that box, and React would wipe them */}
      <div ref={box} className="relative z-0 h-full w-full overflow-hidden rounded-xl border border-border bg-muted" role="application" aria-label="Map" />
      {/* layers, bottom-left like Google Maps */}
      <div className="absolute bottom-3 left-3 z-[500] flex items-end gap-2">
        <button type="button" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} aria-label="Map layers"
          className="group relative h-16 w-16 overflow-hidden rounded-xl border-2 border-white shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 dark:border-white/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(layersOpen ? style : other)} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-0.5 text-[10px] font-semibold text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m12 2 10 6-10 6L2 8z"/><path d="m2 16 10 6 10-6"/></svg>
            Layers
          </span>
        </button>
        {layersOpen && (
          <div role="radiogroup" aria-label="Map type" className="flex gap-2 rounded-2xl bg-card/95 p-2 shadow-xl ring-1 ring-border backdrop-blur">
            {(Object.keys(STYLES) as Style[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={style === s} onClick={() => choose(s)} className="flex w-14 flex-col items-center gap-1 text-[11px] font-medium text-foreground">
                <span className={`block h-12 w-12 overflow-hidden rounded-lg ring-2 transition ${style === s ? 'ring-primary' : 'ring-transparent hover:ring-border'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(s)} alt="" className="h-full w-full object-cover" />
                </span>
                <span className={style === s ? 'text-primary dark:text-accent' : 'text-muted-foreground'}>{STYLES[s].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// a map pin: violet with a shop icon, or green with a house icon
function pinIcon(lf: typeof Leaflet, kind: MapPin['kind']) {
  const color = kind === 'shop' ? '#7C3AED' : '#16A34A';
  const glyph = kind === 'shop'
    ? '<path d="M7 10h10v6H7z M6 10l1.5-4h9L18 10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>'
    : '<path d="M7 11.5 12 7.5l5 4V16H7z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M10.5 16v-2.6h3V16" stroke="#fff" stroke-width="1.6" fill="none"/>';
  return lf.divIcon({
    className: '',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    html: `<svg width="34" height="44" viewBox="0 0 24 31" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 31 12 31s12-10.5 12-19.3C24 5.2 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>${glyph}</svg>`,
  });
}
