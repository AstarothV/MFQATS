import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const { email, userId } = await request.json();

    if (!email || !userId) {
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous OTPs for this user
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('user_id', userId)
      .eq('is_used', false);

    // Store new OTP
    const { error: insertError } = await supabase.from('otp_codes').insert({
      user_id: userId,
      email,
      code,
      expires_at: expiresAt.toISOString(),
      is_used: false,
      attempt_count: 0,
    });

    if (insertError) {
      return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
    }

    // In production, send via email service (Resend, SendGrid, etc.)
    // For now, return the code in development (remove in production)
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email',
      // Only expose code in development
      ...(isDev && { code }),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, code } = await request.json();

    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    // Find valid OTP
    const { data: otpRecord, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !otpRecord) {
      return NextResponse.json({ error: 'OTP expired or not found. Please request a new one.' }, { status: 400 });
    }

    // Check attempt count (max 5 attempts)
    if (otpRecord.attempt_count >= 5) {
      await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRecord.id);
      return NextResponse.json({ error: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 });
    }

    if (otpRecord.code !== code) {
      // Increment attempt count
      await supabase.from('otp_codes').update({ attempt_count: otpRecord.attempt_count + 1 }).eq('id', otpRecord.id);
      return NextResponse.json({ error: 'Invalid OTP code. Please try again.' }, { status: 400 });
    }

    // Mark OTP as used
    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpRecord.id);

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}