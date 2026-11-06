'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import {
  Eye, EyeOff, Loader2, CheckCircle2, ScanSearch, Layers, Timer, AlertTriangle, Moon, SunMedium, ArrowLeft,
  User, Mail, Phone, Lock, LogIn, UserPlus, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { logActivity } from '@/lib/activity';
import { applyTheme, savedTheme } from '@/lib/theme';
import Link from 'next/link';

type AuthTab = 'login' | 'register' | 'forgot' | 'reset' | 'new-password' | 'mfa' | 'confirm' | 'code' | 'code-verify';

type LoginForm = { email: string; password: string; remember: boolean };
type RegisterForm = { fullName: string; email: string; phone: string; password: string; confirmPassword: string };
type ForgotForm = { email: string };

const roleRedirect: Record<string, string> = {
  staff: '/staff-dashboard',
  admin: '/admin-dashboard',
  customer: '/customer-dashboard',
};

const features = [
  { icon: ScanSearch, label: 'Inspected before delivery', desc: 'Every side of each piece is scanned for defects' },
  { icon: Layers, label: 'Follow every stage', desc: 'See your order move from the workshop to your door' },
  { icon: Timer, label: 'Time per stage', desc: 'How long each stage took, kept with your order' },
];

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();
  const supabase = createClient();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tab, setTab] = useState<AuthTab>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LoginForm>({ defaultValues: { remember: false } });
  const { register: regRegister, handleSubmit: handleRegister, watch: watchReg, formState: { errors: regErrors } } = useForm<RegisterForm>();
  const { register: regForgot, handleSubmit: handleForgot, formState: { errors: forgotErrors } } = useForm<ForgotForm>();

  useEffect(() => {
    const initialTheme = savedTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme, false);

    // Check if register tab requested; 'new-password' is where the reset email's link lands
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'register') setTab('register');
    if (tabParam === 'new-password') setTab('new-password');
    if (tabParam === 'forgot') setTab('forgot');
    if (tabParam === 'mfa') setTab('mfa');
    if (searchParams?.get('link') === 'expired') showMessage('error', 'That email link has expired or was already used. Sign in, or ask for a new one.');
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown(v => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  function showMessage(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4000);
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  async function onLogin(data: LoginForm) {
    setLoading(true);
    try {
      let result;
      try {
        result = await signIn(data.email, data.password);
      } catch (err: any) {
        if (/not confirmed/i.test(err?.message ?? '')) {
          setLoading(false);
          setPendingEmail(data.email);
          setTab('confirm');
          showMessage('error', 'Confirm your email first: open the link we sent you.');
          return;
        }
        throw err;
      }
      if (!result?.user) throw new Error('Login failed');

      // two-step sign-in turned on: the 6-digit code comes next
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        setLoading(false);
        setTab('mfa');
        return;
      }
      showMessage('success', 'Signed in successfully');
      await goHome(result.user.id);
    } catch (error: any) {
      setLoading(false);
      showMessage('error', error?.message || 'Invalid credentials. Please try again.');
    }
  }

  // the signed-in person's home page, by role
  async function goHome(userId: string) {
    const { data: profileData } = await supabase.from('user_profiles').select('role').eq('id', userId).maybeSingle();
    setLoading(false);
    router.push(roleRedirect[profileData?.role || 'staff'] || '/staff-dashboard');
  }

  // second step: the 6-digit code from the authenticator app
  async function onMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code') || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) { showMessage('error', 'Enter the 6-digit code from your authenticator app.'); return; }
    setLoading(true);
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = factors?.totp?.[0];
      if (!factor) throw new Error('No authenticator app is set up for this account.');
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw new Error('That code did not work. Check the time on your phone and try the newest code.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Your session ended. Sign in again.');
      showMessage('success', 'Signed in successfully');
      await goHome(user.id);
    } catch (error: any) {
      setLoading(false);
      showMessage('error', error?.message || 'Could not check the code.');
    }
  }

  const linkBack = () => `${window.location.origin}/auth/callback`;

  // email confirmation: send the link again
  async function resendConfirmation() {
    if (!pendingEmail || resendCooldown > 0) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: linkBack() } });
    setLoading(false);
    if (error) { showMessage('error', /rate|seconds/i.test(error.message) ? 'Please wait a minute before asking again.' : 'Could not send the email. Try again later.'); return; }
    setResendCooldown(60);
    showMessage('success', 'Confirmation email sent again.');
  }

  // sign in with a code from email: only for accounts that already exist (a code never creates one), and the reply
  // never says whether an email has an account
  async function sendCode(email: string) {
    const to = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { showMessage('error', 'Enter a valid email.'); return; }
    if (resendCooldown > 0 && to === pendingEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: to, options: { shouldCreateUser: false, emailRedirectTo: linkBack() } });
    setLoading(false);
    if (error && /rate|seconds/i.test(error.message)) { showMessage('error', 'Please wait a minute before asking for another code.'); return; }
    setPendingEmail(to);
    setResendCooldown(60);
    setTab('code-verify');
    showMessage('success', 'If an account uses this email, a code is on its way.');
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get('code') || '').replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) { showMessage('error', 'Enter the code from the email.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });
      if (error || !data.user) throw new Error('That code did not work or has expired. Ask for a new one.');
      // two-step sign-in still applies
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') { setLoading(false); setTab('mfa'); return; }
      showMessage('success', 'Signed in successfully');
      await goHome(data.user.id);
    } catch (err: any) {
      setLoading(false);
      showMessage('error', err?.message || 'Could not check the code.');
    }
  }

  async function cancelMfa() {
    await supabase.auth.signOut();
    setTab('login');
  }

  // The reset link signed the person in for this one purpose; save the new password, then open their home page.
  async function onNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('newPassword') || '');
    if (password.length < 8) { showMessage('error', 'Use at least 8 characters.'); return; }
    if (password !== String(form.get('confirmNewPassword') || '')) { showMessage('error', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('This reset link has expired or was opened in another browser. Request a new one.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await logActivity(supabase, 'password_changed');
      const { data: profileData } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
      showMessage('success', 'Password changed.');
      router.push(roleRedirect[profileData?.role || 'staff'] || '/staff-dashboard');
    } catch (error: any) {
      showMessage('error', error?.message || 'Could not change the password.');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(data: RegisterForm) {
    if (data.password !== data.confirmPassword) {
      showMessage('error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const created = await signUp(data.email, data.password, {
        fullName: data.fullName,
        role: 'customer',
        phone: data.phone,
      });
      if (created?.session && created.user) {
        showMessage('success', 'Account created.');
        await goHome(created.user.id);
        return;
      }
      setPendingEmail(data.email);
      setResendCooldown(60);
      setTab('confirm');
      reset();
    } catch (error: any) {
      showMessage('error', error?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onForgot(data: ForgotForm) {
    setLoading(true);
    try {
      // The link comes back to /auth/reset on the address in use (localhost or the tunnel), which must be in
      // Supabase's Redirect URLs. It has to be opened in this same browser: the one-time code is kept in its cookies.
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setPendingEmail(data.email);
      showMessage('success', 'Password reset email sent. Check your inbox.');
      setResendCooldown(60);
      setTab('reset');
    } catch (error: any) {
      showMessage('error', error?.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  // one field row: label, an icon inside the input, and the error under it
  const field = (label: string, Icon: typeof Mail, input: React.ReactNode, error?: string, trailing?: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground/80">{label}</span>
      <span className="relative block">
        <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        {input}
        {trailing}
      </span>
      {error && <span role="alert" className="mt-1.5 block text-xs text-danger">{error}</span>}
    </label>
  );
  const eye = (shown: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} aria-label={shown ? 'Hide password' : 'Show password'}
      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
  const back = (
    <button type="button" onClick={() => setTab('login')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft size={14} /> Back to sign in
    </button>
  );
  const switcher = tab === 'login' || tab === 'register';

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Toast */}
      {toast && (
        <div role="status" className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Top bar: the same floating glass bar as inside the app */}
      <header className="glass-float relative z-10 mx-3 mt-2.5 flex h-14 items-center justify-between rounded-[18px] px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <AppLogo size={30} />
          <span className="text-base font-bold text-foreground">MVCA WoodWorks</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/" className="btn-ghost hidden items-center gap-1.5 text-sm sm:inline-flex">
            <ArrowLeft size={15} /> Back to Home
          </Link>
          <button type="button" onClick={toggleTheme} className="btn-ghost flex items-center gap-1.5 text-sm" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <SunMedium size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {/* fills the screen under the top bar and centers everything in it, so nothing needs scrolling */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-12">
        {/* Brand side (wide screens) */}
        <section className="hidden lg:block">
          <p className="page-eyebrow hero-rise">Quality Assurance &amp; Tracking</p>
          <h1 className="hero-rise text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-foreground xl:text-[44px]" style={{ '--d': '80ms' } as React.CSSProperties}>
            Crafting excellence,<br />
            <span className="text-primary dark:text-accent">one piece at a time.</span>
          </h1>
          <p className="hero-rise mt-4 max-w-md text-base text-muted-foreground" style={{ '--d': '160ms' } as React.CSSProperties}>
            Order handcrafted furniture and follow it through every stage, from the workshop to inspection to your door.
          </p>
          <ul className="mt-7 max-w-md space-y-2.5">
            {features.map((f, i) => {
              const FIcon = f.icon;
              return (
                <li key={f.label} className="hero-rise card-dark flex items-center gap-3.5 px-4 py-3" style={{ '--d': `${260 + i * 90}ms` } as React.CSSProperties}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:text-accent">
                    <FIcon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The form, in a glass card */}
        <section className="page-enter card-dark mx-auto flex w-full max-w-[480px] flex-col rounded-3xl p-6 lg:min-h-[486px] [@media(max-height:620px)]:lg:min-h-[436px] [@media(max-height:620px)]:py-5">
          {switcher && (
            <div role="tablist" aria-label="Sign in or register" className="relative mb-5 grid grid-cols-2 rounded-xl bg-muted/70 p-1 [@media(max-height:620px)]:mb-4">
              <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-primary shadow-[0_6px_16px_-8px_var(--primary)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${tab === 'register' ? 'translate-x-full' : ''}`} />
              {(['login', 'register'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`relative z-10 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${tab === t ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>
          )}

          <div key={tab} className="tab-in flex flex-1 flex-col justify-center">
            {/* Sign in */}
            {tab === 'login' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Welcome back</h2>
                  <p className="mt-1 text-sm text-muted-foreground [@media(max-height:620px)]:hidden">Sign in to your MVCA WoodWorks account.</p>
                </div>
                <form onSubmit={handleSubmit(onLogin)} className="space-y-3" noValidate>
                  {field('Email', Mail,
                    <input {...register('email', { required: 'Enter your email' })} type="email" autoComplete="email" className="input-dark w-full pl-10" placeholder="you@example.com" />,
                    errors.email?.message)}
                  {field('Password', Lock,
                    <input {...register('password', { required: 'Enter your password' })} type={showPass ? 'text' : 'password'} autoComplete="current-password" className="input-dark w-full pl-10 pr-11" placeholder="Your password" />,
                    errors.password?.message, eye(showPass, () => setShowPass(!showPass)))}
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input {...register('remember')} type="checkbox" className="h-4 w-4 rounded border-border" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => setTab('forgot')} className="-my-1.5 py-1.5 text-sm font-medium text-primary hover:underline dark:text-accent">
                      Forgot password?
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Sign in
                  </button>
                </form>
                <button type="button" onClick={() => setTab('code')} className="mx-auto flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <Mail size={14} aria-hidden="true" /> Email me a sign-in code instead
                </button>
              </div>
            )}

            {/* Sign in with a code from email: 1) the email, 2) the code */}
            {tab === 'code' && (
              <div className="space-y-4">
                <div>
                  {back}
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Sign in with a code</h2>
                  <p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you a 6-digit code. No password needed.</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); void sendCode(String(new FormData(e.currentTarget).get('email') || '')); }} className="space-y-3" noValidate>
                  {field('Email', Mail,
                    <input name="email" type="email" autoComplete="email" defaultValue={pendingEmail} className="input-dark w-full pl-10" placeholder="you@example.com" />)}
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Send code
                  </button>
                </form>
              </div>
            )}

            {tab === 'code-verify' && (
              <div className="space-y-4">
                <div>
                  <button type="button" onClick={() => setTab('code')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft size={14} /> Use a different email
                  </button>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Enter your code</h2>
                  <p className="mt-1 text-sm text-muted-foreground">If an account uses <strong className="text-foreground">{pendingEmail}</strong>, a code is on its way. Check spam too.</p>
                </div>
                <form onSubmit={onCode} className="space-y-3" noValidate>
                  {field('Code from the email', ShieldCheck,
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} autoFocus
                      className="input-dark w-full pl-10 text-lg tracking-[0.4em] tabular-nums" placeholder="000000" />)}
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Sign in
                  </button>
                </form>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <button type="button" onClick={() => sendCode(pendingEmail)} disabled={loading || resendCooldown > 0} className="inline-flex min-h-8 items-center font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline dark:text-accent">
                    {resendCooldown > 0 ? `Send again in ${resendCooldown}s` : 'Send a new code'}
                  </button>
                  <button type="button" onClick={() => setTab('login')} className="inline-flex min-h-8 items-center text-muted-foreground hover:text-foreground">Use my password instead</button>
                </div>
              </div>
            )}

            {/* After registering (or signing in before confirming): confirm the email */}
            {tab === 'confirm' && (
              <div className="space-y-4 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary dark:text-accent">
                  <Mail size={26} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Confirm your email</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We sent a link to <strong className="text-foreground">{pendingEmail}</strong>. Open it to finish setting up your account, then you&apos;re signed in. Check spam too.
                  </p>
                </div>
                <button type="button" onClick={resendConfirmation} disabled={loading || resendCooldown > 0} className="btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {resendCooldown > 0 ? `Send again in ${resendCooldown}s` : 'Send the email again'}
                </button>
                <button type="button" onClick={() => setTab('login')} className="inline-flex min-h-8 items-center text-sm text-muted-foreground hover:text-foreground">Back to sign in</button>
              </div>
            )}

            {/* Register */}
            {tab === 'register' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Create your account</h2>
                  <p className="mt-1 text-sm text-muted-foreground [@media(max-height:620px)]:hidden">Order furniture and follow every stage to your door.</p>
                </div>
                <form onSubmit={handleRegister(onRegister)} className="space-y-3" noValidate>
                  {field('Full name', User,
                    <input {...regRegister('fullName', { required: 'Enter your full name' })} autoComplete="name" className="input-dark w-full pl-10" placeholder="Juan Dela Cruz" />,
                    regErrors.fullName?.message)}
                  <div className="grid gap-3 sm:grid-cols-2">
                  {field('Email', Mail,
                    <input {...regRegister('email', { required: 'Enter your email', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })} type="email" autoComplete="email" className="input-dark w-full pl-10" placeholder="you@mail.com" />,
                    regErrors.email?.message)}
                  {field('Phone number', Phone,
                    <input {...regRegister('phone')} type="tel" autoComplete="tel" className="input-dark w-full pl-10" placeholder="0917 123 4567" />)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field('Password', Lock,
                      <input {...regRegister('password', { required: 'Enter a password', minLength: { value: 8, message: 'At least 8 characters' } })} type={showPass ? 'text' : 'password'} autoComplete="new-password" className="input-dark w-full pl-10 pr-11" placeholder="8+ characters" />,
                      regErrors.password?.message, eye(showPass, () => setShowPass(!showPass)))}
                    {field('Confirm', Lock,
                      <input {...regRegister('confirmPassword', { required: 'Repeat the password', validate: (val) => val === watchReg('password') || 'Passwords do not match' })} type={showConfirmPass ? 'text' : 'password'} autoComplete="new-password" className="input-dark w-full pl-10 pr-11" placeholder="Repeat it" />,
                      regErrors.confirmPassword?.message, eye(showConfirmPass, () => setShowConfirmPass(!showConfirmPass)))}
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Create account
                  </button>
                </form>
              </div>
            )}

            {/* Two-step sign-in: the code from the authenticator app */}
            {tab === 'mfa' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Enter your code</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Open your authenticator app and type the 6-digit code for MVCA WoodWorks.</p>
                </div>
                <form onSubmit={onMfa} className="space-y-3" noValidate>
                  {field('6-digit code', ShieldCheck,
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} autoFocus
                      className="input-dark w-full pl-10 text-lg tracking-[0.4em] tabular-nums" placeholder="000000" />)}
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Verify and sign in
                  </button>
                </form>
                <button type="button" onClick={cancelMfa} className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft size={14} /> Use a different account
                </button>
              </div>
            )}

            {/* Forgot password */}
            {tab === 'forgot' && (
              <div className="space-y-4">
                <div>
                  {back}
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Reset your password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
                  {searchParams?.get('expired') && (
                    <p role="alert" className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                      That reset link has expired or was opened in a different browser. Send a new one, then open it in this browser.
                    </p>
                  )}
                </div>
                <form onSubmit={handleForgot(onForgot)} className="space-y-3" noValidate>
                  {field('Email', Mail,
                    <input {...regForgot('email', { required: 'Enter your email' })} type="email" autoComplete="email" className="input-dark w-full pl-10" placeholder="you@example.com" />,
                    forgotErrors.email?.message)}
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Send reset link
                  </button>
                </form>
              </div>
            )}

            {/* New password: where the reset email's link lands */}
            {tab === 'new-password' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Set a new password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
                </div>
                <form onSubmit={onNewPassword} className="space-y-3">
                  {field('New password', Lock,
                    <input name="newPassword" type={showPass ? 'text' : 'password'} autoComplete="new-password" minLength={8} required className="input-dark w-full pl-10 pr-11" placeholder="8+ characters" />,
                    undefined, eye(showPass, () => setShowPass(!showPass)))}
                  {field('Confirm new password', Lock,
                    <input name="confirmNewPassword" type={showPass ? 'text' : 'password'} autoComplete="new-password" minLength={8} required className="input-dark w-full pl-10" placeholder="Repeat it" />)}
                  <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Save new password
                  </button>
                </form>
              </div>
            )}

            {/* Reset link sent */}
            {tab === 'reset' && (
              <div className="space-y-4 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary dark:text-accent">
                  <Mail size={26} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.01em] text-foreground">Check your email</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We sent a reset link to <strong className="text-foreground">{pendingEmail}</strong>. Open it in this browser; it expires in 1 hour.
                  </p>
                </div>
                <button type="button" onClick={() => setTab('login')} className="btn-secondary w-full">
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      </main>
    </div>
  );
}
