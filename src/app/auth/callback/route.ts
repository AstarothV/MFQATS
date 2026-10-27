import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const wanted = searchParams.get('next') ?? '/';
  const next = wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : '/';

  if (code) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-up-login-screen`);
}
