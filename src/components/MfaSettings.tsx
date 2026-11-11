'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { forgetRememberedDevices } from '@/lib/rememberDevice';

type Factor = { id: string; status: string };

// Two-step sign-in (optional): scan a QR code with an authenticator app, confirm with its first 6-digit code; from then
// on sign-in asks for a code after the password (the middleware and the database enforce it: migration 019).
export default function MfaSettings() {
  const supabase = React.useRef(createClient()).current;
  const [verified, setVerified] = useState<Factor | null | undefined>(undefined);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askFirst, confirmBox] = useConfirm();

  async function load() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setVerified(null); return; }
    setVerified((data?.totp ?? []).find((f: Factor) => f.status === 'verified') ?? null);
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true); setMsg(null);
    // an earlier setup that was never confirmed blocks a new one: remove it first
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of (data?.all ?? []) as Factor[]) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `MVCA WoodWorks ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !enrolled) {
      setMsg({ ok: false, text: /disabled|not enabled/i.test(error?.message ?? '') ? 'Two-step sign-in is not switched on for this site yet. Ask the admin.' : 'Could not start the setup. Please try again.' });
      return;
    }
    setSetup({ id: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!setup) return;
    const c = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) { setMsg({ ok: false, text: 'Enter the 6-digit code from the app.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code: c });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: 'That code did not work. Try the newest code in the app.' }); return; }
    setSetup(null); setCode('');
    await forgetAll();
    setMsg({ ok: true, text: 'Two-step sign-in is on.' });
    await load();
  }

  async function turnOff() {
    if (!verified || !(await askFirst({ title: 'Turn off two-step sign-in?', message: 'Signing in will only need your password.', confirmLabel: 'Turn it off', cancelLabel: 'Keep it on', danger: true }))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: 'Could not turn it off. Press "Forget remembered devices", sign out, sign in with your code, then try again.' });
      return;
    }
    await forgetAll();
    setMsg({ ok: true, text: 'Two-step sign-in is off.' });
    await load();
  }

  async function forgetAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await forgetRememberedDevices(supabase, user.id).catch(() => {}); // before migration 034: nothing to forget
  }

  async function forget() {
    if (!(await askFirst({ title: 'Forget remembered devices?', message: 'Every device, this one included, will ask for your 6-digit code at the next sign-in.', confirmLabel: 'Forget them', cancelLabel: 'Cancel' }))) return;
    setBusy(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      if (user) await forgetRememberedDevices(supabase, user.id);
      setMsg({ ok: true, text: 'No device is remembered now.' });
    } catch {
      setMsg({ ok: false, text: 'Could not forget the devices. Please try again.' });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {confirmBox}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldCheck size={15} className="text-primary dark:text-accent" /> Two-step sign-in</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {verified ? 'On: sign-in asks for a code from your authenticator app.' : 'Add a 6-digit code from an authenticator app (Google or Microsoft Authenticator) after your password.'}
          </p>
        </div>
        {verified === undefined ? <Loader2 size={15} className="mt-1 animate-spin text-muted-foreground" />
          : verified ? <span className="badge status-ok shrink-0">On</span> : null}
      </div>

      {setup ? (
        <form onSubmit={confirm} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">1. Scan this with your authenticator app.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code for your authenticator app" width={152} height={152} className="mx-auto rounded-xl bg-white p-2" />
          <p className="text-center text-[11px] text-muted-foreground">Can&apos;t scan? Type this key: <span className="select-all break-all font-mono text-foreground">{setup.secret}</span></p>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">2. Enter the 6-digit code it shows</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7}
              placeholder="000000" className="input-dark w-full text-center text-lg tracking-[0.4em] tabular-nums" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setSetup(null); setCode(''); }} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">
              {busy && <Loader2 size={14} className="animate-spin" />} Turn on
            </button>
          </div>
        </form>
      ) : verified ? (
        <div className="space-y-2">
          <button type="button" onClick={forget} disabled={busy} className="btn-secondary w-full text-sm disabled:opacity-50">Forget remembered devices</button>
          <button type="button" onClick={turnOff} disabled={busy} className="btn-secondary w-full text-sm disabled:opacity-50">Turn off two-step sign-in</button>
        </div>
      ) : verified === null ? (
        <button type="button" onClick={start} disabled={busy} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Set up two-step sign-in
        </button>
      ) : null}

      {msg && <p role="status" className={`flex items-center gap-1.5 text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.ok && <Check size={13} />}{msg.text}</p>}
    </div>
  );
}
