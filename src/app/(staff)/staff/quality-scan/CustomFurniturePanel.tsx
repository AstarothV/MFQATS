'use client';

import React, { useEffect, useState } from 'react';
import { Box, Eraser, Loader2, Save, Trash2, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import StatusBadge from '@/components/ui/StatusBadge';
import { mediaLinks } from '@/lib/orderMedia';
import { shrink } from './serverApi';

// "My custom furniture" (migration 039): a piece that is not in the catalog, scanned with "No order", is named and
// kept with its 3D model, front photo and scan result. Files go in order-media under custom/<staff id>/.
const BUCKET = 'order-media';

interface CustomPiece {
  id: string;
  name: string;
  model_path: string | null;
  photo_path: string | null;
  scan_result: 'pass' | 'fail' | null;
  defect_count: number;
  created_at: string;
}

export default function CustomFurniturePanel({ supabase, userId, modelUrl, photo, scanResult, defectCount, notes, onClear, notify }: {
  supabase: SupabaseClient;
  userId: string;
  modelUrl: string | null; // the 3D model built in step 2 (a blob URL)
  photo: File | null; // the front photo from Upload
  scanResult: 'pass' | 'fail' | null;
  defectCount: number;
  notes: string;
  onClear: () => void; // empties the photos, 3D model and scans on screen
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [name, setName] = useState('');
  const [list, setList] = useState<CustomPiece[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<{ name: string; url: string } | null>(null);
  const [missing, setMissing] = useState(false); // migration 039 not run yet

  async function load() {
    const { data, error } = await supabase.from('custom_furniture')
      .select('id, name, model_path, photo_path, scan_result, defect_count, created_at')
      .eq('staff_id', userId).order('created_at', { ascending: false });
    if (error) { setMissing(/custom_furniture/.test(error.message)); return; }
    const rows = (data ?? []) as CustomPiece[];
    setList(rows);
    setThumbs(await mediaLinks(supabase, rows.flatMap((r) => (r.photo_path ? [r.photo_path] : []))));
  }
  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (viewing) import('@google/model-viewer'); }, [viewing]);

  async function save() {
    const label = name.trim();
    if (!label) { notify('error', 'Name the furniture first, for example "Wood table".'); return; }
    if (!modelUrl && !photo) { notify('error', 'Take its photos in Upload (and build the 3D model) before saving.'); return; }
    setSaving(true);
    const stamp = Date.now();
    const uploaded: string[] = [];
    try {
      const put = async (path: string, blob: Blob, contentType: string) => {
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType });
        if (error) throw error;
        uploaded.push(path);
        return path;
      };
      const model_path = modelUrl ? await put(`custom/${userId}/${stamp}-model.glb`, await (await fetch(modelUrl)).blob(), 'model/gltf-binary') : null;
      const photo_path = photo ? await put(`custom/${userId}/${stamp}-photo.jpg`, await (await fetch(await shrink(photo))).blob(), 'image/jpeg') : null;
      const { error } = await supabase.from('custom_furniture').insert({
        staff_id: userId, name: label, model_path, photo_path, scan_result: scanResult, defect_count: scanResult ? defectCount : 0, notes: notes || null,
      });
      if (error) throw error;
      notify('success', `${label} saved to My custom furniture.`);
      setName('');
      load();
    } catch (err: any) {
      if (uploaded.length) supabase.storage.from(BUCKET).remove(uploaded); // no row: don't leave its files behind
      notify('error', /custom_furniture/.test(err?.message ?? '') ? 'Custom furniture needs the latest database update (migration 039).' : err?.message || 'Could not save it');
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: CustomPiece) {
    if (!window.confirm(`Delete ${p.name} from My custom furniture?`)) return;
    const { error } = await supabase.from('custom_furniture').delete().eq('id', p.id);
    if (error) { notify('error', error.message); return; }
    const files = [p.model_path, p.photo_path].filter((x): x is string => !!x);
    if (files.length) await supabase.storage.from(BUCKET).remove(files);
    setList((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function view(p: CustomPiece) {
    if (!p.model_path) return;
    const links = await mediaLinks(supabase, [p.model_path]);
    if (links[p.model_path]) setViewing({ name: p.name, url: links[p.model_path] });
    else notify('error', 'Could not open the 3D model.');
  }

  return (
    <div className="card-dark space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Furniture not in the catalog</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name the piece, take its photos in Upload, build its 3D model and scan it, then save it to My custom furniture.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="custom-name">Furniture name</label>
        <input id="custom-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          placeholder="What is it? e.g. Wood table" className="input-dark min-w-0 flex-1" />
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={saving || missing} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm sm:flex-none">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save to my custom furniture
          </button>
          <button type="button" onClick={() => { onClear(); setName(''); }} className="btn-secondary flex items-center gap-2 text-sm">
            <Eraser size={15} /> Clear
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {missing ? 'Custom furniture needs the latest database update (migration 039).'
          : `Will save: ${[modelUrl && '3D model', photo && 'front photo', scanResult && `scan result (${scanResult === 'pass' ? 'passed' : `${defectCount} defect${defectCount === 1 ? '' : 's'}`})`].filter(Boolean).join(', ') || 'nothing yet'}.`}
      </p>

      {list.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">My custom furniture ({list.length})</h3>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-2">
                {p.photo_path && thumbs[p.photo_path]
                  ? <img src={thumbs[p.photo_path]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Box size={20} aria-hidden="true" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.scan_result && <StatusBadge variant={p.scan_result === 'pass' ? 'ok' : 'danger'} label={p.scan_result === 'pass' ? 'PASS' : `${p.defect_count} defect${p.defect_count === 1 ? '' : 's'}`} />}
                  </p>
                </div>
                {p.model_path && (
                  <button type="button" onClick={() => view(p)} className="btn-ghost p-2" aria-label={`View the 3D model of ${p.name}`}><Box size={16} /></button>
                )}
                <button type="button" onClick={() => remove(p)} className="btn-ghost p-2 text-danger" aria-label={`Delete ${p.name}`}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {viewing && (
        <div role="dialog" aria-modal="true" aria-label={`3D model of ${viewing.name}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setViewing(null)}>
          <div className="card-dark w-full max-w-2xl space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{viewing.name}</p>
              <button type="button" onClick={() => setViewing(null)} className="btn-ghost p-2" aria-label="Close"><X size={16} /></button>
            </div>
            <model-viewer src={viewing.url} camera-controls auto-rotate style={{ width: '100%', height: '60vh', background: 'transparent' }} />
          </div>
        </div>
      )}
    </div>
  );
}
