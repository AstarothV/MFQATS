'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Camera, Images, Loader2, AlertTriangle, Download, X, Maximize2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { api, postJson, shrink } from './ReconstructPanel';

// Turns 1–4 photos of a whole piece of furniture into a 3D model (image-to-3D with Hunyuan3D-2mv, see
// /api/model3d in src/api/yolo_server.py). It looks like the piece but has no real-world scale: measure with the
// marker panels, view with this one.

const VIEWS = ['Front', 'Left', 'Back', 'Right'] as const; // the server's slot order
const POLL_MS = 4000;
const DIMS = [
  { key: 'length', label: 'Length' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
] as const;
type Dims = Record<(typeof DIMS)[number]['key'], { cm: number; measured: boolean } | null>;
const NO_DIMS: Dims = { length: null, width: null, height: null };

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
        'shadow-intensity'?: string;
      };
    }
  }
}

interface TaskStatus {
  status: 'running' | 'done' | 'failed';
  message: string;
  error: string | null;
  ready: boolean;
}

// The real size of the piece, since the 3D model itself is not to scale: the latest saved measurement of each
// dimension for the order (Measure Dimensions), else the size the product was ordered in.
async function loadDims(orderId: string): Promise<Dims> {
  const supabase = createClient();
  const [{ data: rows }, { data: order }] = await Promise.all([
    supabase.from('measurements').select('length_cm, width_cm, height_cm').eq('order_id', orderId).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select('products(length_cm, width_cm, height_cm)').eq('id', orderId).maybeSingle(),
  ]);
  const product: any = Array.isArray(order?.products) ? order?.products[0] : order?.products;
  const dims = { ...NO_DIMS };
  for (const { key } of DIMS) {
    const measured = rows?.map((r: any) => Number(r[`${key}_cm`])).find((v) => v > 0);
    const ordered = Number(product?.[`${key}_cm`]);
    dims[key] = measured ? { cm: measured, measured: true } : ordered > 0 ? { cm: ordered, measured: false } : null;
  }
  return dims;
}

export default function Model3DPanel({ apiUrl, orderId }: { apiUrl: string; orderId: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);
  const runRef = useRef(0); // bumps when a run starts or the panel goes away, so an old run stops polling
  const [photos, setPhotos] = useState<(File | null)[]>(VIEWS.map(() => null));
  const [previews, setPreviews] = useState<(string | null)[]>(VIEWS.map(() => null));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<Dims>(NO_DIMS);
  const [full, setFull] = useState(false);

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

  useEffect(() => {
    import('@google/model-viewer'); // registers <model-viewer>; browser-only
    return () => { runRef.current++; };
  }, []);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach((p) => p && URL.revokeObjectURL(p)), []);
  // the model is held in the browser (a blob URL), so viewing and downloading need no second trip to the server
  useEffect(() => () => { if (modelUrl) URL.revokeObjectURL(modelUrl); }, [modelUrl]);

  function pick(slot: number, from: 'camera' | 'library') {
    slotRef.current = slot;
    (from === 'camera' ? cameraRef : libraryRef).current?.click();
  }

  function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // so the same photo can be chosen again
    if (f) setSlot(slotRef.current, f);
  }

  function setSlot(slot: number, file: File | null) {
    const old = previews[slot];
    if (old) URL.revokeObjectURL(old);
    setPhotos((ps) => ps.map((p, i) => (i === slot ? file : p)));
    setPreviews((ps) => ps.map((p, i) => (i === slot ? (file ? URL.createObjectURL(file) : null) : p)));
  }

  async function build() {
    const run = ++runRef.current;
    setBusy(true);
    setError(null);
    setModelUrl(null);
    setFull(false);
    setProgress('Uploading photos');
    try {
      const images = await Promise.all(photos.map((p) => (p ? shrink(p) : null)));
      const { task } = await api<{ task: string }>(`${apiUrl}/api/model3d`, postJson({ images }));
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
  const needsFront = count > 1 && !photos[0]; // several views are built around the front one

  return (
    <div className="card-dark rounded-3xl border border-border p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Box size={16} className="text-accent" /> 3D Model
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Take 1 to 4 photos of the whole piece on a plain background. One photo works; front plus more sides works better. The system turns them into a
          3D model of its shape (no colours) you can turn and zoom. It is not to scale: use Measure Dimensions for sizes.
        </p>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPicked} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onPicked} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {VIEWS.map((view, i) => (
          <div key={view} className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-border bg-muted">
            {previews[i] ? (
              <img src={previews[i]!} alt={`${view} photo`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-2">
                <span className="text-sm font-semibold text-muted-foreground">{view}</span>
                <div className="flex gap-2">
                  <button onClick={() => pick(i, 'camera')} disabled={busy} aria-label={`Take ${view.toLowerCase()} photo with the camera`} className="flex flex-col items-center gap-1 rounded-lg bg-background/60 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                    <Camera size={18} /> Camera
                  </button>
                  <button onClick={() => pick(i, 'library')} disabled={busy} aria-label={`Choose ${view.toLowerCase()} photo from photos`} className="flex flex-col items-center gap-1 rounded-lg bg-background/60 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                    <Images size={18} /> Photos
                  </button>
                </div>
              </div>
            )}
            {previews[i] && (
              <>
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{view}</span>
                <button
                  onClick={() => setSlot(i, null)}
                  disabled={busy}
                  aria-label={`Remove ${view.toLowerCase()} photo`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <button onClick={build} disabled={busy || count === 0 || needsFront} className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Box size={16} />} {busy ? 'Building…' : 'Build 3D model'}
      </button>

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
          <div
            role={full ? 'dialog' : undefined}
            aria-modal={full || undefined}
            aria-label={full ? '3D model in full screen' : undefined}
            className={full ? 'fixed inset-0 z-[100] bg-[#0b0b0f]' : 'relative'}
          >
            <model-viewer
              src={modelUrl}
              alt="3D model of the furniture. Drag to turn it."
              camera-controls
              auto-rotate
              shadow-intensity="1"
              style={{ width: '100%', height: full ? '100%' : 480, background: '#0b0b0f', borderRadius: full ? 0 : 12 }}
            />
            {DIMS.some(({ key }) => dims[key]) && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-black/70 px-3 py-2 text-xs text-white">
                <p className="mb-1 font-semibold uppercase tracking-wider text-white/70">Real size</p>
                {DIMS.map(({ key, label }) => dims[key] && (
                  <p key={key}>
                    {label}: <span className="font-semibold">{dims[key]!.cm.toFixed(1)} cm</span>{' '}
                    <span className="text-white/60">({dims[key]!.measured ? 'measured' : 'ordered'})</span>
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={() => setFull(!full)}
              aria-label={full ? 'Exit full screen' : 'Show the 3D model in full screen'}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
            >
              {full ? <X size={18} /> : <Maximize2 size={16} />}
            </button>
          </div>
          {!orderId && <p className="text-xs text-muted-foreground">Select an order at the top to show the piece&apos;s real measurements on the model.</p>}
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
