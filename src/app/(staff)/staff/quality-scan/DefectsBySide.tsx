'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export interface Detection {
  id: string;
  class_name: string;
  confidence_score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  bounding_box: { x: number; y: number; width: number; height: number };
}

export const formatLabel = (s: string) => s.replace(/_/g, ' ');
export const severityBadge = (s: Detection['severity']) => (s === 'critical' || s === 'high' ? 'danger' : s === 'medium' ? 'warning' : 'info');

// Canvas is sized to the source's pixel dimensions and scaled by CSS object-contain,
// so normalized boxes line up with the image/video regardless of aspect ratio.
export function drawDetections(canvas: HTMLCanvasElement, dets: Detection[], w: number, h: number, image?: CanvasImageSource) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || !w || !h) return;
  if (image) ctx.drawImage(image, 0, 0, w, h);
  const lw = Math.max(2, w / 320);
  const fs = Math.max(14, Math.round(w / 45));
  ctx.lineWidth = lw;
  ctx.font = `600 ${fs}px sans-serif`;
  ctx.textBaseline = 'top';
  for (const d of dets) {
    const bx = d.bounding_box.x * w;
    const by = d.bounding_box.y * h;
    ctx.strokeStyle = '#EF4444';
    ctx.strokeRect(bx, by, d.bounding_box.width * w, d.bounding_box.height * h);
    const label = `${formatLabel(d.class_name)} (${d.confidence_score}%)`;
    const tagH = fs * 1.4;
    const tagY = by - tagH < 0 ? by : by - tagH;
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(bx - lw / 2, tagY, ctx.measureText(label).width + fs * 0.6, tagH);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx - lw / 2 + fs * 0.3, tagY + fs * 0.2);
  }
}

/** One side of the piece in the Results grid: its photo, and what the scan found there (null = not scanned yet). */
export interface SideTile {
  label: string;
  image: string | null;
  detections: Detection[] | null;
}

function PhotoWithBoxes({ image, detections, label }: { image: string; detections: Detection[]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => ref.current && drawDetections(ref.current, detections, img.naturalWidth, img.naturalHeight, img);
    img.src = image;
  }, [image, detections]);
  return <canvas ref={ref} role="img" aria-label={`${label} photo, ${detections.length} marked`} className="h-full w-full object-contain" />;
}

function chip(t: SideTile) {
  if (!t.image) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">No photo</span>;
  if (!t.detections) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Not scanned</span>;
  const fail = t.detections.filter((d) => d.severity !== 'low').length;
  const natural = t.detections.length - fail;
  if (fail) return <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">{fail} fail{natural ? ` · ${natural} natural` : ''}</span>;
  if (natural) return <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">{natural} natural wood</span>;
  return <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Nothing found</span>;
}

/** Results: every side of the piece in a grid; a side opens larger with the list of what was found on it. */
export default function DefectsBySide({ tiles }: { tiles: SideTile[] }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const shown = open === null ? null : tiles[open];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => {
          const body = (
            <>
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-black/80">
                {t.image && t.detections ? <PhotoWithBoxes image={t.image} detections={t.detections} label={t.label} />
                  : t.image ? <img src={t.image} alt={`${t.label} photo, not scanned yet`} className="h-full w-full object-contain opacity-60" />
                  : <span className="px-3 text-center text-xs text-white/60">Add a {t.label.toLowerCase()} photo in Upload</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">{t.label}</span>
                {chip(t)}
              </div>
            </>
          );
          return t.image && t.detections ? (
            <button key={t.label} type="button" onClick={() => setOpen(i)} aria-label={`Show the ${t.label.toLowerCase()} side larger`}
              className="space-y-2 rounded-2xl border border-border bg-muted/40 p-2.5 text-left transition-colors hover:border-primary">
              {body}
            </button>
          ) : (
            <div key={t.label} className={`space-y-2 rounded-2xl border bg-muted/40 p-2.5 ${t.image ? 'border-border' : 'border-dashed border-border'}`}>{body}</div>
          );
        })}
      </div>

      {shown && shown.image && shown.detections && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(null)}>
          <div role="dialog" aria-modal="true" aria-label={`${shown.label} side`} onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-3xl space-y-3 overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">{shown.label}</h3>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-2xl bg-black">
              <PhotoWithBoxes image={shown.image} detections={shown.detections} label={shown.label} />
            </div>
            {shown.detections.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing found on this side.</p>
            ) : (
              <ul className="space-y-2">
                {shown.detections.map((d) => (
                  <li key={d.id} className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold capitalize text-foreground">{formatLabel(d.class_name)}</span>
                      <StatusBadge variant={severityBadge(d.severity)} label={d.severity.charAt(0).toUpperCase() + d.severity.slice(1)} />
                      <span className="text-xs text-muted-foreground">{d.confidence_score}%{d.severity === 'low' ? ' · natural wood, does not fail the piece' : ''}</span>
                    </div>
                    {d.severity !== 'low' && d.recommendation && <p className="mt-1 text-xs text-muted-foreground">{d.recommendation}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
