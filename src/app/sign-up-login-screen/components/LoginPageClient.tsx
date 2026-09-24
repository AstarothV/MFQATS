'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import {
  Eye, EyeOff, ChevronRight, Loader2, CheckCircle2, Hammer,
  Layers, Zap, AlertTriangle, Moon, SunMedium, ArrowLeft, User, Mail, Phone, Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type Role = 'staff' | 'admin' | 'customer';
type AuthTab = 'login' | 'register' | 'forgot' | 'reset' | 'verify-2fa';

type LoginForm = { email: string; password: string; remember: boolean };
type RegisterForm = { fullName: string; email: string; phone: string; password: string; confirmPassword: string };
type ForgotForm = { email: string };

const roleRedirect: Record<string, string> = {
  staff: '/staff-dashboard',
  admin: '/admin-dashboard',
  customer: '/customer-dashboard',
};

const features = [
  { icon: Hammer, label: 'AI-Assisted QA', desc: 'YOLOv8 defect detection on every piece' },
  { icon: Layers, label: 'Live WIP Tracking', desc: 'Real-time workstation visibility' },
  { icon: Zap, label: 'Auto Time Logging', desc: 'Persistent per-task elapsed timers' },
];

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();
  const supabase = createClient();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tab, setTab] = useState<AuthTab>('login');
  const [otpCode, setOtpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<LoginForm>({ defaultValues: { remember: false } });
  const { register: regRegister, handleSubmit: handleRegister, watch: watchReg, formState: { errors: regErrors } } = useForm<RegisterForm>();
  const { register: regForgot, handleSubmit: handleForgot, formState: { errors: forgotErrors } } = useForm<ForgotForm>();

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initialTheme = storedTheme === 'light' ? 'light' : 'dark';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    // Check if register tab requested
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'register') setTab('register');
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
    setTheme(curr => {
      const next = curr === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }

  async function onLogin(data: LoginForm) {
    setLoading(true);
    try {
      const result = await signIn(data.email, data.password);
      if (!result?.user) throw new Error('Login failed');

      showMessage('success', 'Signed in successfully');

      // Fetch user profile to get the role
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', result.user.id)
        .maybeSingle();

      const userRole = profileData?.role || 'staff';
      
      setLoading(false);
      
      // Redirect to appropriate dashboard based on role
      router.push(roleRedirect[userRole] || '/staff-dashboard');
    } catch (error: any) {
      setLoading(false);
      showMessage('error', error?.message || 'Invalid credentials. Please try again.');
    }
  }

  async function onRegister(data: RegisterForm) {
    if (data.password !== data.confirmPassword) {
      showMessage('error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signUp(data.email, data.password, {
        fullName: data.fullName,
        role: 'customer',
        phone: data.phone,
      });
      showMessage('success', 'Account created! Please check your email to verify your account.');
      setTab('login');
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
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback?next=/sign-up-login-screen`,
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

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-violet-700 to-purple-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <AppLogo size={40} />
            <div>
              <p className="text-white font-bold text-lg">MVCA WoodWorks</p>
              <p className="text-white/60 text-xs">Quality Assurance & Tracking</p>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Crafting Excellence,<br />One Piece at a Time
          </h1>
          <p className="text-white/70 text-base max-w-sm">
            AI-powered quality control, real-time production tracking, and AR furniture visualization.
          </p>
        </div>
        <div className="relative space-y-4">
          {features.map(f => {
            const FIcon = f.icon;
            return (
              <div key={f.label} className="flex items-center gap-4 rounded-2xl bg-white/10 backdrop-blur-sm p-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <FIcon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.label}</p>
                  <p className="text-white/60 text-xs">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col bg-background">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <button type="button" onClick={toggleTheme} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors">
            {theme === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">

            {/* Login Tab */}
            {tab === 'login' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
                  <p className="text-sm text-muted-foreground mt-1">Sign in to your MVCA account</p>
                </div>

                <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Email
                    <input {...register('email', { required: 'Email is required' })} type="email" className="input-dark w-full mt-1" placeholder="you@example.com" />
                    {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
                  </label>
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Password
                    <div className="relative mt-1">
                      <input {...register('password', { required: 'Password is required' })} type={showPass ? 'text' : 'password'} className="input-dark w-full pr-10" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
                  </label>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input {...register('remember')} type="checkbox" className="w-3.5 h-3.5 rounded" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => setTab('forgot')} className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                    Sign In
                  </button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setTab('register')} className="text-primary font-semibold hover:underline">
                    Register
                  </button>
                </p>
              </div>
            )}

            {/* Register Tab */}
            {tab === 'register' && (
              <div className="space-y-6">
                <div>
                  <button type="button" onClick={() => setTab('login')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft size={14} /> Back to login
                  </button>
                  <h2 className="text-2xl font-bold text-foreground">Create Account</h2>
                  <p className="text-sm text-muted-foreground mt-1">Join MVCA WoodWorks as a customer</p>
                </div>
                <form onSubmit={handleRegister(onRegister)} className="space-y-4">
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Full Name
                    <div className="relative mt-1">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input {...regRegister('fullName', { required: 'Full name is required' })} className="input-dark w-full pl-9" placeholder="Your full name" />
                    </div>
                    {regErrors.fullName && <p className="text-xs text-danger mt-1">{regErrors.fullName.message}</p>}
                  </label>
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Email Address
                    <div className="relative mt-1">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input {...regRegister('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })} type="email" className="input-dark w-full pl-9" placeholder="you@example.com" />
                    </div>
                    {regErrors.email && <p className="text-xs text-danger mt-1">{regErrors.email.message}</p>}
                  </label>
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Phone Number
                    <div className="relative mt-1">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input {...regRegister('phone')} type="tel" className="input-dark w-full pl-9" placeholder="+63 912 345 6789" />
                    </div>
                  </label>
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Password
                    <div className="relative mt-1">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input {...regRegister('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })} type={showPass ? 'text' : 'password'} className="input-dark w-full pl-9 pr-10" placeholder="Min 8 characters" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {regErrors.password && <p className="text-xs text-danger mt-1">{regErrors.password.message}</p>}
                  </label>
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Confirm Password
                    <div className="relative mt-1">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input {...regRegister('confirmPassword', { required: 'Please confirm password', validate: val => val === watchReg('password') || 'Passwords do not match' })} type={showConfirmPass ? 'text' : 'password'} className="input-dark w-full pl-9 pr-10" placeholder="Repeat password" />
                      <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {regErrors.confirmPassword && <p className="text-xs text-danger mt-1">{regErrors.confirmPassword.message}</p>}
                  </label>
                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Create Account
                  </button>
                </form>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setTab('login')} className="text-primary font-semibold hover:underline">Sign in</button>
                </p>
              </div>
            )}

            {/* Forgot Password Tab */}
            {tab === 'forgot' && (
              <div className="space-y-6">
                <div>
                  <button type="button" onClick={() => setTab('login')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft size={14} /> Back to login
                  </button>
                  <h2 className="text-2xl font-bold text-foreground">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a reset link</p>
                </div>
                <form onSubmit={handleForgot(onForgot)} className="space-y-4">
                  <label className="block space-y-1 text-sm text-muted-foreground">
                    Email Address
                    <input {...regForgot('email', { required: 'Email is required' })} type="email" className="input-dark w-full mt-1" placeholder="you@example.com" />
                    {forgotErrors.email && <p className="text-xs text-danger mt-1">{forgotErrors.email.message}</p>}
                  </label>
                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Send Reset Link
                  </button>
                </form>
              </div>
            )}

            {/* Reset Password Tab */}
            {tab === 'reset' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Check Your Email</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a password reset link to <strong>{pendingEmail}</strong>
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 p-5 text-center">
                  <Mail size={32} className="mx-auto mb-3 text-primary" />
                  <p className="text-sm text-muted-foreground">Click the link in your email to reset your password. The link expires in 1 hour.</p>
                </div>
                <button type="button" onClick={() => setTab('login')} className="btn-secondary w-full">
                  Back to Login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
