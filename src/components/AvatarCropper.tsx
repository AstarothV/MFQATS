'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Move, ZoomIn, ZoomOut } from 'lucide-react';

const FRAME = 240; // the round preview, in px
const OUT = 320; // the saved square photo, in px

/**
 * Position a new profile photo before it is saved: drag to move it, the slider (or arrow keys and +/-) to zoom. The
 * photo always fills the circle. Save returns exactly what is inside the frame as a 320 px square WebP.
 */
export default function AvatarCropper({ file, onCancel, onSave, saving }: {
  file: File; onCancel: () => void; onSave: (photo: Blob) => void; saving: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of the photo's centre from the frame's centre
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // size of the photo on screen: covers the frame at zoom 1
  const base = img ? Math.max(FRAME / img.naturalWidth, FRAME / img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : FRAME;
  const h = img ? img.naturalHeight * base * zoom : FRAME;
  // never leave a gap inside the circle
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({
    x: Math.max(-(ww - FRAME) / 2, Math.min((ww - FRAME) / 2, p.x)),
    y: Math.max(-(hh - FRAME) / 2, Math.min((hh - FRAME) / 2, p.y)),
  });
  const setZoomTo = (z: number) => {
    const nz = Math.max(1, Math.min(3, z));
    setZoom(nz);
    if (img) setPos((p) => clamp(p, img.naturalWidth * base * nz, img.naturalHeight * base * nz));
  };

  function save() {
    if (!img) return;
    const scale = base * zoom; // screen px per photo px
    const left = (FRAME - w) / 2 + pos.x;
    const top = (FRAME - h) / 2 + pos.y;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -left / scale, -top / scale, FRAME / scale, FRAME / scale, 0, 0, OUT, OUT);
    canvas.toBlob((b) => b && onSave(b), 'image/webp', 0.88);
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Adjust your photo" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm space-y-5 rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-bold text-foreground">Adjust your photo</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Move size={14} aria-hidden="true" /> Drag to move it, zoom to fill the circle.</p>
        </div>

        <div
          tabIndex={0}
          aria-label="Photo position. Use the arrow keys to move it, plus and minus to zoom."
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 6;
            const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            if (moves[e.key]) { e.preventDefault(); setPos((p) => clamp({ x: p.x + moves[e.key][0], y: p.y + moves[e.key][1] })); }
            if (e.key === '+' || e.key === '=') setZoomTo(zoom + 0.1);
            if (e.key === '-') setZoomTo(zoom - 0.1);
          }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onWheel={(e) => setZoomTo(zoom - e.deltaY * 0.0015)}
          className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-full bg-muted ring-4 ring-primary/20 focus-visible:outline-none focus-visible:ring-primary active:cursor-grabbing"
          style={{ width: FRAME, height: FRAME }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
              style={{ width: w, height: h, left: (FRAME - w) / 2 + pos.x, top: (FRAME - h) / 2 + pos.y }} />
          ) : (
            <span className="flex h-full items-center justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></span>
          )}
        </div>

        <label className="flex items-center gap-3">
          <ZoomOut size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoomTo(Number(e.target.value))} className="w-full" />
          <ZoomIn size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button type="button" onClick={save} disabled={!img || saving} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">
            {saving && <Loader2 size={14} className="animate-spin" />} Save photo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
