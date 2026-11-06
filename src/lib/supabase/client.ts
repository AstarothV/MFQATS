import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';

const isSecureContext = () => {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
};

const canUseCookies = (() => {
  let cache: boolean | null = null;
  return () => {
    if (typeof document === 'undefined') return false;
    if (cache !== null) return cache;
    const k = '__sb_test__';
    // Try standard cookie first
    document.cookie = `${k}=1; Path=/; SameSite=Lax`;
    cache = document.cookie.includes(k);
    document.cookie = `${k}=; Path=/; Max-Age=0; SameSite=Lax`;
    
    // If standard fails, try with Secure flag
    if (!cache) {
      document.cookie = `${k}=1; Path=/; SameSite=None; Secure; Partitioned`;
      cache = document.cookie.includes(k);
      document.cookie = `${k}=; Path=/; Max-Age=0; SameSite=None; Secure`;
    }
    return cache;
  };
})();

const fromCookies = () =>
  typeof document === 'undefined'
    ? []
    : document.cookie
        .split(';')
        .filter(Boolean)
        .map((c) => {
          const trimmed = c.trim();
          const eqIdx = trimmed.indexOf('=');
          const name = eqIdx >= 0 ? trimmed.slice(0, eqIdx) : trimmed;
          const value = eqIdx >= 0 ? decodeURIComponent(trimmed.slice(eqIdx + 1)) : '';
          return { name: name.trim(), value };
        })
        .filter((c) => c.name);

const fromStorage = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch {
    return [];
  }
};

const setCookie = (name: string, value: string, options?: any) => {
  const secure = options?.secure ?? isSecureContext();
  const sameSite = secure ? 'None' : 'Lax';
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; SameSite=${sameSite}`;
  if (secure) s += '; Secure';
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  if (secure) s += '; Partitioned';
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = ['', host, host ? `.${host}` : ''].filter(Boolean);
  const variants = [
    'Path=/; SameSite=Lax',
    'Path=/; SameSite=None; Secure',
    'Path=/; SameSite=None; Secure; Partitioned',
  ];
  variants.forEach((attrs) => {
    document.cookie = `${name}=; Max-Age=0; ${attrs}`;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; Domain=${domain}; ${attrs}`;
    });
  });
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (canUseCookies() ? fromCookies() : fromStorage()),
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;
          if (canUseCookies()) {
            cookiesToSet.forEach(({ name, value, options }) =>
              value ? setCookie(name, value, options) : deleteCookie(name)
            );
          } else {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                if (value) localStorage.setItem(`${PFX}${name}`, value);
                else localStorage.removeItem(`${PFX}${name}`);
              } catch {
                /* storage blocked (private mode): the cookie below still holds the session */
              }
              if (value) setCookie(name, value, options);
            });
          }
        },
      },
    }
  );
}
