'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { findUserByEmail, addOtp } from '@/lib/db';
import { validateEmail } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
  }

  const email = body.email.trim();
  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();
  addOtp({
    id: crypto.randomUUID(),
    email: user.email,
    otp,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message: 'OTP has been sent to your email (simulated).' });
}
