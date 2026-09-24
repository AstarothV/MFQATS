'use server';

import { NextRequest, NextResponse } from 'next/server';
import { findOtp, removeOtp, findUserByEmail, updateUser } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validateEmail, validatePassword, validateOtp } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.otp !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
  }

  const email = body.email.trim();
  const otp = body.otp.trim();
  const password = body.password;

  if (!validateEmail(email) || !validateOtp(otp) || !validatePassword(password)) {
    return NextResponse.json({ error: 'Invalid email, OTP, or password format' }, { status: 400 });
  }

  const otpRecord = findOtp(email, otp);
  if (!otpRecord) {
    return NextResponse.json({ error: 'OTP not found or invalid' }, { status: 400 });
  }

  if (new Date(otpRecord.expiresAt) < new Date()) {
    removeOtp(otpRecord.id);
    return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const passwordData = hashPassword(password);
  const updated = { ...user, passwordHash: passwordData.hash, passwordSalt: passwordData.salt };
  updateUser(updated);
  removeOtp(otpRecord.id);

  return NextResponse.json({ success: true, message: 'Password reset successfully' });
}
