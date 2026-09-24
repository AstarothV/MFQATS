'use server';

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { findUserById } from '@/lib/db';

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/mvcawoodworks_session=([^;]+)/);
  if (!match) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const token = decodeURIComponent(match[1]);
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = findUserById(payload.sub);
  if (!user || !user.active) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
