// Checks src/lib/viewer.ts (view-only survey accounts) with fake sign-in tokens, no network: npm run check:viewer
const fs = require('fs');
const ts = require('typescript');
const src = fs.readFileSync(require('path').join(__dirname, '../src/lib/viewer.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const passed = [];
global.fetch = async () => { passed.push(1); return new Response('{}', { status: 200 }); };
const m = { exports: {} }; new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { viewerFetch, dataUserId, isViewer } = m.exports;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (meta) => `x.${b64({ sub: 'v1', app_metadata: meta })}.sig`;
const VIEWER = { Authorization: `Bearer ${jwt({ viewer: true, view_as: 'claire' })}` };
const NORMAL = { Authorization: `Bearer ${jwt({ provider: 'email' })}` };
const S = 'https://x.supabase.co';
const cases = [
  ['viewer reads orders', `${S}/rest/v1/orders?select=*`, 'GET', VIEWER, 'pass'],
  ['viewer counts (HEAD)', `${S}/rest/v1/orders`, 'HEAD', VIEWER, 'pass'],
  ['viewer adds an order', `${S}/rest/v1/orders`, 'POST', VIEWER, 'block'],
  ['viewer edits an order', `${S}/rest/v1/orders?id=eq.1`, 'PATCH', VIEWER, 'block'],
  ['viewer deletes an order', `${S}/rest/v1/orders?id=eq.1`, 'DELETE', VIEWER, 'block'],
  ['viewer uploads a photo', `${S}/storage/v1/object/order-media/a/b.jpg`, 'POST', VIEWER, 'block'],
  ['viewer opens photo links', `${S}/storage/v1/object/sign/order-media`, 'POST', VIEWER, 'pass'],
  ['viewer lists files', `${S}/storage/v1/object/list/order-media`, 'POST', VIEWER, 'pass'],
  ['viewer gets the finish date', `${S}/rest/v1/rpc/order_eta`, 'POST', VIEWER, 'pass'],
  ['viewer changes password/email', `${S}/auth/v1/user`, 'PUT', VIEWER, 'block'],
  ['viewer turns on two-step', `${S}/auth/v1/factors`, 'POST', VIEWER, 'block'],
  ['viewer creates an account', `${S}/auth/v1/signup`, 'POST', VIEWER, 'block'],
  ['viewer stays signed in', `${S}/auth/v1/token?grant_type=refresh_token`, 'POST', VIEWER, 'pass'],
  ['viewer signs out', `${S}/auth/v1/logout`, 'POST', VIEWER, 'pass'],
  ['normal account adds an order', `${S}/rest/v1/orders`, 'POST', NORMAL, 'pass'],
  ['signed-out sign in', `${S}/auth/v1/token?grant_type=password`, 'POST', { Authorization: 'Bearer anon' }, 'pass'],
  ['Request object from viewer', new Request(`${S}/rest/v1/orders`, { method: 'POST', headers: VIEWER }), undefined, undefined, 'block'],
];
(async () => {
  let bad = 0;
  for (const [name, input, method, headers, want] of cases) {
    passed.length = 0;
    const res = await viewerFetch(input, method ? { method, headers } : undefined);
    const got = passed.length ? 'pass' : 'block';
    const msg = got === 'block' ? ` (${res.status}: ${(await res.json()).message})` : '';
    if (got !== want) bad++;
    console.log(`${got === want ? 'ok ' : 'BAD'} ${name}: ${got}${msg}`);
  }
  const v = { id: 'v1', app_metadata: { viewer: true, view_as: 'claire' } };
  const n = { id: 'n1', app_metadata: { viewer: 'true', view_as: 'claire' } }; // only a real true counts
  const checks = [[isViewer(v), true], [dataUserId(v), 'claire'], [isViewer(n), false], [dataUserId(n), 'n1'], [dataUserId({ id: 'z' }), 'z']];
  checks.forEach(([got, want], i) => { if (got !== want) { bad++; console.log(`BAD helper ${i}: ${got}`); } });
  console.log(bad ? `${bad} FAILED` : `all ${cases.length + checks.length} checks passed`);
  process.exit(bad ? 1 : 0);
})();
