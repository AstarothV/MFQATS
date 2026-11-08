'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Images, Trash2, X } from 'lucide-react';
import { nextPartLabel, PART_KINDS } from './insideParts';

// The order's inspection photos, taken once in the Upload step and used by the 3D Model and the defect scan.
// The server's slot order: all six go to the 3D model (its backup, when the free time runs out, takes the four sides).
export const VIEWS = ['Front', 'Left', 'Back', 'Right', 'Top', 'Bottom'] as const;

export interface PhotoSet {
  labels: readonly string[]; // one per slot: the six views, or the inside parts
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

  return { labels: VIEWS, photos, previews, setSlot };
}

export interface PartSet extends PhotoSet {
  add: (kind: (typeof PART_KINDS)[number]) => void;
  remove: (slot: number) => void;
  put: (label: string, file: File | null) => void; // a saved photo coming back: fills its part, adding the part if needed
  suggest: (labels: string[]) => void; // the parts this piece should have; parts with a photo are kept
  clear: () => void;
}

/** The inside parts of a cabinet, shelf unit or dresser: a list that grows and shrinks, one photo each. */
export function usePartSet(): PartSet {
  const [items, setItems] = useState<{ label: string; file: File | null; preview: string | null }[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []);
  const drop = (p: { preview: string | null }) => p.preview && URL.revokeObjectURL(p.preview);
  const labels = useMemo(() => items.map((p) => p.label), [items]);
  const photos = useMemo(() => items.map((p) => p.file), [items]);
  const previews = useMemo(() => items.map((p) => p.preview), [items]);

  return {
    labels, photos, previews,
    setSlot: (slot, file) => setItems((ps) => ps.map((p, i) => {
      if (i !== slot) return p;
      drop(p);
      return { ...p, file, preview: file ? URL.createObjectURL(file) : null };
    })),
    add: (kind) => setItems((ps) => [...ps, { label: nextPartLabel(kind, ps.map((p) => p.label)), file: null, preview: null }]),
    remove: (slot) => setItems((ps) => { if (ps[slot]) drop(ps[slot]); return ps.filter((_, i) => i !== slot); }),
    put: (label, file) => setItems((ps) => {
      const at = ps.findIndex((p) => p.label === label);
      if (!file) return at >= 0 ? ps : [...ps, { label, file: null, preview: null }]; // just make sure the part is listed
      if (at >= 0 && ps[at].file) return ps; // a photo taken here already: keep it
      const item = { label, file, preview: URL.createObjectURL(file) };
      return at >= 0 ? ps.map((p, i) => (i === at ? item : p)) : [...ps, item];
    }),
    suggest: (labels) => setItems((ps) => {
      ps.filter((p) => !p.file && !labels.includes(p.label)).forEach(drop);
      const kept = ps.filter((p) => p.file || labels.includes(p.label));
      return [...kept, ...labels.filter((l) => !kept.some((p) => p.label === l)).map((label) => ({ label, file: null, preview: null }))];
    }),
    clear: () => setItems((ps) => { ps.forEach(drop); return []; }),
  };
}

export interface CloseUpSet extends PhotoSet {
  put: (label: string, file: File) => void; // a saved close-up coming back (an empty slot only)
  drop: (label: string) => void;
  clear: () => void;
}

/** A close-up for each inside part, kept by the part's name so it stays with its part when others are added or removed. */
export function useCloseUpsFor(labels: readonly string[]): CloseUpSet {
  const [byLabel, setByLabel] = useState<Record<string, { file: File; preview: string }>>({});
  const ref = useRef(byLabel);
  ref.current = byLabel;
  useEffect(() => () => Object.values(ref.current).forEach((c) => URL.revokeObjectURL(c.preview)), []);
  const photos = useMemo(() => labels.map((l) => byLabel[l]?.file ?? null), [labels, byLabel]);
  const previews = useMemo(() => labels.map((l) => byLabel[l]?.preview ?? null), [labels, byLabel]);
  const set = (label: string, file: File | null) => setByLabel((m) => {
    const next = { ...m };
    if (next[label]) URL.revokeObjectURL(next[label].preview);
    if (file) next[label] = { file, preview: URL.createObjectURL(file) };
    else delete next[label];
    return next;
  });
  return {
    labels, photos, previews,
    setSlot: (slot, file) => set(labels[slot], file),
    put: (label, file) => { if (!ref.current[label]) set(label, file); },
    drop: (label) => set(label, null),
    clear: () => setByLabel((m) => { Object.values(m).forEach((c) => URL.revokeObjectURL(c.preview)); return {}; }),
  };
}

/** One slot per label: each takes a photo with the camera or picks one from the gallery. With onRemoveSlot, an empty
 * slot can be removed (inside parts the piece does not have). */
export function PhotoSlots({ set, disabled, name = 'photo', onRemoveSlot, grid = 'sm:grid-cols-3 lg:grid-cols-6' }: { set: PhotoSet; disabled?: boolean; name?: string; onRemoveSlot?: (slot: number) => void; grid?: string }) {
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
      <div className={`grid grid-cols-2 gap-3 ${grid}`}>
        {set.labels.map((view, i) => (
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
              <div className="flex h-full flex-col justify-center gap-3 p-3">
                <span className="flex min-w-0 items-center justify-center gap-0.5 text-sm font-semibold text-foreground/80">
                  <span className="truncate" title={view}>{view}</span>
                  {onRemoveSlot && (
                    <button onClick={() => onRemoveSlot(i)} disabled={disabled} aria-label={`Remove the ${view.toLowerCase()} part`}
                      className="-my-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger">
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </span>
                <div className="flex flex-col gap-2">
                  {([['camera', Camera, 'Camera', `Take ${view.toLowerCase()} ${name} with the camera`], ['library', Images, 'Photos', `Choose ${view.toLowerCase()} ${name} from photos`]] as const).map(([from, Icon, label, aria]) => (
                    <button key={from} onClick={() => pick(i, from)} disabled={disabled} aria-label={aria}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50">
                      <Icon size={16} aria-hidden="true" /> {label}
                    </button>
                  ))}
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
  const taken = set.labels.map((view, i) => ({ view, i, url: set.previews[i] })).filter((t) => t.url);
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
