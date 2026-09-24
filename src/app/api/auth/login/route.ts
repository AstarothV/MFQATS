'use server';

import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/db';
import { verifyPassword, createToken, createSessionCookie } from '@/lib/auth';
import { validateEmail, validatePassword } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
  }

  const email = body.email.trim();
  const password = body.password;
  const remember = Boolean(body.remember);

  if (!validateEmail(email) || !validatePassword(password)) {
    return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user || !user.active) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = createToken({ id: user.id, email: user.email, role: user.role }, remember);
  const cookie = createSessionCookie(token, remember);

  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  response.headers.set('Set-Cookie', cookie);
  return response;
}
