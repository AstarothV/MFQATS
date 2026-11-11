import type { SupabaseClient } from '@supabase/supabase-js';

// "Remember me" for two-step sign-in (migration 034): a remembered browser keeps a key for 30 days, one per account,
// and shows it after the password so the database lets this session in without the 6-digit code.
const slot = (userId: string) => `mfqats-device-key:${userId}`;
const read = (userId: string) => { try { return localStorage.getItem(slot(userId)); } catch { return null; } };
const write = (userId: string, key: string | null) => {
  try { if (key) localStorage.setItem(slot(userId), key); else localStorage.removeItem(slot(userId)); } catch { /* private mode: not remembered */ }
};

/** After the password: true when this browser is remembered for the account, so the code step can be skipped. */
export async function isRememberedDevice(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const key = read(userId);
  if (!key) return false;
  const { data, error } = await supabase.rpc('use_remembered_device', { device_key: key });
  if (error) return false; // e.g. migration 034 not run yet: ask for the code as before
  if (!data) write(userId, null); // expired or forgotten
  return data === true;
}

/** After the code was entered with Remember me checked: trust this browser for 30 days. */
export async function rememberThisDevice(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc('remember_this_device');
  if (!error && typeof data === 'string') write(userId, data);
}

/** Every browser of this account stops being remembered (this one too). */
export async function forgetRememberedDevices(supabase: SupabaseClient, userId: string) {
  write(userId, null);
  const { error } = await supabase.rpc('forget_remembered_devices');
  if (error) throw error;
}
