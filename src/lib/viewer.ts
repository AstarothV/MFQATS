// View-only accounts for the survey (migration 022). The database refuses their changes; this file makes the website
// say so clearly, and shows them the demo person's data they mirror.

export const VIEW_ONLY_MESSAGE = 'This is a view-only account: changes are not saved.';

type AccountLike = { id: string; app_metadata?: Record<string, unknown> } | null | undefined;

export const isViewer = (user: AccountLike) => user?.app_metadata?.viewer === true;

/** Whose data "my" pages show: the demo person a viewer mirrors, otherwise the person themselves. */
export function dataUserId(user: { id: string; app_metadata?: Record<string, unknown> }): string {
  const as = user.app_metadata?.view_as;
  return isViewer(user) && typeof as === 'string' && as ? as : user.id;
}

// requests that only read, though they are not GETs: signed links to order photos, file lists, read-only functions
const READS = [/^\/storage\/v1\/object\/(sign|list)\//, /^\/rest\/v1\/rpc\/(order_eta|stage_timeline_stats|log_activity)$/, /^\/auth\/v1\/(token|logout)/];

function tokenIsViewer(authorization: string | null) {
  try {
    const payload = authorization?.split(' ')[1]?.split('.')[1];
    if (!payload) return false;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))?.app_metadata?.viewer === true;
  } catch {
    return false;
  }
}

/** Supabase's fetch: a viewer's changes are answered here with the view-only message, so every page shows it. */
export const viewerFetch: typeof fetch = (input, init) => {
  const request = input instanceof Request ? input : null;
  const method = (init?.method || request?.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return fetch(input, init);
  const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname;
  if (READS.some((r) => r.test(path))) return fetch(input, init);
  if (!tokenIsViewer(new Headers(init?.headers ?? request?.headers).get('Authorization'))) return fetch(input, init);
  const body = JSON.stringify({ message: VIEW_ONLY_MESSAGE, msg: VIEW_ONLY_MESSAGE, error: VIEW_ONLY_MESSAGE, code: 'view_only' });
  return Promise.resolve(new Response(body, { status: 403, headers: { 'content-type': 'application/json' } }));
};
