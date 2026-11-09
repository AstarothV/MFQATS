'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { Archive, ArchiveRestore, Bell, ChevronDown, ChevronRight, Eye, Menu, X, LogOut, User, Moon, SunMedium, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { applyTheme, savedTheme } from '@/lib/theme';
import { notificationLink, readable } from '@/lib/notifications';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { dataUserId, isViewer, VIEW_ONLY_MESSAGE } from '@/lib/viewer';

interface TopbarProps {
  role: 'staff' | 'admin' | 'customer';
  onMenuToggle: () => void;
}

const roleLabel = { staff: 'Worker', admin: 'Supervisor', customer: 'Customer' };
// each role's profile settings page (inside the routes that role may open)
const PROFILE_PATH = { staff: '/staff/profile', admin: '/admin/profile', customer: '/customer-dashboard/profile' };
const roleColor = { staff: 'status-info', admin: 'status-warning', customer: 'status-ok' };

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
  archived_at?: string | null; // archived: kept, out of the inbox (migration 024)
}

export default function Topbar({ role, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const supabase = createClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifTab, setNotifTab] = useState<'inbox' | 'archived'>('inbox');
  const [notifError, setNotifError] = useState('');
  const [confirm, confirmBox] = useConfirm();
  const inbox = notifications.filter((n) => !n.archived_at);
  const archived = notifications.filter((n) => n.archived_at);
  const shownNotifs = notifTab === 'inbox' ? inbox : archived;
  const unreadCount = inbox.filter((n) => !n.is_read).length;
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    const initialTheme = savedTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme, false);

    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', dataUserId(user))
        .order('created_at', { ascending: false })
        .limit(40);
      if (data) setNotifications(data);
    };
    fetchNotifications();

    const channel = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${dataUserId(user)}` }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev.slice(0, 39)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
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

  // open what the notification is about, and mark it read
  async function openNotification(n: Notification) {
    const to = notificationLink(n, role);
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      void supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    if (!to) return;
    setNotifOpen(false);
    // the same page with another order: load it fresh so the page opens that order
    if (to.split('?')[0] === window.location.pathname) window.location.assign(to);
    else router.push(to);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  // Archive keeps a notification (the Archived tab) but takes it out of the inbox; Restore brings it back.
  async function setArchived(n: Notification, on: boolean) {
    const patch = on ? { archived_at: new Date().toISOString(), is_read: true } : { archived_at: null };
    const { error } = await supabase.from('notifications').update(patch).eq('id', n.id);
    if (error) { setNotifError(/archived_at/.test(error.message) ? 'Archiving needs the latest database update (migration 024).' : error.message); return; }
    setNotifError('');
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, ...patch } : x)));
  }

  async function removeNotification(n: Notification) {
    const { error } = await supabase.from('notifications').delete().eq('id', n.id);
    if (error) { setNotifError(error.message || 'Could not delete the notification.'); return; }
    setNotifError('');
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
  }

  // deletes every notification in the tab you are on (asks first: it cannot be undone)
  async function clearAll() {
    const ids = shownNotifs.map((n) => n.id);
    if (!user || !ids.length) return;
    const what = `${ids.length} ${notifTab === 'inbox' ? '' : 'archived '}notification${ids.length === 1 ? '' : 's'}`;
    if (!(await confirm({ title: `Clear ${what}?`, message: 'They are deleted for good. This cannot be undone.', confirmLabel: 'Clear all', cancelLabel: 'Keep them', danger: true }))) return;
    const { error } = await supabase.from('notifications').delete().in('id', ids);
    if (error) { setNotifError(error.message || 'Could not clear the notifications.'); return; }
    setNotifError('');
    setNotifications((prev) => prev.filter((x) => !ids.includes(x.id)));
  }

  const notifTypeColor: Record<string, string> = {
    info: 'text-info',
    warning: 'text-warning',
    error: 'text-danger',
    success: 'text-success',
  };

  return (
    <header className="glass-float fixed top-2.5 left-3 right-3 z-50 h-14 rounded-[18px]">
      <div className="flex h-full items-center justify-between gap-3 pl-3 pr-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden btn-ghost p-2"
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
          <Link href={role === 'admin' ? '/admin-dashboard' : role === 'staff' ? '/staff-dashboard' : '/customer-dashboard'} className="flex items-center gap-2" aria-label="MVCA WoodWorks: your home page">
            <AppLogo size={32} />
            <span className="hidden text-base font-semibold text-foreground sm:block">MVCA WoodWorks</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`badge ${roleColor[role]} hidden md:inline-flex`}>{roleLabel[role]}</span>
          {isViewer(user) && (
            <span className="badge status-warning inline-flex items-center gap-1" title={VIEW_ONLY_MESSAGE}>
              <Eye size={12} aria-hidden="true" /> <span className="sr-only sm:not-sr-only">View only</span>
            </span>
          )}

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

            {confirmBox}
            {notifOpen && (
              <div className="glass-menu fixed inset-x-3 top-[72px] z-50 p-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
                {notifError && <p role="alert" className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{notifError}</p>}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button type="button" onClick={markAllRead} className="text-xs text-accent hover:text-primary font-medium">
                        Mark all read
                      </button>
                    )}
                    {shownNotifs.length > 0 && (
                      <button type="button" onClick={clearAll} className="text-xs font-medium text-muted-foreground hover:text-danger">
                        Clear all
                      </button>
                    )}
                    <button type="button" onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground" title="Close notifications" aria-label="Close notifications">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Notification lists">
                  {(['inbox', 'archived'] as const).map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={notifTab === t} onClick={() => setNotifTab(t)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${notifTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {t === 'inbox' ? 'Inbox' : 'Archived'} <span className="font-normal opacity-70">{t === 'inbox' ? inbox.length : archived.length}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {shownNotifs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {notifTab === 'inbox' ? 'No notifications' : 'Nothing archived. Archive a notification to keep it here.'}
                    </p>
                  ) : (
                    shownNotifs.map((notif) => {
                      const link = notificationLink(notif, role);
                      const isArchived = !!notif.archived_at;
                      return (
                        <div key={notif.id}
                          className={`rounded-xl border transition-colors ${notif.is_read ? 'border-border bg-background' : 'border-primary/20 bg-primary/5'} ${link ? 'hover:border-primary/40' : ''}`}>
                          <button type="button" onClick={() => openNotification(notif)}
                            className={`group block w-full rounded-t-xl px-3 pt-3 text-left ${link ? '' : 'cursor-default'}`}>
                            <span className="flex items-start justify-between gap-2">
                              <span className={`text-xs font-semibold ${notifTypeColor[notif.notification_type] || 'text-foreground'}`}>{notif.title}</span>
                              {link && <ChevronRight size={14} className="mt-px shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{readable(notif.message)}</span>
                          </button>
                          <div className="flex items-center justify-between gap-2 pb-1 pl-3 pr-1">
                            <span className="text-2xs text-muted-foreground/60">{new Date(notif.created_at).toLocaleDateString()}</span>
                            <span className="flex items-center">
                              <button type="button" onClick={() => setArchived(notif, !isArchived)}
                                aria-label={`${isArchived ? 'Restore' : 'Archive'}: ${notif.title}`} title={isArchived ? 'Move back to the inbox' : 'Archive'}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                {isArchived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
                              </button>
                              <button type="button" onClick={() => removeNotification(notif)}
                                aria-label={`Delete: ${notif.title}`} title="Delete"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger">
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200 sm:h-9 sm:px-3"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 rounded-full bg-muted/60 py-1 pl-1 pr-2.5 hover:bg-muted transition-colors duration-200"
            >
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : initials}
              </div>
              <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">{profile?.nickname || displayName}</span>
              <ChevronDown size={14} className="text-muted-foreground hidden md:block" />
            </button>

            {userMenuOpen && (
              <div className="glass-menu absolute right-0 top-12 z-50 w-52 p-2">
                <div className="px-3 py-2 mb-1 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200"
                  onClick={() => { setUserMenuOpen(false); router.push(PROFILE_PATH[role]); }}
                >
                  <User size={14} /> Profile settings
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors duration-200 mt-1"
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
    </header>
  );
}
