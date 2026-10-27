import { NextRequest, NextResponse } from 'next/server';
import { requestOrigin } from '@/lib/requestOrigin';

// Where a password-reset email's link lands. Its own address with no query string, so it matches Supabase's
// Redirect URLs exactly. Trades the one-time code for a session (the code's other half is a cookie set by the browser
// that asked for the reset), then opens the "Set a New Password" step.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
  const code = searchParams.get('code');

  if (code) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/sign-up-login-screen?tab=new-password`);
  }
  // no code, expired, or opened in a different browser: ask for a new link
  return NextResponse.redirect(`${origin}/sign-up-login-screen?tab=forgot&expired=1`);
}
