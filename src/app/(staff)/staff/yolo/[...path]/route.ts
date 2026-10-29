import type { NextRequest } from 'next/server';

// The Quality Scan tools call /staff/yolo/... and this forwards each request to the Python detection server.
// A next.config rewrite did this before, but Vercel's edge could not reach a Tailscale Funnel address
// (DNS_HOSTNAME_EMPTY); a normal server-side fetch can. It is under /staff, so the middleware only lets logged-in
// staff through. YOLO_SERVER_URL is read on every request: changing it on the hosting site needs no rebuild.
// ponytail: Vercel functions accept at most 4.5 MB per request, so the tools shrink photos before sending them.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // tiled detection on a large photo takes about 10 s

// Pasted by hand into the hosting site's settings: tolerate spaces/line breaks, a missing https:// and a trailing /.
function detectionServer() {
  const raw = (process.env.YOLO_SERVER_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return 'http://localhost:8000';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${detectionServer()}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const type = request.headers.get('content-type');
  let res: Response;
  try {
    res = await fetch(url, {
      method: request.method,
      headers: type ? { 'content-type': type } : undefined, // keeps the multipart boundary of file uploads
      body: request.method === 'GET' ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
    });
  } catch {
    // plain text, not JSON: the tools then say they cannot reach the detection server
    return new Response('Could not reach the detection server', { status: 502 });
  }
  const headers = new Headers();
  for (const name of ['content-type', 'content-disposition']) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.body, { status: res.status, headers });
}

export { forward as GET, forward as POST };
