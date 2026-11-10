'use client';
import React, { useEffect, useState } from 'react';
import { Box, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { statusLabel } from '@/lib/orders';
import { publishWorkshopModel, workshopModels, type WorkshopModel } from '@/lib/productModels';

/**
 * Product Catalog: the product's 3D model for the shop. Shows the current one, and lets the admin reuse a model the
 * workshop built in Quality Scan for an order of this product. The copy is saved with the product (Save Changes).
 */
export default function WorkshopModelPicker({ productId, value, onChange }: { productId?: string; value: string; onChange: (url: string) => void }) {
  const supabase = createClient();
  const [list, setList] = useState<WorkshopModel[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { if (value) import('@google/model-viewer'); }, [value]);

  async function open() {
    if (!productId) return;
    setError('');
    setList(null);
    setBusy('list');
    try { setList(await workshopModels(supabase, productId)); }
    catch { setError('Could not load the workshop models. Try again.'); }
    finally { setBusy(null); }
  }

  async function use(m: WorkshopModel) {
    if (!productId) return;
    setError('');
    setBusy(m.orderId);
    try { onChange(await publishWorkshopModel(supabase, productId, m.path)); setList(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-2 md:col-span-2">
      {value && (
        <model-viewer key={value} src={value} alt="3D model shown in the shop" camera-controls auto-rotate environment-image="neutral" exposure="1.2"
          style={{ width: '100%', height: 220, background: '#0b0b0f', borderRadius: 12 }} />
      )}
      {productId ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={open} disabled={busy !== null} className="btn-secondary flex items-center gap-2 text-sm">
            {busy === 'list' ? <Loader2 size={14} className="animate-spin" /> : <Box size={14} />}
            Use a 3D model the workshop built
          </button>
          {value && <button type="button" onClick={() => onChange('')} className="btn-ghost text-sm">Remove from the shop</button>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Save the product first; then a 3D model the workshop builds for its orders can be used here.</p>
      )}
      {list && (
        list.length === 0 ? (
          <p className="text-xs text-muted-foreground">No 3D model has been built for an order of this product yet. One is built in Quality Scan, step 2.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {list.map((m) => (
              <li key={m.orderId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-semibold text-foreground">{m.orderRef}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {statusLabel(m.status)} · {new Date(m.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <button type="button" onClick={() => use(m)} disabled={busy !== null} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                  {busy === m.orderId && <Loader2 size={12} className="animate-spin" />} Use this
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
