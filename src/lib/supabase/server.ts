import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function isSecureContext() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    return siteUrl.startsWith('https://');
  }

  return process.env.NODE_ENV === 'production';
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const secure = isSecureContext();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                sameSite: secure ? 'none' : 'lax',
                secure,
              })
            );
          } catch {
            // Server Component read-only context — expected
          }
        },
      },
    }
  );
}
