'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Maximize2, X } from 'lucide-react';

// Detect Defects: the 3D model built in step 2, with the defects the photo scans found, as numbered pins or painted
// on the model's surface grid (edit mode). The 3D model itself finds nothing; the positions are approximate.
// Both views place them with defectSpots.ts, so a defect is on the real surface and only shows from its own side.

// three.js for edit mode is loaded only when it is shown
const EditModeView = dynamic(() => import('./EditModeView'), { ssr: false });

/** A defect found on one side's photo (slot = index in VIEWS; u, v = its centre and w, h = its size, 0–1 of the photo). */
export interface Pin { slot: number; u: number; v: number; w?: number; h?: number; label: string; severity: string }

const PIN_COLOR: Record<string, string> = { high: '#EF4444', critical: '#EF4444', medium: '#F59E0B', low: '#22C55E' };

export default function ModelDefectsView({ modelUrl, pins }: { modelUrl: string; pins: Pin[] }) {
  const [mode, setMode] = useState<'edit' | 'pins'>('edit');
  const [spots, setSpots] = useState<{ position: string; normal: string }[]>([]);
  const [full, setFull] = useState(false);

  useEffect(() => { import('@google/model-viewer'); }, []); // registers <model-viewer>; browser-only
  // three.js is only loaded when the pins are shown; pinsKey because the page builds a new array on every render
  const pinsKey = JSON.stringify(pins);
  useEffect(() => {
    if (mode !== 'pins') return;
    let stale = false;
    import('./defectSpots').then(({ pinSpots }) => pinSpots(modelUrl, pins)).then((s) => { if (!stale) setSpots(s); });
    return () => { stale = true; };
  }, [modelUrl, pinsKey, mode]);

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
          src={modelUrl}
          alt="3D model of the furniture with the defects found. Drag to turn it."
          camera-controls
          auto-rotate
          camera-orbit="0deg 75deg 130%"
          max-camera-orbit="auto auto 300%"
          shadow-intensity="1"
          environment-image="neutral"
          exposure="1.3"
          style={{ width: '100%', height: full ? '100%' : 460, background: '#0b0b0f', visibility: mode === 'edit' ? 'hidden' : 'visible', '--min-hotspot-opacity': 0 } as React.CSSProperties}
        >
          {mode === 'pins' && spots.length === pins.length && pins.map((pin, i) => {
            const { position, normal } = spots[i];
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
            ? 'Edit mode: the model as a surface grid. Faces are painted where YOLOv12 found a defect on that side’s photo, at an approximate spot, on that side only. Turn the model to see the other sides, including the bottom.'
            : 'Defect pins: a numbered pin on the side where each defect was found, at an approximate spot. A pin only shows when its side faces you, so turn the model to see the others, including the bottom.'}
        {' '}The 3D model itself does not find defects. Drag to turn, scroll or pinch to zoom.
      </p>
    </div>
  );
}
