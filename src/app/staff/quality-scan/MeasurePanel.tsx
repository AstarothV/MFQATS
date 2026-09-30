'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Ruler, Camera, Save, Loader2, AlertTriangle, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';

// Measures furniture from one photo that includes the printed marker (PnP + Euclidean distance, see src/api/measure.py).
// The staff member taps the two ends of the edge to measure; the result is compared with the expected size.

type Dim = 'length' | 'width' | 'height';
type Point = [number, number]; // position as fractions (0–1) of the photo's width and height

const DIMS: { key: Dim; label: string }[] = [
  { key: 'length', label: 'Length' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
];
const MARKER_PDF = '/assets/mfqats-marker-150mm.pdf';
const MAX_PHOTO_PX = 2000; // long side sent to the server: enough for the marker's corners, small enough to upload quickly
const LOUPE_PX = 140;
const LOUPE_ZOOM = 2.5;
const EMPTY = { length: null, width: null, height: null };

interface MeasureResponse {
  marker: Point[];
  distance_mm?: number;
  warnings: string[];
  low_confidence: boolean;
}

interface Props {
  apiUrl: string;
  orderId: string;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const toNumber = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function MeasurePanel({ apiUrl, orderId, showToast }: Props) {
  const { user } = useAuth();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<{ canvas: HTMLCanvasElement; dataUrl: string } | null>(null);
  const requestRef = useRef(0);

  const [photoTick, setPhotoTick] = useState(0); // bumps when photoRef changes, to redraw
  const [marker, setMarker] = useState<Point[] | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [active, setActive] = useState<Dim>('length');
  const [measured, setMeasured] = useState<Record<Dim, number | null>>(EMPTY); // cm
  const [expected, setExpected] = useState<Record<Dim, string>>({ length: '', width: '', height: '' }); // cm
  const [markerMm, setMarkerMm] = useState('150');
  const [toleranceCm, setToleranceCm] = useState('1');
  const [saving, setSaving] = useState(false);

  // Expected size comes from the ordered product; staff can still correct it.
  useEffect(() => {
    setMeasured(EMPTY);
    if (!orderId) return;
    let cancelled = false;
    supabase.from('orders').select('products(length_cm, width_cm, height_cm)').eq('id', orderId).maybeSingle().then(({ data }) => {
      const p: any = Array.isArray(data?.products) ? data?.products[0] : data?.products;
      if (cancelled || !p) return;
      const show = (v: unknown) => (Number(v) > 0 ? String(Number(v)) : '');
      setExpected({ length: show(p.length_cm), width: show(p.width_cm), height: show(p.height_cm) });
    });
    return () => { cancelled = true; };
  }, [orderId, supabase]);

  async function callMeasure(pts?: Point[]): Promise<MeasureResponse> {
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/api/measure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoRef.current?.dataUrl, marker_mm: toNumber(markerMm) ?? 150, points: pts }),
      });
    } catch {
      throw new Error('Could not reach the measurement server. Make sure the Python server is running.');
    }
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (res.redirected || (res.ok && !isJson)) throw new Error('Your session has expired. Please log in again.');
    const body = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      if (!body && res.status >= 500) throw new Error('Could not reach the measurement server. Make sure the Python server is running.');
      throw new Error(typeof body?.detail === 'string' ? body.detail : `Measurement failed (HTTP ${res.status})`);
    }
    return body;
  }

  // Runs one request; a newer request makes an older one's answer irrelevant.
  async function run(pts: Point[] | undefined, onDone: (r: MeasureResponse) => void) {
    const id = ++requestRef.current;
    setBusy(true);
    setError(null);
    try {
      const r = await callMeasure(pts);
      if (id !== requestRef.current) return;
      setWarnings(r.warnings);
      onDone(r);
    } catch (e) {
      if (id !== requestRef.current) return;
      setError(e instanceof Error ? e.message : 'Measurement failed.');
    } finally {
      if (id === requestRef.current) setBusy(false);
    }
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same photo can be chosen again
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PHOTO_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      photoRef.current = { canvas, dataUrl: canvas.toDataURL('image/jpeg', 0.9) };
      setMarker(null);
      setPoints([]);
      setWarnings([]);
      setPhotoTick((t) => t + 1);
      run(undefined, (r) => setMarker(r.marker));
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError('That file is not a photo the browser can open.'); };
    img.src = url;
  }

  function measureNow(pts: Point[]) {
    run(pts, (r) => {
      setMarker(r.marker);
      if (r.distance_mm != null) setMeasured((m) => ({ ...m, [active]: round2(r.distance_mm! / 10) }));
    });
  }

  function pointAt(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  }

  // Tap to place an end, then drag it for a fine position (the magnifier shows what is under the finger).
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!marker) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    if (points.length < 2) {
      setPoints([...points, p]);
      setDrag(points.length);
    } else {
      const d = (q: Point) => Math.hypot(q[0] - p[0], q[1] - p[1]);
      const nearest = d(points[0]) <= d(points[1]) ? 0 : 1;
      setPoints(points.map((q, i) => (i === nearest ? p : q)));
      setDrag(nearest);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drag === null) return;
    const p = pointAt(e);
    setPoints((pts) => pts.map((q, i) => (i === drag ? p : q)));
  }

  function onPointerUp() {
    if (drag === null) return;
    setDrag(null);
    if (points.length === 2) measureNow(points);
  }

  function chooseDim(d: Dim) {
    setActive(d);
    setPoints([]); // the next two taps measure this dimension
  }

  // Draw the photo, the marker outline, the two ends and the magnifier.
  useEffect(() => {
    const view = viewRef.current;
    const photo = photoRef.current;
    if (!view || !photo) return;
    const { canvas: src } = photo;
    view.width = src.width;
    view.height = src.height;
    const ctx = view.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const k = src.width / (view.getBoundingClientRect().width || src.width); // photo pixels per screen pixel
    const px = (p: Point): Point => [p[0] * src.width, p[1] * src.height];

    if (marker) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      marker.map(px).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }
    const ends = points.map(px);
    if (ends.length === 2) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.moveTo(ends[0][0], ends[0][1]);
      ctx.lineTo(ends[1][0], ends[1][1]);
      ctx.stroke();
      const value = measured[active];
      if (value != null && drag === null && !busy) {
        const text = `${value.toFixed(1)} cm`;
        ctx.font = `bold ${16 * k}px sans-serif`;
        const w = ctx.measureText(text).width + 12 * k;
        const cx = (ends[0][0] + ends[1][0]) / 2;
        const cy = (ends[0][1] + ends[1][1]) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(cx - w / 2, cy - 14 * k, w, 28 * k);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);
      }
    }
    ends.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 7 * k, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * k;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 1.5 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
      ctx.fill();
    });

    const loupe = loupeRef.current;
    if (loupe && drag !== null && ends[drag]) {
      const lctx = loupe.getContext('2d')!;
      const half = (LOUPE_PX / LOUPE_ZOOM / 2) * k; // photo pixels shown either side of the point
      lctx.fillStyle = '#000';
      lctx.fillRect(0, 0, LOUPE_PX, LOUPE_PX);
      lctx.drawImage(src, ends[drag][0] - half, ends[drag][1] - half, half * 2, half * 2, 0, 0, LOUPE_PX, LOUPE_PX);
      lctx.strokeStyle = '#a855f7';
      lctx.lineWidth = 1;
      lctx.beginPath();
      lctx.moveTo(LOUPE_PX / 2, 0);
      lctx.lineTo(LOUPE_PX / 2, LOUPE_PX);
      lctx.moveTo(0, LOUPE_PX / 2);
      lctx.lineTo(LOUPE_PX, LOUPE_PX / 2);
      lctx.stroke();
    }
  }, [photoTick, marker, points, drag, measured, active, busy]);

  const tolerance = toNumber(toleranceCm) ?? 1;
  const variance = (d: Dim) => {
    const m = measured[d];
    const x = toNumber(expected[d]);
    return m != null && x != null && x > 0 ? round2(m - x) : null;
  };
  const verdict = (d: Dim) => {
    const v = variance(d);
    return v === null ? null : Math.abs(v) <= tolerance;
  };
  const verdicts = DIMS.map((d) => verdict(d.key)).filter((v) => v !== null);
  const anyMeasured = DIMS.some((d) => measured[d.key] != null);

  async function save() {
    if (!user) return;
    if (!orderId) { showToast('error', 'Select an order first, so the measurement is saved against it.'); return; }
    setSaving(true);
    // the measurements table calls length "depth" in its expected_/variance_ columns
    const { error: saveError } = await supabase.from('measurements').insert({
      order_id: orderId,
      inspector_id: user.id,
      length_cm: measured.length,
      depth_cm: measured.length,
      width_cm: measured.width,
      height_cm: measured.height,
      expected_depth_cm: toNumber(expected.length),
      expected_width_cm: toNumber(expected.width),
      expected_height_cm: toNumber(expected.height),
      variance_depth: variance('length'),
      variance_width: variance('width'),
      variance_height: variance('height'),
      tolerance_cm: tolerance,
      measurement_status: verdicts.length === 0 ? 'pending' : verdicts.every(Boolean) ? 'within_tolerance' : 'out_of_tolerance',
      notes: `Marker measurement (PnP), ${toNumber(markerMm) ?? 150} mm marker${warnings.length ? '. Low confidence: ' + warnings.join(' ') : ''}`,
    });
    setSaving(false);
    if (saveError) showToast('error', `Could not save the measurement: ${saveError.message}`);
    else showToast('success', 'Measurement saved.');
  }

  return (
    <div className="card-dark rounded-3xl border border-border p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Ruler size={16} className="text-accent" /> Measure Dimensions
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Lay the printed marker flat on the surface you are measuring, take a photo, then tap the two ends of the edge.
          </p>
        </div>
        <a href={MARKER_PDF} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2 text-sm">
          <Printer size={14} /> Print marker
        </a>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="btn-primary flex items-center gap-2">
          <Camera size={16} /> {photoTick ? 'Retake photo' : 'Take photo'}
        </button>
        <label className="text-xs text-muted-foreground">
          <span className="block mb-1 uppercase tracking-wider">Marker size (mm)</span>
          <input type="number" min={10} max={2000} value={markerMm} onChange={(e) => setMarkerMm(e.target.value)} className="input-dark w-28" />
        </label>
        <label className="text-xs text-muted-foreground">
          <span className="block mb-1 uppercase tracking-wider">Tolerance (cm)</span>
          <input type="number" min={0} step={0.1} value={toleranceCm} onChange={(e) => setToleranceCm(e.target.value)} className="input-dark w-28" />
        </label>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-foreground">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {photoTick > 0 && (
        <div className="relative flex justify-center rounded-xl bg-black">
          <canvas
            ref={viewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Photo to measure. Tap the two ends of the edge."
            className={`max-w-full max-h-[70vh] touch-none ${marker ? 'cursor-crosshair' : ''}`}
          />
          <canvas
            ref={loupeRef}
            width={LOUPE_PX}
            height={LOUPE_PX}
            className={`pointer-events-none absolute top-2 rounded-full border-2 border-white ${drag === null ? 'hidden' : ''} ${
              drag !== null && points[drag] && points[drag][0] < 0.5 && points[drag][1] < 0.5 ? 'right-2' : 'left-2'
            }`}
          />
          {busy && (
            <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white">
              <Loader2 size={14} className="animate-spin" /> {marker ? 'Measuring…' : 'Looking for the marker…'}
            </div>
          )}
        </div>
      )}

      {marker && (
        <p className="text-sm text-muted-foreground">
          Marker found. Choose what to measure, then tap its two ends. Drag an end to adjust it.
        </p>
      )}

      {warnings.length > 0 && (
        <div role="status" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle size={15} className="text-warning" /> Low confidence. Check this with a tape measure.</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">Dimension</th>
              <th className="py-2 pr-3">Expected (cm)</th>
              <th className="py-2 pr-3">Measured (cm)</th>
              <th className="py-2 pr-3">Difference</th>
              <th className="py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {DIMS.map(({ key, label }) => {
              const v = variance(key);
              const ok = verdict(key);
              return (
                <tr key={key} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => chooseDim(key)}
                      aria-pressed={active === key}
                      className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${active === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      {label}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      aria-label={`Expected ${label.toLowerCase()} in centimetres`}
                      value={expected[key]}
                      onChange={(e) => setExpected({ ...expected, [key]: e.target.value })}
                      className="input-dark w-24"
                    />
                  </td>
                  <td className="py-2 pr-3 font-semibold text-foreground">{measured[key] != null ? measured[key]!.toFixed(1) : '—'}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`}</td>
                  <td className="py-2">
                    {ok === null ? <StatusBadge variant="neutral" label="Pending" /> : ok ? <StatusBadge variant="ok" label="Within tolerance" /> : <StatusBadge variant="danger" label="Dimensional Error" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={save} disabled={!anyMeasured || saving || busy} className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save measurement
      </button>
    </div>
  );
}
