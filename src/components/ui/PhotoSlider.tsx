'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, Package, X } from 'lucide-react';

// A product's photos, one at a time. Swiping works on its own (CSS scroll-snap); the arrows, the "2/5" count and the
// thumbnails just scroll the same strip.
export default function PhotoSlider({ images, alt, className = 'h-48', thumbs = false, onOpen, zoom = false, start = 0 }: {
  images: string[];
  alt: string;
  className?: string; // height of the photo area
  thumbs?: boolean;
  onOpen?: () => void; // clicking a photo (the shop opens the product's details)
  zoom?: boolean; // a button (and clicking a photo) shows the photos full screen
  start?: number; // the photo shown first
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [full, setFull] = useState(false);
  const count = images.length;

  useEffect(() => {
    const t = track.current;
    if (t && start) t.scrollLeft = start * t.clientWidth;
  }, []);

  // full screen: Esc and the arrow keys work, and the page behind does not scroll
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setFull(false); } };
    document.addEventListener('keydown', onKey, true);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey, true); document.body.style.overflow = before; };
  }, [full]);

  if (!count) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <Package size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const go = (i: number) => {
    const t = track.current;
    if (t) t.scrollTo({ left: ((i + count) % count) * t.clientWidth, behavior: 'smooth' });
  };
  const arrow = 'absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-neutral-800 shadow flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity';

  return (
    <div className="h-full">
      <div className={`relative ${className} bg-white`}>
        <div
          ref={track}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <img
              key={src + i}
              src={src}
              alt={`${alt}, photo ${i + 1} of ${count}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              onClick={zoom ? () => setFull(true) : onOpen}
              className={`w-full h-full shrink-0 snap-center object-contain ${onOpen || zoom ? 'cursor-pointer' : ''} ${zoom ? 'cursor-zoom-in' : ''}`}
            />
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} className={`${arrow} left-2`}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} className={`${arrow} right-2`}><ChevronRight size={18} /></button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{index + 1}/{count}</span>
          </>
        )}
        {zoom && (
          <button type="button" aria-label="Show the photos full screen" onClick={() => setFull(true)} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
            <Maximize2 size={16} />
          </button>
        )}
      </div>
      {full && createPortal(
        <div role="dialog" aria-modal="true" aria-label={`${alt} photos, full screen`} className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-4" onClick={() => setFull(false)}>
          <div className="mb-3 flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
            <p className="truncate text-sm font-semibold">{alt}</p>
            <button type="button" aria-label="Close full screen" onClick={() => setFull(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            <PhotoSlider images={images} alt={alt} className="h-full !bg-transparent" start={index} />
          </div>
        </div>,
        document.body,
      )}
      {thumbs && count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              onClick={() => go(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
