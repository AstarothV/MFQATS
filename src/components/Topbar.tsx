'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import { Bell, ChevronDown, Menu, X, LogOut, User, Mail, Building2, ShieldCheck, Copy, Moon, SunMedium } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface TopbarProps {
  role: 'staff' | 'admin' | 'customer';
  onMenuToggle: () => void;
}

const roleLabel = { staff: 'Worker', admin: 'Supervisor', customer: 'Customer' };
const roleColor = { staff: 'status-info', admin: 'status-warning', customer: 'status-ok' };

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export default function Topbar({ role, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const supabase = createClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const profileImage = profile?.avatar_url || user?.user_metadata?.avatar_url || '';

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initialTheme = storedTheme === 'light' ? 'light' : 'dark';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }
    };
    fetchNotifications();

    const channel = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev.slice(0, 9)]);
        setUnreadCount((c) => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      return nextTheme;
    });
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/sign-up-login-screen');
    } catch {
      setLoggingOut(false);
    }
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function copyEmail() {
    if (!user?.email) return;
    await navigator.clipboard.writeText(user.email);
    setCopyMessage('Copied');
    window.setTimeout(() => setCopyMessage(''), 1500);
  }

  const notifTypeColor: Record<string, string> = {
    info: 'text-info',
    warning: 'text-warning',
    error: 'text-danger',
    success: 'text-success',
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-60 w-full border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto flex h-16 items-center justify-between gap-4 px-4 lg:px-8 xl:px-10 2xl:px-16">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { onMenuToggle(); setMobileMenuOpen(v => !v); }}
            className="lg:hidden btn-ghost p-2 rounded-xl border border-border hover:bg-muted transition-all"
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="hidden text-base font-semibold text-foreground sm:block">MVCA WoodWorks</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span className={`badge ${roleColor[role]} hidden md:inline-flex`}>{roleLabel[role]}</span>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
              className="btn-ghost relative p-2"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-2xs font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-3xl border border-border bg-card p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button type="button" onClick={markAllRead} className="text-xs text-accent hover:text-primary font-medium">
                        Mark all read
                      </button>
                    )}
                    <button type="button" onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground" title="Close notifications" aria-label="Close notifications">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No notifications</p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`rounded-xl border p-3 transition-colors ${notif.is_read ? 'border-border bg-background' : 'border-primary/20 bg-primary/5'}`}
                      >
                        <p className={`text-xs font-semibold ${notifTypeColor[notif.notification_type] || 'text-foreground'}`}>{notif.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                        <p className="text-2xs text-muted-foreground/60 mt-1">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 hover:bg-muted transition-all"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">{displayName}</span>
              <ChevronDown size={14} className="text-muted-foreground hidden md:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                <div className="px-3 py-2 mb-1 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  onClick={() => { setUserMenuOpen(false); setProfileOpen(true); }}
                >
                  <User size={14} /> Profile
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-all mt-1"
                >
                  <LogOut size={14} />
                  {loggingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close menus */}
      {(notifOpen || userMenuOpen) && (
        <button
          type="button"
          className="fixed inset-0 z-40"
          onClick={() => { setNotifOpen(false); setUserMenuOpen(false); }}
          aria-label="Close menu"
        />
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)}>
          <div
            className="absolute right-4 top-16 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-primary/15 via-background to-background p-5 border-b border-border/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Profile</p>
                  <h4 className="text-lg font-bold text-foreground mt-2">{displayName}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{roleLabel[role]} account</p>
                </div>
                <button type="button" onClick={() => setProfileOpen(false)} className="text-muted-foreground hover:text-foreground" title="Close profile" aria-label="Close profile">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-primary flex items-center justify-center shrink-0">
                    {profileImage ? (
                      <AppImage
                        src={profileImage}
                        alt={displayName}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary-foreground">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{profile?.role || role}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">{profile?.department || 'Operations'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail size={14} />
                  <span className="truncate">{user?.email || 'No email available'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck size={14} />
                  <span className="capitalize">{profile?.role || role}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 size={14} />
                  <span>{profile?.department || 'Operations'}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={copyEmail} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                  <Copy size={14} />
                  {copyMessage || 'Copy Email'}
                </button>
                <button type="button" onClick={() => setProfileOpen(false)} className="btn-primary flex-1 text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
