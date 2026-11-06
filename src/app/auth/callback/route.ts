import { NextRequest, NextResponse } from 'next/server';
import { requestOrigin } from '@/lib/requestOrigin';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin-dashboard',
  staff: '/staff-dashboard',
  customer: '/customer-dashboard',
};

// Where the links in Supabase's emails land (confirm sign-up, sign-in link, change email): the one-time code becomes a
// session, then the person goes to their own home page (or to `next`, when the link asked for a page). A used or
// expired link goes back to sign in with a note. Two-step sign-in still applies: the middleware asks for the code.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
  const code = searchParams.get('code');
  const wanted = searchParams.get('next');
  const next = wanted && wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : null;

  if (code) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (next) return NextResponse.redirect(`${origin}${next}`);
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', data.user.id).maybeSingle();
      return NextResponse.redirect(`${origin}${ROLE_HOME[profile?.role ?? ''] ?? '/customer-dashboard'}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-up-login-screen?link=expired`);
}
