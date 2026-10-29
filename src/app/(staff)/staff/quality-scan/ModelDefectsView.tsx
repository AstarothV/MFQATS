'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Maximize2, X } from 'lucide-react';

// Detect Defects: the 3D model built in step 2, with the defects the photo scans found, as numbered pins or painted
// on the model's surface grid (edit mode). The 3D model itself finds nothing; the positions are approximate.

// three.js for edit mode is loaded only when it is shown
const EditModeView = dynamic(() => import('./EditModeView'), { ssr: false });

type V3 = { x: number; y: number; z: number };
/** A defect found on one side's photo (slot = index in VIEWS; u, v = its centre and w, h = its size, 0–1 of the photo). */
export interface Pin { slot: number; u: number; v: number; w?: number; h?: number; label: string; severity: string }

// Where a defect goes on the model: the photo's spot laid onto the matching face of the model's bounding box, with
// front facing +z (the glTF convention). Only approximate: the photo shows the background too.
function pinOnModel({ slot, u, v }: Pin, c: V3, s: V3): { position: string; normal: string } {
  const lo = { x: c.x - s.x / 2, y: c.y - s.y / 2, z: c.z - s.z / 2 }, hi = { x: c.x + s.x / 2, y: c.y + s.y / 2, z: c.z + s.z / 2 };
  const at = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  const down = at(hi.y, lo.y, v);
  const [p, n] = [ // VIEWS: Front, Left, Back, Right, Top, Bottom
    [[at(lo.x, hi.x, u), down, hi.z], '0 0 1'],
    [[lo.x, down, at(lo.z, hi.z, u)], '-1 0 0'],
    [[at(hi.x, lo.x, u), down, lo.z], '0 0 -1'],
    [[hi.x, down, at(hi.z, lo.z, u)], '1 0 0'],
    [[at(lo.x, hi.x, u), hi.y, at(lo.z, hi.z, v)], '0 1 0'],
    [[at(lo.x, hi.x, u), lo.y, at(hi.z, lo.z, v)], '0 -1 0'],
  ][slot] as [number[], string];
  return { position: p.map((x) => `${x}m`).join(' '), normal: n };
}

const PIN_COLOR: Record<string, string> = { high: '#EF4444', critical: '#EF4444', medium: '#F59E0B', low: '#22C55E' };

export default function ModelDefectsView({ modelUrl, pins }: { modelUrl: string; pins: Pin[] }) {
  const viewerRef = useRef<any>(null);
  const [mode, setMode] = useState<'edit' | 'pins'>('edit');
  const [bounds, setBounds] = useState<{ c: V3; s: V3 } | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => { import('@google/model-viewer'); }, []); // registers <model-viewer>; browser-only
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setBounds(null);
    const onLoad = () => setBounds({ c: viewer.getBoundingBoxCenter(), s: viewer.getDimensions() });
    viewer.addEventListener('load', onLoad);
    return () => viewer.removeEventListener('load', onLoad);
  }, [modelUrl]);

  // Esc leaves full screen; the page behind does not scroll while it is open.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [full]);

  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${on ? 'bg-primary text-primary-foreground' : 'text-white/70 hover:text-white'}`;

  return (
    <div className="space-y-2">
      <div
        role={full ? 'dialog' : undefined}
        aria-modal={full || undefined}
        aria-label={full ? '3D model with defects in full screen' : undefined}
        className={full ? 'fixed inset-0 z-[100] bg-[#0b0b0f]' : 'relative overflow-hidden rounded-xl'}
      >
        <model-viewer
          ref={viewerRef}
          src={modelUrl}
          alt="3D model of the furniture with the defects found. Drag to turn it."
          camera-controls
          auto-rotate
          camera-orbit="0deg 75deg 130%"
          max-camera-orbit="auto auto 300%"
          shadow-intensity="1"
          environment-image="neutral"
          exposure="1.3"
          style={{ width: '100%', height: full ? '100%' : 460, background: '#0b0b0f', visibility: mode === 'edit' ? 'hidden' : 'visible' }}
        >
          {bounds && mode === 'pins' && pins.map((pin, i) => {
            const { position, normal } = pinOnModel(pin, bounds.c, bounds.s);
            return (
              <div key={`pin${i}${position}`} slot={`hotspot-pin-${i}`} data-position={position} data-normal={normal}
                className="pointer-events-none flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white" style={{ background: PIN_COLOR[pin.severity] ?? '#EF4444' }}>{i + 1}</span>
                <span className="rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold capitalize text-white">{pin.label}</span>
              </div>
            );
          })}
        </model-viewer>
        {mode === 'edit' && <EditModeView modelUrl={modelUrl} pins={pins} />}
        <div role="group" aria-label="Show the defects as" className="absolute left-3 top-3 flex gap-1 rounded-xl bg-black/70 p-1">
          <button onClick={() => setMode('edit')} aria-pressed={mode === 'edit'} className={tab(mode === 'edit')}>Edit mode</button>
          <button onClick={() => setMode('pins')} aria-pressed={mode === 'pins'} className={tab(mode === 'pins')}>Defect pins</button>
        </div>
        <button
          onClick={() => setFull(!full)}
          aria-label={full ? 'Exit full screen' : 'Show the 3D model in full screen'}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
        >
          {full ? <X size={18} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {pins.length === 0
          ? 'No defects to show yet. Scan the sides above, then they appear on the model.'
          : mode === 'edit'
            ? 'Edit mode: the model as a surface grid. Faces are painted where YOLOv12 found a defect on that side’s photo, at an approximate spot.'
            : 'Defect pins: a numbered pin on the side where each defect was found, at an approximate spot.'}
        {' '}The 3D model itself does not find defects. Drag to turn, scroll or pinch to zoom.
      </p>
    </div>
  );
}
