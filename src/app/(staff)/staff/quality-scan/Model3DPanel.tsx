'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Loader2, AlertTriangle, Download, X, Maximize2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { api, postJson, shrink } from './serverApi';
import { PhotoThumbs, type PhotoSet } from './PhotoSet';

// Turns the Upload photos of a whole piece of furniture into a 3D model (TRELLIS, or Hunyuan3D as the fallback; see
// /api/model3d in src/api/yolo_server.py). It looks like the piece but has no real-world scale, so its sizes come from
// the order.

const POLL_MS = 4000;
// the dimension lines, each from the front-bottom corner hotspot to the end of one edge (see dimPoints below)
const LINES = [['dim-l', 'dim-o'], ['dim-o', 'dim-h'], ['dim-o', 'dim-w']] as const;
const DIMS = [
  { key: 'length', label: 'Length' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
] as const;
type Dims = Record<(typeof DIMS)[number]['key'], { cm: number } | null>;
const NO_DIMS: Dims = { length: null, width: null, height: null };

type V3 = { x: number; y: number; z: number };

// <model-viewer> is a web component, so React's JSX types have to be told about it (this needs a namespace)
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'shadow-intensity'?: string;
        'environment-image'?: string;
        exposure?: string;
      };
    }
  }
}

interface TaskStatus {
  status: 'running' | 'done' | 'failed';
  message: string;
  error: string | null;
  ready: boolean;
  colored: boolean;
  note: string | null; // e.g. colors were asked for but only the shape could be built
}

// The real size of the piece, since the 3D model itself is not to scale: the size of the product the customer
// ordered, the same length × width × height the shop shows.
async function loadDims(orderId: string): Promise<Dims> {
  const supabase = createClient();
  const { data: order } = await supabase.from('orders').select('products(length_cm, width_cm, height_cm)').eq('id', orderId).maybeSingle();
  const product: any = Array.isArray(order?.products) ? order?.products[0] : order?.products;
  const dims = { ...NO_DIMS };
  for (const { key } of DIMS) {
    const cm = Number(product?.[`${key}_cm`]);
    dims[key] = cm > 0 ? { cm } : null;
  }
  return dims;
}

