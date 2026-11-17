'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AlertTriangle, Check, Loader2, LocateFixed, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { currentPosition, phDigits, phPhone, placeAt, PH_MOBILE, SHOP_SPOT, type SavedAddress } from '@/lib/delivery';
import PlaceSearch from '@/components/PlaceSearch';

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-muted sm:h-80" /> });

type Spot = { lat: number; lng: number };
const EMPTY = { label: 'Home', street: '', city: '', phone: '' };

// A customer's saved delivery addresses (migrations 037, 038, 040), kept in Profile. Search for a place, use "Use my
// location", or tap / drag the pin on the map: the pin is what the delivery fee is measured from, so delivery needs a
// pinned address. In checkout, `onSelect` makes the list a picker; adding and editing stay in Profile.
export default function AddressBook({ selectedId, onSelect, onLoaded }: {
  selectedId?: string | null;
  onSelect?: (a: SavedAddress) => void;
  onLoaded?: (list: SavedAddress[]) => void;
}) {
  const supabase = useRef(createClient()).current;
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // the address being pinned or changed
  const [form, setForm] = useState(EMPTY);
  const [pin, setPin] = useState<Spot | null>(null);
  const [fitKey, setFitKey] = useState('0'); // the map re-frames when this changes (not while dragging)
  const [searchKey, setSearchKey] = useState(0); // a new key empties the search box
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askFirst, confirmBox] = useConfirm();
  const picker = !!onSelect;

  async function load() {
    const { data, error } = await supabase.from('customer_addresses').select('*').order('is_default', { ascending: false }).order('created_at');
    const rows = error ? [] : ((data ?? []) as SavedAddress[]);
    setList(rows);
    onLoaded?.(rows);
    if (rows.length === 0 && !picker) setAdding(true);
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const moveTo = (s: Spot) => { setPin(s); setFitKey(`${s.lat},${s.lng}`); };

  function close() { setAdding(false); setEditId(null); setForm(EMPTY); setPin(null); setMsg(null); }

  function edit(a: SavedAddress) {
    setEditId(a.id);
    setAdding(true);
    setForm({ label: a.label, street: a.street, city: a.city, phone: phDigits(a.phone) });
    if (a.lat != null && a.lng != null) moveTo({ lat: Number(a.lat), lng: Number(a.lng) }); else setPin(null);
    setMsg(a.lat == null ? { ok: false, text: 'Search for this address or tap the map to pin it.' } : null);
  }

  async function useMyLocation() {
    setBusy(true); setMsg(null);
    try {
      const pos = await currentPosition();
      moveTo(pos);
      setSearchKey((k) => k + 1);
      const p = await placeAt(pos.lat, pos.lng);
      if (p) setForm((f) => ({ ...f, street: p.street, city: p.city || f.city }));
      setMsg({ ok: true, text: 'Pinned where you are. Drag the pin if it is not exactly on your house, and add your house number below.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  // a tap on the map or a dragged pin: move the pin; fill in the street only when it is still empty
  async function onMapPick(lat: number, lng: number) {
    setPin({ lat, lng });
    if (!form.street.trim()) {
      const p = await placeAt(lat, lng);
      if (p) setForm((f) => (f.street.trim() ? f : { ...f, street: p.street, city: p.city || f.city }));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const street = form.street.trim(), city = form.city.trim(), digits = phDigits(form.phone);
    if (!street || !city) return setMsg({ ok: false, text: 'Enter the street and the city.' });
    if (!pin) return setMsg({ ok: false, text: 'Pin the address on the map: search for it, use your location, or tap the map.' });
    if (digits && !PH_MOBILE.test(digits)) return setMsg({ ok: false, text: 'Enter a mobile number like 917 123 4567 (10 digits after +63).' });
    setBusy(true); setMsg(null);
    const row = { label: form.label.trim() || 'Home', street, city, phone: digits ? phPhone(digits) : '', lat: pin.lat, lng: pin.lng };
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = editId
      ? await supabase.from('customer_addresses').update(row).eq('id', editId).select().single()
      : await supabase.from('customer_addresses').insert({ user_id: user?.id, ...row }).select().single();
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /lat|lng|column/i.test(error.message) ? 'Pinned addresses are not set up yet (migration 040).' : 'Could not save the address. Please try again.' });
    close();
    setMsg({ ok: true, text: 'Address saved.' });
    await load();
    if (data && onSelect) onSelect(data as SavedAddress);
  }

  async function makeDefault(a: SavedAddress) {
    if (!(await askFirst({ title: 'Make this your default address?', message: `${a.label}: ${a.street}, ${a.city}`, confirmLabel: 'Make default', cancelLabel: 'Cancel' }))) return;
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', a.id);
    await load();
  }

  async function remove(a: SavedAddress) {
    if (!(await askFirst({ title: 'Delete this address?', message: `${a.street}, ${a.city}`, confirmLabel: 'Delete', cancelLabel: 'Keep it', danger: true }))) return;
    await supabase.from('customer_addresses').delete().eq('id', a.id);
    if (editId === a.id) close();
    await load();
  }

  return (
    <div className="space-y-3">
      {confirmBox}
      {list === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading addresses…</p>
      ) : picker && list.length === 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-foreground">Add your delivery address first</p>
            <p className="mt-0.5 text-muted-foreground">You have no saved address yet. Add one in your profile and pin it on the map, then come back to place your order. Your cart is kept.</p>
            <Link href="/customer-dashboard/profile" className="btn-primary mt-3 inline-flex items-center gap-2 text-sm"><MapPin size={14} /> Add an address in Profile</Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2" role={picker ? 'radiogroup' : undefined} aria-label="Saved addresses">
          {list.map((a) => {
            const chosen = picker && selectedId === a.id;
            const unpinned = a.lat == null || a.lng == null;
            return (
              <li key={a.id}>
                <div className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${chosen ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  {picker ? (
                    <button type="button" role="radio" aria-checked={!!chosen} onClick={() => onSelect!(a)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${chosen ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{chosen && <Check size={10} />}</span>
                      <AddressText a={a} />
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0 text-primary dark:text-accent" /><AddressText a={a} /></div>
                  )}
                  {!picker && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => edit(a)} title={unpinned ? 'Pin on the map' : 'Edit'} aria-label={`Edit ${a.label}`} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                      {!a.is_default && (
                        <button type="button" onClick={() => makeDefault(a)} title="Make default" aria-label={`Make ${a.label} the default address`} className="btn-ghost p-1.5"><Star size={14} /></button>
                      )}
                      <button type="button" onClick={() => remove(a)} title="Delete" aria-label={`Delete ${a.label}`} className="btn-ghost p-1.5 text-danger hover:text-danger"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {picker && list && list.length > 0 && (
        <p className="text-xs text-muted-foreground">To add, change or pin an address, go to <Link href="/customer-dashboard/profile" className="font-medium text-primary underline-offset-2 hover:underline dark:text-accent">Profile</Link>.</p>
      )}

      {!picker && (adding ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold text-foreground">{editId ? 'Edit address' : 'New address'}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <PlaceSearch key={searchKey} near={pin} onPick={(p) => { setForm((f) => ({ ...f, street: p.street, city: p.city || f.city })); moveTo({ lat: p.lat, lng: p.lng }); setMsg(null); }} />
            </div>
            <button type="button" onClick={useMyLocation} disabled={busy} className="btn-secondary flex shrink-0 items-center justify-center gap-2 text-sm">
              <LocateFixed size={14} /> Use my location
            </button>
          </div>
          <LiveMap
            pins={[{ ...SHOP_SPOT, kind: 'shop', label: 'MVCA WoodWorks' }, ...(pin ? [{ ...pin, kind: 'home' as const, label: 'Your address' }] : [])]}
            onPick={onMapPick}
            fitKey={fitKey}
          />
          <p className="text-xs text-muted-foreground">
            {pin ? 'Drag the green pin, or tap the map, to put it exactly on your house. The delivery fee is measured from the store to this pin.' : 'Search for your street or barangay, use your location, or tap the map to drop a pin.'}
          </p>
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
            <label className="block space-y-1 text-sm text-muted-foreground sm:col-span-2">
              Mobile number for the driver
              <span className="mt-1 flex">
                <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-sm text-foreground">+63</span>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: phDigits(e.target.value) }))} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={16} placeholder="917 123 4567" className="input-dark w-full rounded-l-none" />
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            {(editId || (list && list.length > 0)) && <button type="button" onClick={close} className="btn-secondary flex-1 text-sm">Cancel</button>}
            <button type="submit" disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">
              {busy && <Loader2 size={14} className="animate-spin" />} Save address
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { close(); setAdding(true); }} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm">
          <Plus size={14} /> Add an address
        </button>
      ))}
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
        {(a.lat == null || a.lng == null) && <span className="badge status-warning">Not pinned</span>}
      </span>
      <span className="block text-muted-foreground">{a.street}, {a.city}</span>
      {a.phone && <span className="block text-xs text-muted-foreground">{a.phone}</span>}
    </span>
  );
}
