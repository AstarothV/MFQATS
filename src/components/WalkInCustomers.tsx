'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Link2, Loader2, Pencil, Plus, Search, Store, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import PlaceSearch from '@/components/PlaceSearch';
import { phDigits, phPhone, PH_MOBILE, SHOP_SPOT } from '@/lib/delivery';

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false, loading: () => <div className="h-52 w-full animate-pulse rounded-xl bg-muted" /> });

export type WalkInCustomer = {
  id: string; full_name: string; email: string | null; phone: string; street: string; city: string;
  lat: number | null; lng: number | null; linked_user_id: string | null;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// The admin's walk-in customer form (migration 044): name, mobile number, email (optional) and address with a map
// pin. No password: the record cannot sign in. When the email already has an online customer account, the record is
// joined to it at once; otherwise it is joined when that person registers and confirms the same email.
export function WalkInCustomerForm({ initial, onSaved, onCancel }: {
  initial?: WalkInCustomer | null; onSaved: (c: WalkInCustomer) => void; onCancel: () => void;
}) {
  const supabase = useRef(createClient()).current;
  const [name, setName] = useState(initial?.full_name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(phDigits(initial?.phone ?? ''));
  const [street, setStreet] = useState(initial?.street ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial?.lat != null && initial?.lng != null ? { lat: Number(initial.lat), lng: Number(initial.lng) } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [askFirst, confirmBox] = useConfirm();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' '), mail = email.trim().toLowerCase(), digits = phDigits(phone);
    if (!n) return setErr('Enter the customer name.');
    if (!PH_MOBILE.test(digits)) return setErr('Enter the mobile number: the 10 digits after +63.');
    if (mail && !EMAIL.test(mail)) return setErr('Check the email, or leave it empty.');
    if ((street.trim() || city.trim()) && !(street.trim() && city.trim())) return setErr('Enter both the street and the city, or leave the address empty.');
    // the email of a customer who already has an account: join to that account at once
    let account: { id: string; full_name: string } | null = null;
    if (mail) {
      const { data } = await supabase.from('user_profiles').select('id, full_name, role').ilike('email', mail).maybeSingle();
      if (data && data.role !== 'customer') return setErr('This email belongs to a staff or admin account. Use the customer\'s own email.');
      if (data) account = { id: data.id, full_name: data.full_name };
    }
    if (!(await askFirst({
      title: initial ? `Save changes to ${n}?` : `Add ${n} as a walk-in customer?`,
      message: account ? `${mail} already has an online account (${account.full_name}); store orders for this customer will show in that account.`
        : mail ? 'If they register on the website with this email and confirm it, their store orders join their account.'
        : 'Without an email, store orders stay with the shop only.',
      confirmLabel: initial ? 'Save' : 'Add customer', cancelLabel: 'Cancel',
    }))) return;
    setBusy(true); setErr('');
    const row = {
      full_name: n, email: mail || null, phone: phPhone(digits), street: street.trim(), city: city.trim(),
      lat: street.trim() && pin ? pin.lat : null, lng: street.trim() && pin ? pin.lng : null,
      ...(account ? { linked_user_id: account.id, linked_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = initial
      ? await supabase.from('walk_in_customers').update(row).eq('id', initial.id).select().single()
      : await supabase.from('walk_in_customers').insert(row).select().single();
    setBusy(false);
    if (error) {
      if (/walk_in_customers_email|duplicate/i.test(error.message)) return setErr('Another walk-in customer already has this email. Pick them from the list.');
      if (/walk_in_customers/.test(error.message)) return setErr('Walk-in customers need the latest database update (migration 044).');
      return setErr(error.message);
    }
    // joined to an online account: their earlier store orders show in that account too
    if (account) await supabase.from('orders').update({ customer_id: account.id }).eq('walk_in_customer_id', (data as WalkInCustomer).id).is('customer_id', null);
    onSaved(data as WalkInCustomer);
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
      {confirmBox}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm text-muted-foreground">Name *
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="input-dark mt-1 w-full" placeholder="Juan Dela Cruz" />
        </label>
        <label className="block space-y-1 text-sm text-muted-foreground">Mobile number *
          <span className="mt-1 flex">
            <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-sm text-foreground">+63</span>
            <input value={phone} onChange={(e) => setPhone(phDigits(e.target.value))} type="tel" inputMode="numeric" maxLength={16} className="input-dark w-full rounded-l-none" placeholder="917 123 4567" />
          </span>
        </label>
        <label className="block space-y-1 text-sm text-muted-foreground sm:col-span-2">Email <span className="font-normal">(optional; lets them see these orders online once they register with it)</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input-dark mt-1 w-full" placeholder="juan@mail.com" />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Address <span className="font-normal">(needed for delivery)</span></p>
        <PlaceSearch onPick={(pl) => { setStreet(pl.street); setCity(pl.city); setPin({ lat: pl.lat, lng: pl.lng }); }} />
        {(pin || street) && (
          <LiveMap className="h-52" pins={[{ ...SHOP_SPOT, kind: 'shop', label: 'MVCA WoodWorks' }, ...(pin ? [{ ...pin, kind: 'home' as const, label: name || 'Customer' }] : [])]}
            onPick={(lat, lng) => setPin({ lat, lng })} fitKey={pin ? `${street}` : '0'} />
        )}
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <input value={street} onChange={(e) => setStreet(e.target.value)} className="input-dark" placeholder="House no., street, barangay" aria-label="Street" />
          <input value={city} onChange={(e) => setCity(e.target.value)} className="input-dark" placeholder="City" aria-label="City" />
        </div>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2 text-sm">{busy && <Loader2 size={14} className="animate-spin" />} {initial ? 'Save changes' : 'Add customer'}</button>
      </div>
    </form>
  );
}

// User Management: the list of walk-in customers, with add, edit and delete (each asks first).
export default function WalkInCustomers() {
  const supabase = useRef(createClient()).current;
  const [list, setList] = useState<WalkInCustomer[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WalkInCustomer | 'new' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askFirst, confirmBox] = useConfirm();

  async function load() {
    const { data, error } = await supabase.from('walk_in_customers').select('*').order('full_name');
    setMissing(!!error && /walk_in_customers/.test(error.message));
    setList((data ?? []) as WalkInCustomer[]);
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(c: WalkInCustomer) {
    if (!(await askFirst({
      title: `Delete ${c.full_name}?`,
      message: 'Their details are removed from the walk-in list. Their orders stay, with the name kept on each order.',
      confirmLabel: 'Delete', cancelLabel: 'Keep', danger: true,
    }))) return;
    const { error } = await supabase.from('walk_in_customers').delete().eq('id', c.id);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `${c.full_name} was deleted.` });
    load();
  }

  const q = search.trim().toLowerCase();
  const shown = (list ?? []).filter((c) => !q || [c.full_name, c.email ?? '', c.phone].some((v) => v.toLowerCase().includes(q)));

  return (
    <section className="card-dark space-y-4 rounded-3xl border border-border p-6">
      {confirmBox}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Store size={18} className="text-primary dark:text-accent" /> Walk-in customers</h2>
          <p className="mt-1 text-sm text-muted-foreground">Customers who order at the store. No password: they cannot sign in until they register online with the same email and confirm it.</p>
        </div>
        {!editing && <button type="button" onClick={() => { setEditing('new'); setMsg(null); }} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Add walk-in customer</button>}
      </div>
      {missing && <p className="text-sm text-warning">Walk-in customers need the latest database update (migration 044).</p>}
      {editing && (
        <WalkInCustomerForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
          onSaved={(c) => { setEditing(null); setMsg({ ok: true, text: `${c.full_name} saved.` }); load(); }} />
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or number" aria-label="Search walk-in customers" className="input-dark w-full pl-9" />
      </div>
      {list === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{list.length ? 'No walk-in customer matches.' : 'No walk-in customers yet.'}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  {c.full_name}
                  {c.linked_user_id ? <span className="badge status-ok flex items-center gap-1"><Link2 size={11} /> Has an online account</span> : <span className="badge status-info">Walk-in</span>}
                </p>
                <p className="text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                {c.street && <p className="text-xs text-muted-foreground">{c.street}, {c.city}</p>}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => { setEditing(c); setMsg(null); }} aria-label={`Edit ${c.full_name}`} title="Edit" className="btn-ghost p-1.5"><Pencil size={14} /></button>
                <button type="button" onClick={() => remove(c)} aria-label={`Delete ${c.full_name}`} title="Delete" className="btn-ghost p-1.5 text-danger hover:text-danger"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