// Builds from the order's photos taken in the Upload step (see PhotoSet.tsx).
export default function Model3DPanel({ apiUrl, orderId, set, onChangePhotos, onModel }: {
  apiUrl: string; orderId: string; set: PhotoSet; onChangePhotos: () => void;
  onModel?: (url: string | null) => void; // the finished model, for Detect Defects to show the defects on
}) {
  const photos = set.photos;
  const runRef = useRef(0); // bumps when a run starts or the panel goes away, so an old run stops polling
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<Dims>(NO_DIMS);
  const [full, setFull] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [colored, setColored] = useState(false); // the finished model has colors (so it can be shown with or without)
  const [showColors, setShowColors] = useState(true);
  const viewerRef = useRef<any>(null);
  const [showDims, setShowDims] = useState(true);
  const [bounds, setBounds] = useState<{ c: V3; s: V3 } | null>(null); // the loaded model's bounding box
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  // each material's own color picture, kept so "Shape" can take it off and "Colors" put it back without rebuilding
  const savedColors = useRef<{ texture: any; factor: number[] }[] | null>(null);

  function paint(show: boolean) {
    const materials = viewerRef.current?.model?.materials ?? [];
    materials.forEach((m: any, i: number) => {
      const saved = savedColors.current?.[i];
      if (!saved) return;
      m.pbrMetallicRoughness.baseColorTexture?.setTexture(show ? saved.texture : null);
      m.pbrMetallicRoughness.setBaseColorFactor(show ? saved.factor : [0.85, 0.85, 0.85, 1]);
    });
  }

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !modelUrl) return;
    const onLoad = () => {
      savedColors.current = (viewer.model?.materials ?? []).map((m: any) => ({
        texture: m.pbrMetallicRoughness.baseColorTexture?.texture ?? null,
        factor: [...m.pbrMetallicRoughness.baseColorFactor],
      }));
      paint(showColorsRef.current);
      setBounds({ c: viewer.getBoundingBoxCenter(), s: viewer.getDimensions() });
    };
    viewer.addEventListener('load', onLoad);
    viewer.addEventListener('camera-change', drawLines);
    return () => { viewer.removeEventListener('load', onLoad); viewer.removeEventListener('camera-change', drawLines); };
  }, [modelUrl]);

  // The three dimension lines follow the model: their ends are hotspots, and each line is redrawn between where
  // those hotspots are on screen whenever the camera moves.
  function drawLines() {
    const viewer = viewerRef.current;
    LINES.forEach(([a, b], i) => {
      const line = lineRefs.current[i];
      const p = viewer?.queryHotspot?.(`hotspot-${a}`)?.canvasPosition, q = viewer?.queryHotspot?.(`hotspot-${b}`)?.canvasPosition;
      if (!line || !p || !q) return;
      line.setAttribute('x1', p.x); line.setAttribute('y1', p.y); line.setAttribute('x2', q.x); line.setAttribute('y2', q.y);
    });
  }
  // the hotspots exist only after a render, and full screen changes the size: redraw on the next frames too
  useEffect(() => {
    let frames = 0, id = 0;
    const tick = () => { drawLines(); if (++frames < 10) id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [bounds, showDims, full]);
  const showColorsRef = useRef(showColors);
  showColorsRef.current = showColors;
  useEffect(() => { paint(showColors); }, [showColors]);

  // reload when a model appears too, so a measurement saved meanwhile shows up
  useEffect(() => {
    setDims(NO_DIMS);
    if (!orderId || !modelUrl) return;
    let cancelled = false;
    loadDims(orderId).then((d) => { if (!cancelled) setDims(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [orderId, modelUrl]);

  // Esc leaves full screen; the page behind does not scroll while it is open.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [full]);

  useEffect(() => () => { runRef.current++; }, []);
  // <model-viewer> (with three.js, the app's largest library) is loaded only once there is a model to show
  useEffect(() => { if (modelUrl) import('@google/model-viewer'); }, [modelUrl]);
  // the model is held in the browser (a blob URL), so viewing and downloading need no second trip to the server
  useEffect(() => () => { if (modelUrl) URL.revokeObjectURL(modelUrl); }, [modelUrl]);
  useEffect(() => { onModel?.(modelUrl); }, [modelUrl]);

  async function build() {
    const run = ++runRef.current;
    setBusy(true);
    setError(null);
    setModelUrl(null);
    setFull(false);
    setNote(null);
    setColored(false);
    setShowColors(true);
    setBounds(null);
    savedColors.current = null;
    setProgress('Uploading photos');
    try {
      // 1024 px is plenty (the 3D services work at about 512 px) and keeps 6 photos under the website's 4.5 MB request limit
      const images = await Promise.all(photos.map((p) => (p ? shrink(p, 1024) : null)));
      const { task } = await api<{ task: string }>(`${apiUrl}/api/model3d`, postJson({ images, color: true }));
      while (run === runRef.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const s = await api<TaskStatus>(`${apiUrl}/api/model3d/${task}`);
        if (run !== runRef.current) return;
        if (s.status === 'failed') throw new Error(s.error || 'Could not build a model from these photos.');
        if (s.status === 'done' && s.ready) {
          setProgress('Downloading the model');
          const res = await fetch(`${apiUrl}/api/model3d/${task}/model.glb`);
          if (!res.ok || res.headers.get('content-type')?.includes('text/html')) throw new Error('The finished model could not be loaded. Build it again.');
          const blob = await res.blob();
          if (run !== runRef.current) return;
          setNote(s.note);
          setColored(s.colored);
          setModelUrl(URL.createObjectURL(blob));
          break;
        }
        setProgress(s.message);
      }
    } catch (e) {
      if (run === runRef.current) setError(e instanceof Error ? e.message : 'Building the 3D model failed.');
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  const count = photos.filter(Boolean).length;
  let dimPoints: Record<string, string> = {};
  if (bounds) {
    const { c, s } = bounds, g = Math.max(s.x, s.y, s.z) * 0.04;
    const x0 = c.x - s.x / 2, x1 = c.x + s.x / 2, y0 = c.y - s.y / 2 - g, y1 = c.y + s.y / 2, z0 = c.z - s.z / 2, z1 = c.z + s.z / 2 + g;
    const pt = (x: number, y: number, z: number) => `${x}m ${y}m ${z}m`;
    dimPoints = {
      'dim-o': pt(x1 + g, y0, z1), 'dim-l': pt(x0, y0, z1), 'dim-h': pt(x1 + g, y1, z1), 'dim-w': pt(x1 + g, y0, z0),
      'lab-length': pt(c.x, y0, z1), 'lab-height': pt(x1 + g, c.y, z1), 'lab-width': pt(x1 + g, y0, c.z),
    };
  }
  const dimText = (key: (typeof DIMS)[number]['key'], label: string) => {
    const d = dims[key];
    return d ? `${label[0]} ${d.cm.toFixed(1)} cm` : label;
  };
  const needsFront = count > 1 && !photos[0]; // several views are built around the front one

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Uses the Upload photos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {count === 0 ? 'No photos yet: add them in step 1.' : `${count} of 6 photos. The model is in color and can be shown without its colors. It is not to scale.`}
            </p>
          </div>
          <button onClick={onChangePhotos} disabled={busy} className="btn-secondary text-sm">{count === 0 ? 'Add photos' : 'Change photos'}</button>
        </div>
        {count > 0 && <div className="mt-3"><PhotoThumbs set={set} /></div>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={build} disabled={busy || count === 0 || needsFront} className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Box size={16} />} {busy ? 'Building…' : 'Build 3D model'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">About a minute.</p>

      {needsFront && <p className="text-sm text-warning">With more than one photo, add a front photo too.</p>}

      {busy && (
        <div>
          <div role="progressbar" aria-label="3D model progress" className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full animate-pulse bg-primary" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{progress}. This usually takes 20 seconds to 2 minutes; keep this page open.</p>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-foreground">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {modelUrl && (
        <div className="space-y-2">
          {note && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" /> {note}
            </div>
          )}
          <div
            role={full ? 'dialog' : undefined}
            aria-modal={full || undefined}
            aria-label={full ? '3D model in full screen' : undefined}
            className={full ? 'fixed inset-0 z-[100] bg-[#0b0b0f]' : 'relative'}
          >
            <model-viewer
              ref={viewerRef}
              src={modelUrl}
              alt="3D model of the furniture. Drag to turn it."
              camera-controls
              auto-rotate
              camera-orbit="0deg 75deg 130%"
              max-camera-orbit="auto auto 300%"
              shadow-intensity="1"
              environment-image="neutral"
              exposure="1.3"
              style={{ width: '100%', height: full ? '100%' : 480, background: '#0b0b0f', borderRadius: full ? 0 : 12 }}
            >
              {bounds && showDims && (
                <>
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                    {LINES.map((_, i) => (
                      <line key={i} ref={(el) => { lineRefs.current[i] = el; }} stroke="#fff" strokeWidth={2} strokeDasharray="1 0" strokeLinecap="round" />
                    ))}
                  </svg>
                  {Object.entries(dimPoints).filter(([name]) => name.startsWith('dim-')).map(([name, pos]) => (
                    <div key={`${name}${pos}`} slot={`hotspot-${name}`} data-position={pos} className="pointer-events-none h-0 w-0" />
                  ))}
                  {DIMS.map(({ key, label }) => (
                    <div key={`${key}${dimPoints[`lab-${key}`]}`} slot={`hotspot-lab-${key}`} data-position={dimPoints[`lab-${key}`]}
                      className="pointer-events-none whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1F1A2B] shadow">
                      {dimText(key, label)}
                    </div>
                  ))}
                </>
              )}
            </model-viewer>
            {!showDims && DIMS.some(({ key }) => dims[key]) && (
              <div className="pointer-events-none absolute left-3 top-16 rounded-xl bg-black/70 px-3 py-2 text-xs text-white">
                <p className="mb-1 font-semibold uppercase tracking-wider text-white/70">Ordered size</p>
                {DIMS.map(({ key, label }) => dims[key] && (
                  <p key={key}>{label}: <span className="font-semibold">{dims[key]!.cm.toFixed(1)} cm</span></p>
                ))}
              </div>
            )}
            {colored && (
              <div role="group" aria-label="Show the model" className="absolute bottom-3 left-3 flex gap-1 rounded-xl bg-black/70 p-1">
                {[
                  { on: true, label: 'Colors' },
                  { on: false, label: 'Shape' },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setShowColors(o.on)}
                    aria-pressed={showColors === o.on}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${showColors === o.on ? 'bg-primary text-primary-foreground' : 'text-white/70 hover:text-white'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <div role="group" aria-label="Show on the model" className="absolute left-3 top-3 flex flex-wrap gap-1 rounded-xl bg-black/70 p-1">
              <button
                onClick={() => setShowDims(!showDims)}
                aria-pressed={showDims}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${showDims ? 'bg-primary text-primary-foreground' : 'text-white/70 hover:text-white'}`}
              >
                Dimensions
              </button>
            </div>
            <button
              onClick={() => setFull(!full)}
              aria-label={full ? 'Exit full screen' : 'Show the 3D model in full screen'}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
            >
              {full ? <X size={18} /> : <Maximize2 size={16} />}
            </button>
          </div>
          {!orderId && <p className="text-xs text-muted-foreground">Select an order at the top to show the size the customer ordered on the model.</p>}
          {showDims && orderId && (
            <p className="text-xs text-muted-foreground">
              The sizes are the ones in the customer&apos;s order (the same as in the shop). The model itself is not to scale; the lines show where each size runs.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Drag to turn, scroll or pinch to zoom.</p>
            <a href={modelUrl} download="mfqats-3d-model.glb" className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Download .glb
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
