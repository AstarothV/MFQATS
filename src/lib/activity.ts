import type { SupabaseClient } from '@supabase/supabase-js';

// Records a sign-in, sign-out, password change or opening of the system in the audit log, for the signed-in person
// (public.log_activity, see supabase/migrations/20261030000010_audit_logging.sql). Data changes are logged by the
// database itself. Never throws: a missing log must not stop anyone from using the system.
export type Activity = 'user_login' | 'user_logout' | 'system_access' | 'password_changed';

export async function logActivity(supabase: SupabaseClient, action: Activity, details: Record<string, unknown> = {}) {
  try {
    await supabase.rpc('log_activity', { p_action: action, p_entity_type: 'auth', p_details: details });
  } catch {
    // ignored on purpose
  }
}

// "Opened the system" is recorded once per browser tab session, not on every page.
const ACCESS_KEY = 'mfqats-access-logged';
export function markAccessLogged(userId: string) {
  try { sessionStorage.setItem(ACCESS_KEY, userId); } catch {}
}
export function accessAlreadyLogged(userId: string) {
  try { return sessionStorage.getItem(ACCESS_KEY) === userId; } catch { return true; }
}
