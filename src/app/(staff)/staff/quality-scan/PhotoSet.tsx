'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Images, X } from 'lucide-react';

// The order's inspection photos, taken once in the Upload step and used by the 3D Model and the defect scan.
// The server's slot order: all six go to the 3D model (its backup, when the free time runs out, takes the four sides).
export const VIEWS = ['Front', 'Left', 'Back', 'Right', 'Top', 'Bottom'] as const;

export interface PhotoSet {
  photos: (File | null)[];
  previews: (string | null)[]; // object URLs of the photos, for showing them
  setSlot: (slot: number, file: File | null) => void;
}

export function usePhotoSet(): PhotoSet {
  const [photos, setPhotos] = useState<(File | null)[]>(VIEWS.map(() => null));
  const [previews, setPreviews] = useState<(string | null)[]>(VIEWS.map(() => null));
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach((p) => p && URL.revokeObjectURL(p)), []);

  function setSlot(slot: number, file: File | null) {
    const old = previewsRef.current[slot];
    if (old) URL.revokeObjectURL(old);
    setPhotos((ps) => ps.map((p, i) => (i === slot ? file : p)));
    setPreviews((ps) => ps.map((p, i) => (i === slot ? (file ? URL.createObjectURL(file) : null) : p)));
  }

  return { photos, previews, setSlot };
}

/** The six slots: each takes a photo with the camera or picks one from the gallery. */
export function PhotoSlots({ set, disabled, name = 'photo' }: { set: PhotoSet; disabled?: boolean; name?: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);

  function pick(slot: number, from: 'camera' | 'library') {
    slotRef.current = slot;
    (from === 'camera' ? cameraRef : libraryRef).current?.click();
  }

  function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // so the same photo can be chosen again
    if (f) set.setSlot(slotRef.current, f);
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPicked} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onPicked} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {VIEWS.map((view, i) => (
          <div key={view} className={`relative aspect-square overflow-hidden rounded-2xl border bg-muted ${set.previews[i] ? 'border-border' : 'border-dashed border-border'}`}>
            {set.previews[i] ? (
              <>
                <img src={set.previews[i]!} alt={`${view} ${name}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs text-white">{view}</span>
                <button
                  onClick={() => set.setSlot(i, null)}
                  disabled={disabled}
                  aria-label={`Remove ${view.toLowerCase()} ${name}`}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-2">
                <span className="text-sm font-semibold text-muted-foreground">{view}</span>
                <div className="flex gap-2">
                  <button onClick={() => pick(i, 'camera')} disabled={disabled} aria-label={`Take ${view.toLowerCase()} ${name} with the camera`} className="flex flex-col items-center gap-1 rounded-lg bg-background/60 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                    <Camera size={18} /> Camera
                  </button>
                  <button onClick={() => pick(i, 'library')} disabled={disabled} aria-label={`Choose ${view.toLowerCase()} ${name} from photos`} className="flex flex-col items-center gap-1 rounded-lg bg-background/60 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                    <Images size={18} /> Photos
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/** Small thumbnails of the photos that were taken; with onPick, tapping one selects it. */
export function PhotoThumbs({ set, selected, onPick }: { set: PhotoSet; selected?: number | null; onPick?: (slot: number) => void }) {
  const taken = VIEWS.map((view, i) => ({ view, i, url: set.previews[i] })).filter((t) => t.url);
  if (taken.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {taken.map(({ view, i, url }) => {
        const content = (
          <>
            <img src={url!} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] text-white">{view}</span>
          </>
        );
        return onPick ? (
          <button
            key={view}
            onClick={() => onPick(i)}
            aria-pressed={selected === i}
            aria-label={`Scan the ${view.toLowerCase()} photo`}
            className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors ${selected === i ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}
          >
            {content}
          </button>
        ) : (
          <div key={view} className="relative h-14 w-14 overflow-hidden rounded-xl">{content}</div>
        );
      })}
    </div>
  );
}
