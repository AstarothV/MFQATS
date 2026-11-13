'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, LocateFixed, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { currentPosition, placeAt, type SavedAddress } from '@/lib/delivery';
import PlaceSearch from '@/components/PlaceSearch';

const PHONE = /^[+\d][\d\s-]{6,19}$/;

// A customer's saved delivery addresses (migrations 037, 038). While typing, real places are suggested (or "Use my
// location" fills in the street and city where the customer is). In checkout, `onSelect` makes the list a picker.
export default function AddressBook({ selectedId, onSelect, onLoaded }: {
  selectedId?: string | null;
  onSelect?: (a: SavedAddress) => void;
  onLoaded?: (list: SavedAddress[]) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: 'Home', street: '', city: '', phone: '' });
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); // my location: suggestions near me first
  const [picked, setPicked] = useState(''); // the suggestion picked, shown under the search
  const [searchKey, setSearchKey] = useState(0); // a new key empties the search box (after Use my location)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askFirst, confirmBox] = useConfirm();

  async function load() {
    const { data, error } = await supabase.from('customer_addresses').select('*').order('is_default', { ascending: false }).order('created_at');
    const rows = error ? [] : ((data ?? []) as SavedAddress[]);
    setList(rows);
    onLoaded?.(rows);
    if (rows.length === 0) setAdding(true);
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function useMyLocation() {
    setBusy(true); setMsg(null);
    try {
      const pos = await currentPosition();
      setMe(pos);
      setSearchKey((k) => k + 1);
      const p = await placeAt(pos.lat, pos.lng);
      if (p) setForm((f) => ({ ...f, street: p.street, city: p.city || f.city }));
      setPicked(p ? `${p.title}${p.detail ? `, ${p.detail}` : ''}` : 'Your current location');
      setMsg({ ok: true, text: p ? 'Filled in from your location. Add your house number or landmark if needed.' : 'Your location could not be turned into an address. Please type it below.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const street = form.street.trim(), city = form.city.trim(), phone = form.phone.trim();
    if (!street || !city) return setMsg({ ok: false, text: 'Enter the street and the city.' });
    if (phone && !PHONE.test(phone)) return setMsg({ ok: false, text: 'Enter a phone number like 0917 123 4567.' });
    setBusy(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('customer_addresses')
      .insert({ user_id: user?.id, label: form.label.trim() || 'Home', street, city, phone })
      .select().single();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /relation|does not exist/i.test(error.message) ? 'Saved addresses are not set up yet (migration 037).' : 'Could not save the address. Please try again.' });
    setForm({ label: 'Home', street: '', city: '', phone: '' });
    setPicked('');
    setAdding(false);
    setMsg({ ok: true, text: 'Address saved.' });
    await load();
    if (data && onSelect) onSelect(data as SavedAddress);
  }

  async function makeDefault(a: SavedAddress) {
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', a.id);
    await load();
  }

  async function remove(a: SavedAddress) {
    if (!(await askFirst({ title: 'Delete this address?', message: `${a.street}, ${a.city}`, confirmLabel: 'Delete', cancelLabel: 'Keep it', danger: true }))) return;
    await supabase.from('customer_addresses').delete().eq('id', a.id);
    await load();
  }

  return (
    <div className="space-y-3">
      {confirmBox}
      {list === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading addresses…</p>
      ) : (
        <ul className="space-y-2" role={onSelect ? 'radiogroup' : undefined} aria-label="Saved addresses">
          {list.map((a) => {
            const picked = onSelect && selectedId === a.id;
            return (
              <li key={a.id}>
                <div className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${picked ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  {onSelect ? (
                    <button type="button" role="radio" aria-checked={!!picked} onClick={() => onSelect(a)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${picked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{picked && <Check size={10} />}</span>
                      <AddressText a={a} />
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0 text-primary dark:text-accent" /><AddressText a={a} /></div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {!a.is_default && (
                      <button type="button" onClick={() => makeDefault(a)} title="Make default" aria-label={`Make ${a.label} the default address`} className="btn-ghost p-1.5"><Star size={14} /></button>
                    )}
                    <button type="button" onClick={() => remove(a)} title="Delete" aria-label={`Delete ${a.label}`} className="btn-ghost p-1.5 text-danger hover:text-danger"><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <PlaceSearch key={searchKey} near={me} onPick={(p) => { setForm((f) => ({ ...f, street: p.street, city: p.city || f.city })); setPicked(`${p.title}${p.detail ? `, ${p.detail}` : ''}`); setMsg(null); }} />
              </div>
              <button type="button" onClick={useMyLocation} disabled={busy} className="btn-secondary flex shrink-0 items-center justify-center gap-2 text-sm">
                <LocateFixed size={14} /> Use my location
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {picked ? <>Picked: <span className="font-medium text-foreground">{picked}</span>. Add your house number or landmark below if needed.</> : 'Start typing to see real places, then pick yours. You can also type the address yourself below.'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm text-muted-foreground">
              Label
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} maxLength={30} placeholder="Home, Office…" className="input-dark mt-1 w-full" />
            </label>
            <label className="block space-y-1 text-sm text-muted-foreground sm:col-span-2">
              House no., street, barangay *
              <input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} autoComplete="street-address" placeholder="e.g. 12 Rizal Street, Brgy. San Isidro" className="input-dark mt-1 w-full" />
            </label>
            <label className="block space-y-1 text-sm text-muted-foreground">
              City *
              <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} autoComplete="address-level2" placeholder="e.g. Quezon City" className="input-dark mt-1 w-full" />
            </label>
            <label className="block space-y-1 text-sm text-muted-foreground">
              Phone for the driver
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" className="input-dark mt-1 w-full" />
            </label>
          </div>
          <div className="flex gap-2">
            {list && list.length > 0 && <button type="button" onClick={() => { setAdding(false); setPicked(''); setMsg(null); }} className="btn-secondary flex-1 text-sm">Cancel</button>}
            <button type="submit" disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">
              {busy && <Loader2 size={14} className="animate-spin" />} Save address
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setAdding(true); setMsg(null); }} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm">
          <Plus size={14} /> Add an address
        </button>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </div>
  );
}

function AddressText({ a }: { a: SavedAddress }) {
  return (
    <span className="min-w-0 text-sm">
      <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
        {a.label}
        {a.is_default && <span className="badge status-ok">Default</span>}
      </span>
      <span className="block text-muted-foreground">{a.street}, {a.city}</span>
      {a.phone && <span className="block text-xs text-muted-foreground">{a.phone}</span>}
    </span>
  );
}
