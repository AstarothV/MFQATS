'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

// A product's photos, one at a time. Swiping works on its own (CSS scroll-snap); the arrows, the "2/5" count and the
// thumbnails just scroll the same strip.
export default function PhotoSlider({ images, alt, className = 'h-48', thumbs = false, onOpen }: {
  images: string[];
  alt: string;
  className?: string; // height of the photo area
  thumbs?: boolean;
  onOpen?: () => void; // clicking a photo (the shop opens the product's details)
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

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
    <div>
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
              onClick={onOpen}
              className={`w-full h-full shrink-0 snap-center object-contain ${onOpen ? 'cursor-pointer' : ''}`}
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
      </div>
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
