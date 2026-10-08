'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Layers, Upload, Loader2, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

// Checks a 3D point cloud of one surface for dents and warping (RANSAC plane + point-to-plane distance,
// see src/api/surface.py) and shows where the surface leaves the flat plane.

interface Region {
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  side: 'below' | 'above' | null;
}

export interface SurfaceResponse {
  status: 'flat' | 'dent' | 'warp';
  message: string;
  tolerance_mm: number;
  max_deviation_mm: number;
  out_of_tolerance_percent: number;
  regions: Region[];
  points: number;
  inlier_percent: number;
  noise_mm: number;
  size_mm: [number, number];
  grid: (number | null)[][];
  warnings: string[];
  low_confidence: boolean;
}

const MAX_REGIONS_SHOWN = 5;

// Green at the plane, yellow at the tolerance, red at twice the tolerance or more.
export const deviationColor = (mm: number, toleranceMm: number) =>
  `hsl(${120 * (1 - Math.min(1, Math.abs(mm) / (2 * toleranceMm)))}, 80%, 45%)`;

// Verdict, numbers, deviation map and out-of-tolerance areas of one surface check (also used by the 3D reconstruction panel).
export function SurfaceResultView({ result, caption, showMap = true }: { result: SurfaceResponse; caption?: string; showMap?: boolean }) {
  const mapRef = useRef<HTMLCanvasElement>(null);

  // Deviation map: one canvas pixel per cell.
  useEffect(() => {
    const canvas = mapRef.current;
    if (!canvas) return;
    const rows = result.grid.length;
    const cols = result.grid[0]?.length ?? 0;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, cols, rows);
    result.grid.forEach((row, y) => row.forEach((value, x) => {
      if (value === null) return;
      ctx.fillStyle = deviationColor(value, result.tolerance_mm);
      ctx.fillRect(x, y, 1, 1);
    }));
  }, [result, showMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge variant={result.status === 'flat' ? 'ok' : 'danger'} label={result.message} />
        {caption && <span className="text-sm text-muted-foreground truncate">{caption}</span>}
      </div>

      {result.warnings.length > 0 && (
        <div role="status" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle size={15} className="text-warning" /> Low confidence. Check this surface by hand.</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {result.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ['Largest deviation', `${result.max_deviation_mm.toFixed(1)} mm`],
          ['Tolerance', `${result.tolerance_mm} mm`],
          ['Area out of tolerance', `${result.out_of_tolerance_percent}%`],
          ['Surface size', `${Math.round(result.size_mm[0])} × ${Math.round(result.size_mm[1])} mm`],
          ['Points', result.points.toLocaleString()],
          ['Points on the plane', `${result.inlier_percent}%`],
          ['Scan noise', `${result.noise_mm} mm`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {showMap && (
        <div>
          <canvas
            ref={mapRef}
            role="img"
            aria-label={`Deviation map of the surface: ${result.message}`}
            className="w-full max-w-xl rounded-xl bg-black [image-rendering:pixelated]"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Deviation map, seen from above. Green is on the plane, yellow is at the tolerance, red is twice the tolerance or more.
          </p>
        </div>
      )}

      {result.regions.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold text-foreground mb-1">Out-of-tolerance areas</p>
          <ul className="space-y-1 text-muted-foreground">
            {result.regions.slice(0, MAX_REGIONS_SHOWN).map((r, i) => (
              <li key={i}>
                {r.depth_mm.toFixed(1)} mm {r.side === 'above' ? 'raised' : 'deep'}, about {Math.round(r.width_mm)} × {Math.round(r.height_mm)} mm, centred {Math.round(r.x_mm)} mm from the left and {Math.round(r.y_mm)} mm from the top of the map
              </li>
            ))}
            {result.regions.length > MAX_REGIONS_SHOWN && <li>and {result.regions.length - MAX_REGIONS_SHOWN} smaller areas</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function SurfacePanel({ apiUrl }: { apiUrl: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState('mm');
  const [toleranceMm, setToleranceMm] = useState('2');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SurfaceResponse | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same file can be chosen again
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    form.append('unit', unit);
    form.append('tolerance_mm', toleranceMm || '2');
    try {
      let res: Response;
      try {
        res = await fetch(`${apiUrl}/api/surface`, { method: 'POST', body: form });
      } catch {
        throw new Error('Could not reach the analysis server. Make sure the Python server is running.');
      }
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.redirected || (res.ok && !isJson)) throw new Error('Your session has expired. Please log in again.');
      const body = isJson ? await res.json().catch(() => null) : null;
      if (!res.ok) {
        if (!body && res.status >= 500) throw new Error('Could not reach the analysis server. Make sure the Python server is running.');
        throw new Error(typeof body?.detail === 'string' ? body.detail : `Surface check failed (HTTP ${res.status})`);
      }
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Surface check failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-dark rounded-3xl border border-border p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Layers size={16} className="text-accent" /> 3D Surface Check (from a file)
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Upload a 3D point cloud of one surface made with another scanner. The system fits the flat plane it should be and flags dents and warping beyond the tolerance.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          <span className="block mb-1 uppercase tracking-wider">File unit</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-dark w-36">
            <option value="mm">Millimetres</option>
            <option value="cm">Centimetres</option>
            <option value="m">Metres</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          <span className="block mb-1 uppercase tracking-wider">Tolerance (mm)</span>
          <input type="number" min={0.1} max={100} step={0.1} value={toleranceMm} onChange={(e) => setToleranceMm(e.target.value)} className="input-dark w-28" />
        </label>
        <input ref={fileRef} type="file" accept=".ply,.xyz,.txt,.csv" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {busy ? 'Checking…' : 'Upload point cloud'}
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-foreground">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {result && <SurfaceResultView result={result} caption={fileName} />}
    </div>
  );
}
