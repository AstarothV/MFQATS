import { NextRequest, NextResponse } from 'next/server';
import { requestOrigin } from '@/lib/requestOrigin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
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
