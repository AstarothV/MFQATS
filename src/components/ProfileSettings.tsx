'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, Mail, MapPin, Trash2, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import MfaSettings from '@/components/MfaSettings';
import { isViewer, VIEW_ONLY_MESSAGE } from '@/lib/viewer';
import AvatarCropper from '@/components/AvatarCropper';
import AddressBook from '@/components/AddressBook';
import { phDigits, phPhone, PH_MOBILE } from '@/lib/delivery';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABEL: Record<string, string> = { admin: 'Supervisor', staff: 'Worker', customer: 'Customer' };

type Msg = { ok: boolean; text: string } | null;
const Note = ({ msg }: { msg: Msg }) => msg && (
  <p role="status" className={`flex items-center gap-1.5 text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.ok && <Check size={14} />}{msg.text}</p>
);

// The signed-in person's own settings: photo, name/nickname/phone, sign-in email, and two-step sign-in.
// Role and department are set by an admin, so they are only shown here.
export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = useRef(createClient()).current;
  const fileRef = useRef<HTMLInputElement>(null);

  const [names, setNames] = useState({ first: '', middle: '', last: '' });
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [phone, setPhone] = useState(''); // the 10 digits after +63
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<Msg>(null);

  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null); // a picked photo, being positioned before upload
  const [photoMsg, setPhotoMsg] = useState<Msg>(null);
  const [askFirst, confirmBox] = useConfirm();

  // the form starts from the profile once it has loaded (only the first time, so typing is never overwritten)
  const loaded = useRef(false);
  useEffect(() => {
    if (!profile || loaded.current) return;
    loaded.current = true;
    setNames(nameParts(profile));
    setNickname(profile.nickname ?? '');
    setPhone(phDigits(profile.phone ?? ''));
  }, [profile]);

  const name = profile?.full_name || 'Your profile';
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const was = profile ? nameParts(profile) : { first: '', middle: '', last: '' };
  const changed = (['first', 'middle', 'last'] as const).some((k) => names[k].trim() !== was[k]) || nickname.trim() !== (profile?.nickname ?? '') || phone !== phDigits(profile?.phone ?? '');

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    const first = names.first.trim(), middle = names.middle.trim(), last = names.last.trim(), nick = nickname.trim();
    if (!first || !last) return setDetailsMsg({ ok: false, text: 'Please enter your first and last name.' });
    if (phone && !PH_MOBILE.test(phone)) return setDetailsMsg({ ok: false, text: 'Enter a mobile number like 917 123 4567 (10 digits after +63).' });
    const n = [first, middle, last].filter(Boolean).join(' '), tel = phone ? phPhone(phone) : '';
    if (!user) return;
    setSavingDetails(true); setDetailsMsg(null);
    const { error } = await supabase.from('user_profiles').update({ full_name: n, first_name: first, middle_name: middle, last_name: last, nickname: nick, phone: tel }).eq('id', user.id);
    setSavingDetails(false);
    if (error) return setDetailsMsg({ ok: false, text: 'Could not save. Please try again.' });
    await refreshProfile();
    setDetailsMsg({ ok: true, text: 'Saved.' });
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const to = newEmail.trim().toLowerCase();
    if (!EMAIL.test(to)) return setEmailMsg({ ok: false, text: 'Enter a valid email address.' });
    if (to === user?.email) return setEmailMsg({ ok: false, text: 'That is already your email.' });
    setSavingEmail(true); setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: to }, { emailRedirectTo: `${window.location.origin}/auth/callback` });
    setSavingEmail(false);
    if (error) return setEmailMsg({ ok: false, text: /registered|exists/i.test(error.message) ? 'That email is already used by another account.' : 'Could not change the email. Please try again.' });
    setNewEmail('');
    setEmailMsg({ ok: true, text: `Check ${to} (and your current inbox) for a confirmation link. The change happens once you open it.` });
  }

  // a picked photo opens the adjuster first; it is uploaded only when saved there
  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setPhotoMsg({ ok: false, text: 'Choose a photo (JPG, PNG or WebP).' });
    setPhotoMsg(null);
    setCropFile(file);
  }

  async function uploadPhoto(blob: Blob) {
    if (!user) return;
    setPhotoBusy(true); setPhotoMsg(null);
    try {
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: true });
      if (upErr) throw new Error(/bucket/i.test(upErr.message) ? 'Photo storage is not set up yet (migration 021).' : 'Could not upload the photo.');
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      await removeOldPhoto();
      const { error } = await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw new Error('Could not save the photo.');
      await refreshProfile();
      setCropFile(null);
      setPhotoMsg({ ok: true, text: 'Photo updated.' });
    } catch (err: any) {
      setPhotoMsg({ ok: false, text: err?.message || 'Could not update the photo.' });
    } finally {
      setPhotoBusy(false);
    }
  }

  // the previous photo file, if it is one of ours
  async function removeOldPhoto() {
    const old = profile?.avatar_url ?? '';
    const marker = '/storage/v1/object/public/avatars/';
    if (old.includes(marker)) await supabase.storage.from('avatars').remove([old.split(marker)[1]]);
  }

  async function removePhoto() {
    if (!user || !profile?.avatar_url) return;
    if (!(await askFirst({ title: 'Remove your photo?', message: 'Your initials are shown instead. You can add a photo again anytime.', confirmLabel: 'Remove', cancelLabel: 'Keep it', danger: true }))) return;
    setPhotoBusy(true); setPhotoMsg(null);
    await removeOldPhoto();
    const { error } = await supabase.from('user_profiles').update({ avatar_url: '' }).eq('id', user.id);
    setPhotoBusy(false);
    if (error) return setPhotoMsg({ ok: false, text: 'Could not remove the photo.' });
    await refreshProfile();
    setPhotoMsg({ ok: true, text: 'Photo removed.' });
  }

  const pendingEmail = (user as any)?.new_email as string | undefined;
  const viewer = isViewer(user);

  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">Account</p>
        <h1 className="page-title">Profile settings</h1>
        <p className="page-subtitle">Your photo, details, {profile?.role === 'customer' ? 'delivery addresses, ' : ''}sign-in email and two-step sign-in.</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* who you are */}
        <section className="card-dark space-y-4 p-6 text-center">
          <div className="relative mx-auto h-28 w-28">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary text-3xl font-bold text-primary-foreground ring-4 ring-primary/15">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={`${name}'s photo`} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : initials}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label="Change photo"
              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-60">
              {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} className="hidden" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{profile?.nickname || name}</p>
            {profile?.nickname && <p className="text-sm text-muted-foreground">{name}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{ROLE_LABEL[profile?.role ?? ''] ?? ''} account</p>
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} className="btn-secondary text-sm">Change photo</button>
            {profile?.avatar_url && (
              <button type="button" onClick={removePhoto} disabled={photoBusy} aria-label="Remove photo" className="btn-ghost flex items-center gap-1.5 text-sm text-danger hover:text-danger">
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          <Note msg={photoMsg} />
          {confirmBox}
          {cropFile && <AvatarCropper file={cropFile} saving={photoBusy} onCancel={() => setCropFile(null)} onSave={uploadPhoto} />}
        </section>

        <div className="space-y-4">
          {/* personal details */}
          <form onSubmit={saveDetails} className="card-dark space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><User size={16} className="text-primary dark:text-accent" /> Personal details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {([['first', 'First name', 'given-name', ''], ['middle', 'Middle name', 'additional-name', '(optional)'], ['last', 'Last name', 'family-name', '']] as const).map(([k, label, ac, note]) => (
                <label key={k} className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground/80">{label} {note && <span className="font-normal text-muted-foreground">{note}</span>}</span>
                  <input value={names[k]} onChange={(e) => setNames((v) => ({ ...v, [k]: e.target.value }))} maxLength={40} autoComplete={ac} className="input-dark w-full" />
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground/80">Nickname <span className="font-normal text-muted-foreground">(optional, shown at the top)</span></span>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} autoComplete="nickname" placeholder="What should we call you?" className="input-dark w-full" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground/80">Mobile number</span>
                <span className="flex">
                  <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-sm text-foreground">+63</span>
                  <input value={phone} onChange={(e) => setPhone(phDigits(e.target.value))} maxLength={16} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="917 123 4567" className="input-dark w-full rounded-l-none" />
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={savingDetails || !changed} className="btn-primary flex items-center gap-2 text-sm">
                {savingDetails && <Loader2 size={14} className="animate-spin" />} Save changes
              </button>
              <Note msg={detailsMsg} />
            </div>
          </form>

          {/* customers: where orders are delivered */}
          {profile?.role === 'customer' && !viewer && (
            <section className="card-dark space-y-4 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><MapPin size={16} className="text-primary dark:text-accent" /> Delivery addresses</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pin each address on the map. At checkout you pick one, and the delivery fee is worked out from the distance to the store.</p>
              </div>
              <AddressBook />
            </section>
          )}

          {viewer && (
            <p className="card-dark p-6 text-sm text-muted-foreground">{VIEW_ONLY_MESSAGE} The sign-in email and two-step sign-in can only be changed on a normal account.</p>
          )}
          {/* sign-in email */}
          {!viewer && <form onSubmit={changeEmail} className="card-dark space-y-4 p-6">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Mail size={16} className="text-primary dark:text-accent" /> Email</h2>
              <p className="mt-1 text-sm text-muted-foreground">You sign in with <span className="font-semibold text-foreground">{user?.email}</span>.{pendingEmail ? ` Waiting for you to confirm ${pendingEmail}.` : ''}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground/80">New email</span>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@mail.com" className="input-dark w-full" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={savingEmail || !newEmail.trim()} className="btn-secondary flex items-center gap-2 text-sm">
                {savingEmail && <Loader2 size={14} className="animate-spin" />} Change email
              </button>
              <Note msg={emailMsg} />
            </div>
          </form>}

          {/* two-step sign-in */}
          {!viewer && (
            <section className="card-dark p-6">
              <MfaSettings />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// first / middle / last from the profile; accounts made before the name was split keep only full_name, so it is split
// here (last word = last name) until the person saves
function nameParts(p: { full_name?: string; first_name?: string; middle_name?: string; last_name?: string }) {
  if (p.first_name || p.last_name) return { first: p.first_name ?? '', middle: p.middle_name ?? '', last: p.last_name ?? '' };
  const w = (p.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  return { first: w.slice(0, -1).join(' ') || (w[0] ?? ''), middle: '', last: w.length > 1 ? w[w.length - 1] : '' };
}
