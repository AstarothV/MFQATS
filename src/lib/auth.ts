import crypto from 'node:crypto';
import { DbUser } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'mvcawoodworks-secret-key-2026';
const TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour
const REMEMBER_ME_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

function base64UrlEncode(value: Buffer) {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string) {
  value = value.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Buffer.from(value, 'base64');
}

export function hashPassword(password: string, salt?: string) {
  const buffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, buffer, 64);
  return {
    salt: buffer.toString('hex'),
    hash: derived.toString('hex'),
  };
}

export function verifyPassword(password: string, hash: string, salt: string) {
  const derived = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}

export function createToken(user: Pick<DbUser, 'id' | 'email' | 'role'>, remember = false) {
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    Buffer.from(JSON.stringify({ sub: user.id, email: user.email, role: user.role, iat: now, exp: now + (remember ? REMEMBER_ME_EXPIRY_SECONDS : TOKEN_EXPIRY_SECONDS) }))
  );
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string) {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    if (!headerB64 || !payloadB64 || !signature) return null;
    const expected = base64UrlEncode(
      crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest()
    );
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf-8')) as {
      sub: string;
      email: string;
      role: string;
      iat: number;
      exp: number;
    };
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function serializeCookie(name: string, value: string, options: Record<string, string | number | boolean>) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  for (const [key, option] of Object.entries(options)) {
    if (option === true) {
      segments.push(key);
      continue;
    }
    if (option === false || option == null) {
      continue;
    }
    segments.push(`${key}=${option}`);
  }
  return segments.join('; ');
}

export function createSessionCookie(token: string, remember = false) {
  return serializeCookie('mvcawoodworks_session', token, {
    Path: '/',
    HttpOnly: true,
    Secure: process.env.NODE_ENV === 'production',
    SameSite: 'Lax',
    MaxAge: remember ? REMEMBER_ME_EXPIRY_SECONDS : TOKEN_EXPIRY_SECONDS,
  });
}

export function clearSessionCookie() {
  return serializeCookie('mvcawoodworks_session', '', {
    Path: '/',
    HttpOnly: true,
    Secure: process.env.NODE_ENV === 'production',
    SameSite: 'Lax',
    Expires: new Date(0).toUTCString(),
  });
}
