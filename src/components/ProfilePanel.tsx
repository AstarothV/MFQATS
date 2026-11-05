'use client';

import React, { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const PHONE = /^[+\d][\d\s-]{6,19}$/; // e.g. 0917 123 4567 or +63 917 123 4567

// The signed-in person's own profile: name and account type at the top, then the details they can change themselves
// (full name, nickname, phone). Role and department are set by an admin, so they are not editable here.
export default function ProfilePanel({ accountLabel, onClose }: { accountLabel: string; onClose: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const changed = fullName.trim() !== (profile?.full_name ?? '') || nickname.trim() !== (profile?.nickname ?? '') || phone.trim() !== (profile?.phone ?? '');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim(), nick = nickname.trim(), tel = phone.trim();
    if (!name) return setMessage({ ok: false, text: 'Please enter your full name.' });
    if (tel && !PHONE.test(tel)) return setMessage({ ok: false, text: 'Enter a phone number like 0917 123 4567.' });
    if (!user) return;
    setSaving(true); setMessage(null);
    const { error } = await createClient().from('user_profiles').update({ full_name: name, nickname: nick, phone: tel }).eq('id', user.id);
    setSaving(false);
    if (error) {
      // the nickname column comes from migration 20261105000016; until it is run, say so instead of a database error
      const missing = /nickname/.test(error.message);
      return setMessage({ ok: false, text: missing ? 'Nickname needs the latest database update. Ask the admin to run it.' : 'Could not save. Please try again.' });
    }
    await refreshProfile();
    setMessage({ ok: true, text: 'Saved.' });
  }

  return (
    <div className="glass-menu absolute right-3 top-[76px] w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-bold text-foreground">{profile?.full_name || 'Your profile'}</h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{accountLabel} account</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close profile">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={save} className="space-y-3 p-5">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} autoComplete="name" className="input-dark w-full" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Nickname <span className="font-normal">(optional, shown at the top)</span></span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} autoComplete="nickname" placeholder="What should we call you?" className="input-dark w-full" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Phone number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" className="input-dark w-full" />
        </label>

        {message && (
          <p role="status" className={`flex items-center gap-1.5 text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>
            {message.ok && <Check size={14} />} {message.text}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Close</button>
          <button type="submit" disabled={saving || !changed} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">
            {saving && <Loader2 size={14} className="animate-spin" />} Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
