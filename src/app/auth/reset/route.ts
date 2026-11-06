import { NextRequest, NextResponse } from 'next/server';
import { requestOrigin } from '@/lib/requestOrigin';

// Where a password-reset email's link lands (/auth/reset is in Supabase's Redirect URLs).
// The email's link carries a one-time token that works in any browser or phone. It is not used here: mail apps open
// links to scan them, which would use it up. The page uses it when the new password is saved. The token goes in the
// # part of the address, which never reaches a server or its logs.
// Older emails carry a `code` instead, which only works in the browser that asked for the reset.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = requestOrigin(request);
  const tokenHash = searchParams.get('token_hash');
  if (tokenHash && searchParams.get('type') === 'recovery') {
    return NextResponse.redirect(`${origin}/sign-up-login-screen?tab=new-password#token=${encodeURIComponent(tokenHash)}`);
  }

  const code = searchParams.get('code');

  if (code) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/sign-up-login-screen?tab=new-password`);
  }
  // no token, or an old link that expired or was opened in a different browser: ask for a new link
  return NextResponse.redirect(`${origin}/sign-up-login-screen?tab=forgot&expired=1`);
}
