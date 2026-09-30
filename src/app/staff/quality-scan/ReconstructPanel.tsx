'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Images, Loader2, AlertTriangle, Play, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { SurfaceResultView, deviationColor, type SurfaceResponse } from './SurfacePanel';

// Builds a 3D model of one surface from several photos (Structure from Motion, see src/api/sfm.py), then runs the
// dent / warp check on it. Every photo must show the printed marker, which gives the model its real size.

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 24;
const MAX_PHOTO_PX = 2000; // long side sent to the server
const POLL_MS = 2000;
const VIEW_W = 800;
const VIEW_H = 560;

interface Model {
  count: number;
  positions: number[]; // x, y, z, ... in mm; z is up off the surface
  colors: number[]; // r, g, b, ... 0–255
  deviations: number[]; // mm from the fitted plane, negative = below
}

interface ReconstructResult {
  model: Model;
  surface: SurfaceResponse;
  total_points: number;
  photos_used: number;
  photos_skipped: number[];
  mean_error_px: number;
}

interface JobStatus {
  status: 'collecting' | 'running' | 'done' | 'failed';
  progress: number;
  message: string;
  error: string | null;
  result: ReconstructResult | null;
}

const SERVER_DOWN = 'Could not reach the reconstruction server. Make sure the Python server is running.';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(SERVER_DOWN);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (res.redirected || (res.ok && !isJson)) throw new Error('Your session has expired. Please log in again.');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (!body && res.status >= 500) throw new Error(SERVER_DOWN);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Reconstruction failed (HTTP ${res.status})`);
  }
  return body;
}

const postJson = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Photo file -> JPEG data URL, scaled down so uploads stay small.
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PHOTO_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`"${file.name}" is not a photo the browser can open.`)); };
    img.src = url;
  });
}

// The 3D model as points: drag to turn it, buttons or the mouse wheel to zoom.
function ModelViewer({ model, toleranceMm, colorBy }: { model: Model; toleranceMm: number; colorBy: 'photo' | 'deviation' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState({ yaw: 0.6, pitch: 0.95, zoom: 1 });

  const colors = useMemo(() => Array.from({ length: model.count }, (_, i) =>
    colorBy === 'deviation'
      ? deviationColor(model.deviations[i], toleranceMm)
      : `rgb(${model.colors[3 * i]},${model.colors[3 * i + 1]},${model.colors[3 * i + 2]})`), [model, toleranceMm, colorBy]);

  // centre of the model and the scale that fits it in the view
  const frame = useMemo(() => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < model.positions.length; i++) {
      const a = i % 3;
      if (model.positions[i] < min[a]) min[a] = model.positions[i];
      if (model.positions[i] > max[a]) max[a] = model.positions[i];
    }
    const centre = min.map((v, a) => (v + max[a]) / 2);
    const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;
    return { centre, scale: (Math.min(VIEW_W, VIEW_H) / 2 - 10) / radius };
  }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0b0b0f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const [cy, sy, cp, sp] = [Math.cos(view.yaw), Math.sin(view.yaw), Math.cos(view.pitch), Math.sin(view.pitch)];
    const k = frame.scale * view.zoom;
    const p = model.positions;
    for (let i = 0; i < model.count; i++) {
      const x = p[3 * i] - frame.centre[0];
      const y = p[3 * i + 1] - frame.centre[1];
      const z = p[3 * i + 2] - frame.centre[2];
      const x1 = x * cy - y * sy; // turn about the surface's up axis
      const y1 = x * sy + y * cy;
      ctx.fillStyle = colors[i];
      ctx.fillRect(VIEW_W / 2 + x1 * k - 1, VIEW_H / 2 - (y1 * sp + z * cp) * k - 1, 2, 2); // pitch: 0 = side view, 90° = from above
    }
  }, [model, colors, frame, view]);

  // the wheel zooms the model instead of scrolling the page (needs a non-passive listener)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: Math.min(20, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))) }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (f: number) => setView((v) => ({ ...v, zoom: Math.min(20, Math.max(0.3, v.zoom * f)) }));

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        role="img"
        aria-label="3D model of the surface. Drag to turn it."
        className="w-full rounded-xl touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => {
          const last = dragRef.current;
          if (!last) return;
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          dragRef.current = { x: e.clientX, y: e.clientY };
          setView((v) => ({ ...v, yaw: v.yaw + dx * 0.01, pitch: Math.min(Math.PI / 2, Math.max(0, v.pitch + dy * 0.01)) }));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      />
      <div className="absolute right-2 top-2 flex gap-1">
        <button onClick={() => zoomBy(1.3)} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><ZoomIn size={16} /></button>
        <button onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><ZoomOut size={16} /></button>
        <button onClick={() => setView({ yaw: 0.6, pitch: 0.95, zoom: 1 })} aria-label="Reset view" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><RotateCcw size={16} /></button>
      </div>
    </div>
  );
}

export default function ReconstructPanel({ apiUrl }: { apiUrl: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0); // bumps when a run is started or the panel goes away, so an old run stops polling
  const [files, setFiles] = useState<File[]>([]);
  const [markerMm, setMarkerMm] = useState('150');
  const [toleranceMm, setToleranceMm] = useState('2');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ fraction: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconstructResult | null>(null);
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [colorBy, setColorBy] = useState<'photo' | 'deviation'>('deviation');

  useEffect(() => () => { runRef.current++; }, []);

  async function start() {
    const run = ++runRef.current;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { job } = await api<{ job: string }>(`${apiUrl}/api/reconstruct`, { method: 'POST' });
      for (let i = 0; i < files.length; i++) {
        if (run !== runRef.current) return;
        setProgress({ fraction: (0.1 * i) / files.length, message: `Uploading photo ${i + 1} of ${files.length}` });
        await api(`${apiUrl}/api/reconstruct/${job}/photo`, postJson({ image: await shrink(files[i]) }));
      }
      await api(`${apiUrl}/api/reconstruct/${job}/run`, postJson({ marker_mm: Number(markerMm) || 150, tolerance_mm: Number(toleranceMm) || 2 }));
      while (run === runRef.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const status = await api<JobStatus>(`${apiUrl}/api/reconstruct/${job}`);
        if (run !== runRef.current) return;
        if (status.status === 'failed') throw new Error(status.error || 'Reconstruction failed.');
        if (status.status === 'done' && status.result) { setResult(status.result); break; }
        setProgress({ fraction: 0.1 + 0.9 * status.progress, message: status.message }); // uploads were the first 10%
      }
    } catch (e) {
      if (run === runRef.current) setError(e instanceof Error ? e.message : 'Reconstruction failed.');
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  const toggle = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="card-dark rounded-3xl border border-border p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Box size={16} className="text-accent" /> 3D Reconstruction
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Lay the printed marker flat on the surface. Take 8 to 15 photos while moving around it, a small step each time,
          with the marker and the surface in every photo and no zoom. The system builds a 3D model and checks it for dents and warping.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS)); e.target.value = ''; }}
        />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
          <Images size={16} /> {files.length ? `${files.length} photos chosen` : 'Choose photos'}
        </button>
        <label className="text-xs text-muted-foreground">
          <span className="block mb-1 uppercase tracking-wider">Marker size (mm)</span>
          <input type="number" min={10} max={2000} value={markerMm} onChange={(e) => setMarkerMm(e.target.value)} className="input-dark w-28" />
        </label>
        <label className="text-xs text-muted-foreground">
          <span className="block mb-1 uppercase tracking-wider">Tolerance (mm)</span>
          <input type="number" min={0.1} max={100} step={0.1} value={toleranceMm} onChange={(e) => setToleranceMm(e.target.value)} className="input-dark w-28" />
        </label>
        <button onClick={start} disabled={busy || files.length < MIN_PHOTOS} className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {busy ? 'Building…' : 'Build 3D model'}
        </button>
      </div>
      {files.length > 0 && files.length < MIN_PHOTOS && <p className="text-sm text-warning">Choose at least {MIN_PHOTOS} photos.</p>}

      {busy && (
        <div>
          <div
            role="progressbar"
            aria-label="Reconstruction progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{progress.message}. This can take several minutes; keep this page open.</p>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-foreground">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              <button onClick={() => setMode('3d')} aria-pressed={mode === '3d'} className={toggle(mode === '3d')}>3D model</button>
              <button onClick={() => setMode('2d')} aria-pressed={mode === '2d'} className={toggle(mode === '2d')}>2D map</button>
            </div>
            {mode === '3d' && (
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                <button onClick={() => setColorBy('deviation')} aria-pressed={colorBy === 'deviation'} className={toggle(colorBy === 'deviation')}>Deviation</button>
                <button onClick={() => setColorBy('photo')} aria-pressed={colorBy === 'photo'} className={toggle(colorBy === 'photo')}>Photo colours</button>
              </div>
            )}
          </div>

          {mode === '3d' && (
            <div>
              <ModelViewer model={result.model} toleranceMm={result.surface.tolerance_mm} colorBy={colorBy} />
              <p className="mt-2 text-xs text-muted-foreground">
                Drag to turn the model. In Deviation colours, green is on the plane, yellow is at the tolerance, red is twice the tolerance or more.
              </p>
            </div>
          )}

          <SurfaceResultView
            result={result.surface}
            showMap={mode === '2d'}
            caption={`${result.total_points.toLocaleString()} 3D points from ${result.photos_used} photos${
              result.photos_skipped.length ? ` (marker not found in photo ${result.photos_skipped.join(', ')})` : ''
            }`}
          />
        </div>
      )}
    </div>
  );
}
