'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { forgetRememberedDevices } from '@/lib/rememberDevice';

type Factor = { id: string; status: string };
type Msg = { ok: boolean; text: string } | null;

// Two-step sign-in (optional). Two ways, either or both: a 6-digit code from an authenticator app (Google or Microsoft
// Authenticator; migration 019), or a 6-digit code sent by email (migration 037). With both on, the person picks one at
// each sign-in. The middleware and the database enforce it (mfa_ok()).
export default function MfaSettings() {
  const supabase = React.useRef(createClient()).current;
  const [verified, setVerified] = useState<Factor | null | undefined>(undefined);
  const [emailOn, setEmailOn] = useState<boolean | undefined>(undefined);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [emailSetup, setEmailSetup] = useState(false); // a code was emailed to turn email codes on
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [askFirst, confirmBox] = useConfirm();

  async function load() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    setVerified(error ? null : (data?.totp ?? []).find((f: Factor) => f.status === 'verified') ?? null);
    const { data: steps, error: stepsError } = await supabase.rpc('my_second_steps');
    setEmailOn(stepsError ? false : Boolean(steps?.email)); // before migration 037: email codes are not offered
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const emailReady = emailOn !== undefined;

  // ---- authenticator app
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
    setEmailSetup(false); setCode('');
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
    setMsg({ ok: true, text: 'Authenticator app is on.' });
    await load();
  }

  async function turnOff() {
    if (!verified || !(await askFirst({ title: 'Turn off the authenticator app?', message: emailOn ? 'Sign-in will use the email code only.' : 'Signing in will only need your password.', confirmLabel: 'Turn it off', cancelLabel: 'Keep it on', danger: true }))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: 'Could not turn it off. Sign out, sign in with your app code, then try again.' });
      return;
    }
    await forgetAll();
    setMsg({ ok: true, text: 'Authenticator app is off.' });
    await load();
  }

  // ---- email code
  async function sendEmailCode() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('send_email_code');
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /wait/i.test(error.message) ? 'Please wait a minute before asking for another code.' : 'Could not send the email. Please try again.' }); return; }
    setSetup(null); setCode('');
    setEmailSetup(true);
    setMsg({ ok: true, text: 'We emailed you a 6-digit code.' });
  }

  async function confirmEmail(e: React.FormEvent) {
    e.preventDefault();
    const c = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) { setMsg({ ok: false, text: 'Enter the 6-digit code from the email.' }); return; }
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('verify_email_code', { code: c, turn_on: true });
    setBusy(false);
    if (error || data !== true) { setMsg({ ok: false, text: 'That code did not work or has expired. Ask for a new one.' }); return; }
    setEmailSetup(false); setCode('');
    setMsg({ ok: true, text: 'Email codes are on.' });
    await load();
  }

  async function turnOffEmail() {
    if (!(await askFirst({ title: 'Turn off email codes?', message: verified ? 'Sign-in will use the authenticator app only.' : 'Signing in will only need your password.', confirmLabel: 'Turn it off', cancelLabel: 'Keep it on', danger: true }))) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('turn_off_email_code');
    setBusy(false);
    if (error) { setMsg({ ok: false, text: 'Could not turn it off. Sign out, sign in with your code, then try again.' }); return; }
    await forgetAll();
    setMsg({ ok: true, text: 'Email codes are off.' });
    await load();
  }

  // ---- remembered devices
  async function forgetAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await forgetRememberedDevices(supabase, user.id).catch(() => {}); // before migration 034: nothing to forget
  }

  async function forget() {
    if (!(await askFirst({ title: 'Forget remembered devices?', message: 'Every device, this one included, will ask for your code at the next sign-in.', confirmLabel: 'Forget them', cancelLabel: 'Cancel' }))) return;
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

  const codeInput = (label: string) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7}
        placeholder="000000" className="input-dark w-full text-center text-lg tracking-[0.4em] tabular-nums" />
    </label>
  );
  const anyOn = Boolean(verified) || Boolean(emailOn);

  return (
    <div className="space-y-4">
      {confirmBox}
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldCheck size={15} className="text-primary dark:text-accent" /> Two-step sign-in</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          After your password, also enter a 6-digit code. Turn on one way or both; with both on, you choose at each sign-in.
        </p>
      </div>

      {/* authenticator app */}
      <div className="space-y-3 rounded-2xl border border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Smartphone size={14} /> Authenticator app</p>
            <p className="text-xs text-muted-foreground">Google Authenticator, Microsoft Authenticator or a similar app. Works without signal.</p>
          </div>
          {verified === undefined ? <Loader2 size={15} className="mt-1 animate-spin text-muted-foreground" />
            : verified ? <span className="badge status-ok shrink-0">On</span> : null}
        </div>
        {setup ? (
          <form onSubmit={confirm} className="space-y-3 rounded-2xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">1. In the app, add an account and scan this.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code for your authenticator app" width={152} height={152} className="mx-auto rounded-xl bg-white p-2" />
            <p className="text-center text-[11px] text-muted-foreground">Can&apos;t scan? Type this key: <span className="select-all break-all font-mono text-foreground">{setup.secret}</span></p>
            {codeInput('2. Enter the 6-digit code it shows')}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSetup(null); setCode(''); }} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">{busy && <Loader2 size={14} className="animate-spin" />} Turn on</button>
            </div>
          </form>
        ) : verified ? (
          <button type="button" onClick={turnOff} disabled={busy} className="btn-secondary w-full text-sm disabled:opacity-50">Turn off the authenticator app</button>
        ) : verified === null ? (
          <button type="button" onClick={start} disabled={busy} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />} Set up the authenticator app
          </button>
        ) : null}
      </div>

      {/* email code */}
      {emailReady && (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Mail size={14} /> Email code</p>
              <p className="text-xs text-muted-foreground">We email a new 6-digit code to your sign-in email each time. Needs no app.</p>
            </div>
            {emailOn && <span className="badge status-ok shrink-0">On</span>}
          </div>
          {emailSetup ? (
            <form onSubmit={confirmEmail} className="space-y-3 rounded-2xl bg-muted/40 p-3">
              {codeInput('Enter the 6-digit code we emailed you')}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEmailSetup(false); setCode(''); }} className="btn-secondary flex-1 text-sm">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm">{busy && <Loader2 size={14} className="animate-spin" />} Turn on</button>
              </div>
              <button type="button" onClick={sendEmailCode} disabled={busy} className="text-xs font-medium text-primary hover:underline dark:text-accent">Send a new code</button>
            </form>
          ) : emailOn ? (
            <button type="button" onClick={turnOffEmail} disabled={busy} className="btn-secondary w-full text-sm disabled:opacity-50">Turn off email codes</button>
          ) : (
            <button type="button" onClick={sendEmailCode} disabled={busy} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Set up email codes
            </button>
          )}
        </div>
      )}

      {anyOn && <button type="button" onClick={forget} disabled={busy} className="btn-secondary w-full text-sm disabled:opacity-50">Forget remembered devices</button>}
      {msg && <p role="status" className={`flex items-center gap-1.5 text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.ok && <Check size={13} />}{msg.text}</p>}
    </div>
  );
}
