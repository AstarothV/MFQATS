import type { NextRequest } from 'next/server';

/** The address the visitor actually used. Behind the Cloudflare tunnel the server sees itself as localhost, so
 *  request.url would send them to https://localhost:4028; the tunnel passes the real host in x-forwarded-host. */
export function requestOrigin(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return new URL(request.url).origin;
  const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto.split(',')[0]}://${host.split(',')[0]}`;
}
