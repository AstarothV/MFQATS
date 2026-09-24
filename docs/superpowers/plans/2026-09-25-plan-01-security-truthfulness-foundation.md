# Plan 01: Security & Truthfulness Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the reproduced privilege-escalation holes, restore the features broken by missing tables, make route protection fail closed, and stop the app from presenting random numbers as YOLO results. All of this is covered by automated tests before any new subsystem is built on top.

**Architecture:** Every change is **additive**: two new Supabase migrations (idempotent, no `DROP TYPE … CASCADE`), one new pure TypeScript module that the existing middleware delegates to, and small copy and behaviour edits in the existing Next.js reference app. Database behaviour is tested in an in-process Postgres (PGlite) with a stubbed Supabase `auth` schema, and routing is tested with Node's built-in test runner. No new runtime dependencies.

**Tech Stack:** Supabase Postgres SQL (plpgsql, RLS) · Node 22 `node:test` · `@electric-sql/pglite` 0.3.16 (dev-only, isolated in `supabase/tests/`) · Next.js 15 / TypeScript 5.

**Spec:** `docs/mfqats-current-state.md` (findings S1–S7, D1, MOCKED YOLO) + the master build prompt §26 (Security) and §40 (Do not fake the AI) + `docs/superpowers/plans/2026-09-25-mfqats-roadmap.md`.

**Pre-verified:** every migration, test and TypeScript file in this plan was dry-run on a scratch copy on 2026-09-25. Results: DB tests went from 9 failing to **27/27 passing**, routing tests **8/8 passing**, `tsc --noEmit` clean. Nothing has been applied to your folder or to the live Supabase project yet.

## Global Constraints

- Repository root: `D:\Documents\School Works\CAPSTONE\CAPSTONE CODE\MVCA-main` (`~/mnt/MVCA-main` in the device shell).
- **No git** (team decision). Replace every "commit" step with a checkpoint entry in `docs/CHANGELOG.md`. The baseline snapshot from Task 0 is the only rollback.
- Don't delete or rewrite existing TypeScript screens. Edit only the lines named in each task.
- Never edit the two existing migrations (`20260519000001_*`, `20260521000002_*`). Add new migration files only.
- New migrations must be idempotent (`create … if not exists`, `create or replace`, `drop policy if exists` before `create policy`).
- Never use `auth.users.raw_user_meta_data` for authorization. Only `public.user_profiles.role` (writes restricted to admins) and `raw_app_meta_data` (service role only) count.
- Never commit secrets. `.env` stays git-ignored. `.env.example` contains placeholders only.
- Mocked ML output has to be identifiable **in the data** (`scan_mode` starts with `dev_mock_`) and **in the UI** (visible banner).
- Node ≥ 22.6 (for `--experimental-strip-types`).

## Review Focus

1. **Live accounts already escalated before this fix.** The backfill trusts `user_profiles.role` as it stands today. If someone has already self-promoted, they stay admin. Task 7 adds a mandatory human review query that lists every admin and staff account after the migration is applied.
2. **Admin "Add user" screen** (`src/app/admin/users/page.tsx`). New accounts now start as `customer`, and the admin's follow-up `upsert` sets the real role. That works only while the admin's own session stays active, which is true when email confirmation is **on**. If your Supabase project has confirmation **off**, `signUp` switches the browser session to the new user and the upsert is (correctly) refused. Task 7 includes a manual check. The permanent fix is the server-side admin endpoint in Plan 03.
3. **A deactivated user with a still-valid session.** The middleware must treat `is_active = false` as "no role" and send them to login. This is covered by `decideRoute(…, null)` plus the `is_active` check in Task 4, and verified manually in Task 7.
4. **Customer checkout** (`CustomerShopContent.tsx` inserts into `orders`) must keep working under the new read-only policy. Covered by the test "customer can place a new pending order".
5. **The customer sets `amount` at checkout** (client-computed price). This plan doesn't change it. It's logged as a known issue for Plan 04 (server-side pricing), so nobody believes it's fixed.

---

### Task 0: Baseline snapshot, environment template, changelog, tsconfig excludes

**Files:**
- Create: `_snapshots/2026-09-25-baseline.tar.gz`
- Create: `.env.example`
- Create: `docs/CHANGELOG.md`
- Modify: `tsconfig.json` (the `exclude` array only)
- Modify: `.gitignore` (append 2 lines)

**Interfaces:** Produces `docs/CHANGELOG.md`, which every later task appends to.

- [ ] **Step 1: Snapshot the untouched project (the only rollback, since there's no git)**

Run in the device shell:
```bash
cd "$HOME/mnt/MVCA-main" && mkdir -p _snapshots && \
tar --exclude=./node_modules --exclude=./.next --exclude=./_snapshots --exclude=./.env \
    -czf _snapshots/2026-09-25-baseline.tar.gz . && tar -tzf _snapshots/2026-09-25-baseline.tar.gz | wc -l
```
Expected: a number ≥ 130. `.env` is deliberately excluded (secrets), so keep your own copy of it.

- [ ] **Step 2: Create `.env.example`**

```dotenv
# Copy to .env and fill in. Never commit .env.
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_SITE_URL=http://localhost:4028
# Server-only. Used from Plan 03 (Laravel). Never prefix with NEXT_PUBLIC_.
# SUPABASE_SERVICE_ROLE_KEY=
```
Note: the existing `.env` also has OPENAI/GEMINI/ANTHROPIC/PERPLEXITY/Stripe/GA/AdSense keys that **no code uses**. Record in the changelog that they're unused and should be revoked or removed by the key owner. Don't delete them yourself.

- [ ] **Step 3: tsconfig excludes** so test files and nested `node_modules` aren't type-checked by Next

Set `"exclude"` in `tsconfig.json` to:
```json
"exclude": ["node_modules", "**/node_modules", "src/**/__tests__/**", "supabase/tests", "_snapshots", "_to_delete"]
```

- [ ] **Step 4: `.gitignore`**, append:
```
_snapshots/
supabase/tests/node_modules/
```

- [ ] **Step 5: Create `docs/CHANGELOG.md`**

```markdown
# MFQATS Changelog
Format: date · plan/task · what changed · how verified

## 2026-09-25 · Plan 01 / Task 0
- Baseline snapshot `_snapshots/2026-09-25-baseline.tar.gz` (excludes .env, node_modules).
- Added `.env.example`; tsconfig excludes for tests/snapshots.
- NOTE: `.env` contains unused third-party AI/Stripe/analytics keys; owner should revoke/remove.
```

- [ ] **Step 6: Verify the TypeScript baseline is still clean**

Run: `npm install && npx tsc --noEmit`
Expected: exit 0, no output.

---

### Task 1: Database test harness (PGlite)

**Files:**
- Create: `supabase/tests/package.json`
- Create: `supabase/tests/fixtures/auth_stub.sql`
- Create: `supabase/tests/helpers/db.mjs`
- Create: `supabase/tests/baseline.test.mjs`

**Interfaces:**
- Produces (`helpers/db.mjs`): `freshDb(): Promise<PGlite>` (all migrations applied), `userId(db, email): Promise<uuid>`, `asUser(db, uid, sql, params?): Promise<rows>` (runs as role `authenticated` with `auth.uid() = uid`), `selfEditUserMetadata(db, uid, patch)`, `signUp(db, email, userMeta?, appMeta?): Promise<uuid>`, `SEED = { admin, staff, customer }` (seed emails).

- [ ] **Step 1: `supabase/tests/package.json`**

```json
{
  "name": "mfqats-db-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test --test-concurrency=1 --test-reporter=spec \"*.test.mjs\""
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.3.16"
  }
}
```

- [ ] **Step 2: `supabase/tests/fixtures/auth_stub.sql`**

```sql
-- Minimal stand-in for the parts of Supabase that our migrations depend on.
-- Used ONLY by the local PGlite test harness; never applied to a real project.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  is_sso_user bool, is_anonymous bool, confirmation_token text, confirmation_sent_at timestamptz,
  recovery_token text, recovery_sent_at timestamptz, email_change_token_new text, email_change text,
  email_change_sent_at timestamptz, email_change_token_current text, email_change_confirm_status int,
  reauthentication_token text, reauthentication_sent_at timestamptz, phone text, phone_change text,
  phone_change_token text, phone_change_sent_at timestamptz
);

-- Supabase's auth.uid() reads the JWT "sub" claim; the harness sets it per request.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;

create extension if not exists pgcrypto;
```

- [ ] **Step 3: `supabase/tests/helpers/db.mjs`**

```js
// Test harness: boots an in-process Postgres (PGlite), stubs Supabase's auth
// schema, applies every migration in supabase/migrations in filename order, and
// lets a test run SQL *as* a given user so Row Level Security is exercised.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../migrations');
const AUTH_STUB = path.resolve(here, '../fixtures/auth_stub.sql');

export async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(fs.readFileSync(AUTH_STUB, 'utf8'));
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  // Supabase grants table privileges to `authenticated`; RLS then filters rows.
  await db.exec(`
    grant usage on schema public, auth to authenticated, anon;
    grant all on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    grant execute on all functions in schema public, auth to authenticated, anon;
  `);
  return db;
}

export async function userId(db, email) {
  const { rows } = await db.query('select id from auth.users where email = $1', [email]);
  if (!rows[0]) throw new Error(`seed user not found: ${email}`);
  return rows[0].id;
}

/** Run `sql` as the `authenticated` role with auth.uid() = uid. Always resets role. */
export async function asUser(db, uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

/** Simulates supabase.auth.updateUser({ data }) — any user can do this to themselves. */
export async function selfEditUserMetadata(db, uid, patch) {
  await db.query(
    `update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) || $2::jsonb where id = $1`,
    [uid, JSON.stringify(patch)],
  );
}

/** Simulates GoTrue sign-up: inserts into auth.users with client-supplied metadata. */
export async function signUp(db, email, userMeta = {}, appMeta = {}) {
  const { rows } = await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
     values (gen_random_uuid(), $1, $2::jsonb, $3::jsonb) returning id`,
    [email, JSON.stringify(userMeta), JSON.stringify(appMeta)],
  );
  return rows[0].id;
}

export const SEED = {
  admin: 'sunita.kapoor@mvcawood.com',
  staff: 'marcos.reyes@mvcawood.com',
  customer: 'claire.leblanc@gmail.com',
};
```

- [ ] **Step 4: Baseline test** proving the harness loads the existing schema and seed: `supabase/tests/baseline.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers/db.mjs';

test('existing migrations apply and seed the demo accounts and orders', async () => {
  const db = await freshDb();
  const users = await db.query('select count(*)::int n from public.user_profiles');
  const orders = await db.query('select count(*)::int n from public.orders');
  assert.equal(users.rows[0].n, 4);
  assert.equal(orders.rows[0].n, 3);
});
```

- [ ] **Step 5: Run**

Run: `cd supabase/tests && npm install && npm test`
Expected: `ℹ pass 1`, `ℹ fail 0`.

- [ ] **Step 6: Checkpoint.** Append a Task 1 entry to `docs/CHANGELOG.md` with the test command and result.

---

### Task 2: Security hardening migration (S1, S2, S3, S4, S5)

**Files:**
- Create: `supabase/tests/security.rls.test.mjs`
- Create: `supabase/migrations/20260925000003_mfqats_security_hardening.sql`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces (SQL): `public.current_app_role() → text|null`, and redefined `public.get_user_role()`, `is_admin()`, `is_staff_or_admin()`, `is_customer()`, all reading `user_profiles.role` where `is_active`. Trigger `guard_user_profile_privileged_columns` raises SQLSTATE `42501` with the message `not allowed to change role or account status`. Order policies `orders_staff_all`, `orders_customer_select`, `orders_customer_insert`. Trigger `sync_role_to_app_metadata` mirrors the role into `raw_app_meta_data.role` (Plan 03 reads this JWT claim).

- [ ] **Step 1: Write the failing tests**: `supabase/tests/security.rls.test.mjs`

```js
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, userId, asUser, selfEditUserMetadata, signUp, SEED } from './helpers/db.mjs';

describe('RBAC source of truth (S1, S2, S3, S5)', () => {
  let db, admin, staff, customer;
  before(async () => {
    db = await freshDb();
    admin = await userId(db, SEED.admin);
    staff = await userId(db, SEED.staff);
    customer = await userId(db, SEED.customer);
  });

  test('seed roles resolve correctly', async () => {
    assert.equal((await asUser(db, admin, 'select public.is_admin() v'))[0].v, true);
    assert.equal((await asUser(db, staff, 'select public.is_staff_or_admin() v'))[0].v, true);
    assert.equal((await asUser(db, customer, 'select public.is_customer() v'))[0].v, true);
  });

  test('S1: editing own user_metadata.role does NOT grant admin', async () => {
    await selfEditUserMetadata(db, customer, { role: 'admin' });
    assert.equal((await asUser(db, customer, 'select public.is_admin() v'))[0].v, false);
    const rows = await asUser(db, customer, 'select count(*)::int n from public.audit_logs');
    assert.equal(rows[0].n, 0);
  });

  test('S2: sign-up with role=admin in user metadata creates a customer', async () => {
    const id = await signUp(db, 'attacker@example.com', { role: 'admin', full_name: 'X' });
    const { rows } = await db.query('select role::text from public.user_profiles where id = $1', [id]);
    assert.equal(rows[0].role, 'customer');
  });

  test('S2: role in app_metadata (server-only) is honoured at sign-up', async () => {
    const id = await signUp(db, 'new.staff@mvcawood.com', { full_name: 'New Staff' }, { role: 'staff' });
    const { rows } = await db.query('select role::text from public.user_profiles where id = $1', [id]);
    assert.equal(rows[0].role, 'staff');
  });

  test('S3: a user cannot change their own profile role', async () => {
    await assert.rejects(
      asUser(db, customer, `update public.user_profiles set role = 'admin' where id = auth.uid()`),
      /not allowed to change role/i,
    );
  });

  test('S3: a user cannot re-activate / deactivate themselves', async () => {
    await assert.rejects(
      asUser(db, staff, `update public.user_profiles set is_active = false where id = auth.uid()`),
      /not allowed to change role/i,
    );
  });

  test('a user CAN still edit their own name/phone', async () => {
    const rows = await asUser(db, customer,
      `update public.user_profiles set full_name = 'Claire L.', phone = '0917' where id = auth.uid() returning full_name`);
    assert.equal(rows[0].full_name, 'Claire L.');
  });

  test('S5: admin changing a profile role takes effect in RLS immediately', async () => {
    const id = await signUp(db, 'promote.me@mvcawood.com', {}, {});
    await asUser(db, admin, `update public.user_profiles set role = 'staff' where id = $1`, [id]);
    assert.equal((await asUser(db, id, 'select public.is_staff_or_admin() v'))[0].v, true);
  });

  test('deactivated users lose all role checks', async () => {
    const id = await signUp(db, 'leaver@mvcawood.com', {}, { role: 'staff' });
    await asUser(db, admin, `update public.user_profiles set is_active = false where id = $1`, [id]);
    assert.equal((await asUser(db, id, 'select public.is_staff_or_admin() v'))[0].v, false);
  });
});

describe('Customer isolation on orders (S4)', () => {
  let db, customer, other, staff;
  before(async () => {
    db = await freshDb();
    customer = await userId(db, SEED.customer);
    staff = await userId(db, SEED.staff);
    other = await signUp(db, 'other.customer@example.com');
  });

  test('customer can read own orders only', async () => {
    const mine = await asUser(db, customer, 'select count(*)::int n from public.orders');
    const theirs = await asUser(db, other, 'select count(*)::int n from public.orders');
    assert.ok(mine[0].n > 0);
    assert.equal(theirs[0].n, 0);
  });

  test('customer cannot update an order (status, amount, progress)', async () => {
    const rows = await asUser(db, customer,
      `update public.orders set status = 'delivered', amount = 1 where customer_id = auth.uid() returning id`);
    assert.equal(rows.length, 0, 'RLS must filter the update to zero rows');
  });

  test('customer cannot delete an order', async () => {
    const rows = await asUser(db, customer, 'delete from public.orders where customer_id = auth.uid() returning id');
    assert.equal(rows.length, 0);
  });

  test('customer can place a new pending order for themselves (shop checkout)', async () => {
    const rows = await asUser(db, customer,
      `insert into public.orders (order_ref, customer_id, product_name, amount, status, completion_pct)
       values ('ORD-T1', auth.uid(), 'Test', 100, 'pending', 0) returning id`);
    assert.equal(rows.length, 1);
  });

  test('customer cannot insert an order already marked delivered', async () => {
    await assert.rejects(asUser(db, customer,
      `insert into public.orders (order_ref, customer_id, product_name, amount, status, completion_pct)
       values ('ORD-T2', auth.uid(), 'Test', 100, 'delivered', 100)`), /row-level security/i);
  });

  test('customer cannot insert an order for someone else', async () => {
    await assert.rejects(asUser(db, customer,
      `insert into public.orders (order_ref, customer_id, product_name, amount, status)
       values ('ORD-T3', $1, 'Test', 100, 'pending')`, [other]), /row-level security/i);
  });

  test('staff can update order status', async () => {
    const rows = await asUser(db, staff,
      `update public.orders set status = 'approved' where order_ref = 'ORD-T1' returning id`);
    assert.equal(rows.length, 1);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd supabase/tests && npm test`
Expected: **9 failing** in this file, including `S1 … true !== false` and `S2 … 'admin' !== 'customer'`. That proves the vulnerabilities exist.

- [ ] **Step 3: Write the migration**: `supabase/migrations/20260925000003_mfqats_security_hardening.sql`

```sql
-- MFQATS security hardening (fixes S1–S5 in docs/mfqats-current-state.md)
--
-- Decision (see docs/decision-log.md, ADR-003): the single source of truth for a
-- user's role is public.user_profiles.role, which only an admin (or the service
-- role, e.g. the Laravel backend) may change. auth.users.raw_user_meta_data is
-- user-editable in Supabase and is NEVER used for authorization.
-- Role at sign-up comes from raw_app_meta_data (settable only with the service
-- role key); anyone else signing up becomes a customer.
--
-- Idempotent: safe to run more than once. No DROP TYPE ... CASCADE.

-- ------------------------------------------------------------------
-- 1. Role helpers read the server-owned profile row, and require is_active.
--    SECURITY DEFINER + fixed search_path: bypasses RLS on user_profiles
--    (so no policy recursion) and cannot be hijacked via search_path.
-- ------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select up.role::text
  from public.user_profiles up
  where up.id = auth.uid() and up.is_active
$$;

create or replace function public.get_user_role()
returns text
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role(), 'none') $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() = 'admin', false) $$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() in ('admin', 'staff'), false) $$;

create or replace function public.is_customer()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() = 'customer', false) $$;

-- ------------------------------------------------------------------
-- 2. Sign-up: never trust client-supplied metadata for the role.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  requested text := new.raw_app_meta_data ->> 'role';   -- server-only field
  granted public.user_role := 'customer';
begin
  if requested in ('admin', 'staff', 'customer') then
    granted := requested::public.user_role;
  end if;

  insert into public.user_profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    granted,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- 3. Privileged profile columns (role, is_active, email, id) can only be
--    changed by an admin, or by a trusted server context (no auth.uid(),
--    i.e. service role / migrations).
-- ------------------------------------------------------------------
create or replace function public.guard_user_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'customer' then
      raise exception 'not allowed to change role or account status' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'not allowed to change role or account status' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_profile_privileged_columns on public.user_profiles;
create trigger guard_user_profile_privileged_columns
  before insert or update on public.user_profiles
  for each row execute function public.guard_user_profile_privileged_columns();

-- ------------------------------------------------------------------
-- 4. Keep auth.users.raw_app_meta_data.role in sync with the profile so a
--    JWT's app_metadata claim (used later by the Laravel API) never drifts.
-- ------------------------------------------------------------------
create or replace function public.sync_role_to_app_metadata()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', new.role::text)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_role_to_app_metadata on public.user_profiles;
create trigger sync_role_to_app_metadata
  after insert or update of role on public.user_profiles
  for each row execute function public.sync_role_to_app_metadata();

-- One-time backfill for existing accounts.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role::text)
  from public.user_profiles p
 where p.id = u.id;

-- ------------------------------------------------------------------
-- 5. Orders: customers are read-only on existing orders; they may only
--    create a brand-new pending order for themselves (shop checkout).
-- ------------------------------------------------------------------
drop policy if exists "orders_access" on public.orders;
drop policy if exists "orders_staff_all" on public.orders;
drop policy if exists "orders_customer_select" on public.orders;
drop policy if exists "orders_customer_insert" on public.orders;

create policy "orders_staff_all" on public.orders
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy "orders_customer_select" on public.orders
  for select to authenticated
  using (customer_id = auth.uid());

create policy "orders_customer_insert" on public.orders
  for insert to authenticated
  with check (
    public.is_customer()
    and customer_id = auth.uid()
    and status = 'pending'
    and coalesce(completion_pct, 0) = 0
  );
```

- [ ] **Step 4: Run and confirm GREEN**

Run: `cd supabase/tests && npm test`
Expected: all tests in `security.rls.test.mjs` pass (16) plus the baseline (1). `ℹ fail 0`.

- [ ] **Step 5: Checkpoint.** CHANGELOG entry: "S1–S5 fixed in migration 000003; 16 RLS tests". Also add **ADR-003 "Role source of truth"** to `docs/decision-log.md` (create the file): Decision = `user_profiles.role` (admin-only writes) + `raw_app_meta_data` at sign-up; Alternatives = user_metadata (rejected, user-writable), a custom JWT claim hook (deferred, needs a Supabase Auth hook config); Trade-off = the admin must set staff roles after sign-up until the Plan 03 admin endpoint exists; Status = IMPLEMENTED, TESTED (local), NOT YET APPLIED to Supabase.

---

### Task 3: Missing tables: inquiries, inquiry_messages, order_history_logs (D1)

**Files:**
- Create: `supabase/tests/inquiries_history.test.mjs`
- Create: `supabase/migrations/20260925000004_mfqats_missing_inquiry_history_tables.sql`

**Interfaces:**
- Consumes: Task 2 helpers `is_staff_or_admin()`, plus `public.set_updated_at()` from the core migration.
- Produces: tables whose columns match what `src/components/ui/InquirySystem.tsx` and `src/app/customer-dashboard/components/OrderViewContent.tsx` already query. The `inquiry_ref` is auto-assigned as `INQ-<n>` when the insert sends `''`. Every orders insert or status change writes to `order_history_logs` via trigger.

- [ ] **Step 1: Write the failing tests**: `supabase/tests/inquiries_history.test.mjs`

```js
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, userId, asUser, signUp, SEED } from './helpers/db.mjs';

describe('inquiries + inquiry_messages (D1)', () => {
  let db, customer, other, staff, inquiryId;
  before(async () => {
    db = await freshDb();
    customer = await userId(db, SEED.customer);
    staff = await userId(db, SEED.staff);
    other = await signUp(db, 'nosy@example.com');
  });

  test('customer creates an inquiry exactly the way InquirySystem.tsx does; ref is assigned', async () => {
    const rows = await asUser(db, customer,
      `insert into public.inquiries (customer_id, order_id, subject, status, priority, inquiry_ref)
       values (auth.uid(), null, 'Delivery date?', 'open', 'normal', '') returning id, inquiry_ref`);
    inquiryId = rows[0].id;
    assert.match(rows[0].inquiry_ref, /^INQ-\d+$/);
  });

  test('customer posts a public message; staff replies; staff adds an internal note', async () => {
    await asUser(db, customer,
      `insert into public.inquiry_messages (inquiry_id, sender_id, content, is_internal) values ($1, auth.uid(), 'Hi', false)`, [inquiryId]);
    await asUser(db, staff,
      `insert into public.inquiry_messages (inquiry_id, sender_id, content, is_internal) values ($1, auth.uid(), 'Next week', false)`, [inquiryId]);
    await asUser(db, staff,
      `insert into public.inquiry_messages (inquiry_id, sender_id, content, is_internal) values ($1, auth.uid(), 'Internal: sanding delay', true)`, [inquiryId]);
  });

  test('customer sees public messages only, never internal notes', async () => {
    const rows = await asUser(db, customer, 'select content from public.inquiry_messages where inquiry_id = $1', [inquiryId]);
    assert.deepEqual(rows.map((r) => r.content).sort(), ['Hi', 'Next week']);
  });

  test('another customer cannot see the inquiry or its messages', async () => {
    assert.equal((await asUser(db, other, 'select count(*)::int n from public.inquiries'))[0].n, 0);
    assert.equal((await asUser(db, other, 'select count(*)::int n from public.inquiry_messages'))[0].n, 0);
  });

  test('another customer cannot post into someone else\'s inquiry', async () => {
    await assert.rejects(asUser(db, other,
      `insert into public.inquiry_messages (inquiry_id, sender_id, content) values ($1, auth.uid(), 'spam')`, [inquiryId]),
    /row-level security/i);
  });

  test('customer cannot mark their inquiry resolved (staff-only)', async () => {
    const rows = await asUser(db, customer, `update public.inquiries set status = 'resolved' where id = $1 returning id`, [inquiryId]);
    assert.equal(rows.length, 0);
  });

  test('customer cannot attach an inquiry to an order they do not own', async () => {
    const { rows: [o] } = await db.query(`insert into public.orders (order_ref, customer_id, product_name) values ('ORD-X', $1, 'X') returning id`, [other]);
    await assert.rejects(asUser(db, customer,
      `insert into public.inquiries (customer_id, order_id, subject, inquiry_ref) values (auth.uid(), $1, 'peek', '')`, [o.id]),
    /row-level security/i);
  });
});

describe('order_history_logs (D1)', () => {
  let db, customer, staff, orderId;
  before(async () => {
    db = await freshDb();
    customer = await userId(db, SEED.customer);
    staff = await userId(db, SEED.staff);
  });

  test('placing an order writes a "created" history row', async () => {
    const rows = await asUser(db, customer,
      `insert into public.orders (order_ref, customer_id, product_name, amount, status) values ('ORD-H1', auth.uid(), 'Chair', 10, 'pending') returning id`);
    orderId = rows[0].id;
    const h = await asUser(db, customer, 'select event_type, new_status from public.order_history_logs where order_id = $1', [orderId]);
    assert.deepEqual(h, [{ event_type: 'created', new_status: 'pending' }]);
  });

  test('staff status change is logged with old/new status and who did it', async () => {
    await asUser(db, staff, `update public.orders set extended_status = 'confirmed' where id = $1`, [orderId]);
    const h = await asUser(db, customer,
      `select old_status, new_status, changed_by from public.order_history_logs where order_id = $1 and event_type = 'status_change'`, [orderId]);
    assert.equal(h.length, 1);
    assert.equal(h[0].old_status, 'pending');
    assert.equal(h[0].new_status, 'confirmed');
    assert.equal(h[0].changed_by, staff);
  });

  test('customer cannot write history rows directly', async () => {
    await assert.rejects(asUser(db, customer,
      `insert into public.order_history_logs (order_id, title) values ($1, 'fake')`, [orderId]), /row-level security/i);
  });
});

describe('migrations are safe to re-run', () => {
  test('applying the new migrations twice does not error or duplicate policies', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
    const db = await freshDb();
    for (const f of fs.readdirSync(dir).filter((f) => f >= '20260925').sort()) {
      await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
    const { rows } = await db.query(`select count(*)::int n from pg_policies where tablename = 'orders'`);
    assert.equal(rows[0].n, 3);
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd supabase/tests && npm test`
Expected: failures such as `relation "public.inquiries" does not exist`.

- [ ] **Step 3: Write the migration**: `supabase/migrations/20260925000004_mfqats_missing_inquiry_history_tables.sql`

```sql
-- MFQATS: tables the existing UI already queries but no migration created
-- (docs/mfqats-current-state.md, finding D1).
-- Column sets are taken from src/components/ui/InquirySystem.tsx and
-- src/app/customer-dashboard/components/OrderViewContent.tsx.
-- Idempotent.

-- ------------------------------------------------------------------
-- inquiries
-- ------------------------------------------------------------------
create sequence if not exists public.inquiry_ref_seq start 1001;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_ref text not null unique,
  customer_id uuid not null references public.user_profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (length(trim(subject)) > 0),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  resolved_at timestamptz,
  resolved_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inquiries_customer_id on public.inquiries(customer_id);
create index if not exists idx_inquiries_status on public.inquiries(status);
create index if not exists idx_inquiries_updated_at on public.inquiries(updated_at desc);

-- The UI inserts inquiry_ref = '' and expects the database to assign one.
create or replace function public.assign_inquiry_ref()
returns trigger language plpgsql as $$
begin
  if new.inquiry_ref is null or new.inquiry_ref = '' then
    new.inquiry_ref := 'INQ-' || nextval('public.inquiry_ref_seq')::text;
  end if;
  return new;
end;
$$;
drop trigger if exists assign_inquiry_ref on public.inquiries;
create trigger assign_inquiry_ref before insert on public.inquiries
  for each row execute function public.assign_inquiry_ref();

drop trigger if exists set_inquiries_updated_at on public.inquiries;
create trigger set_inquiries_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();

alter table public.inquiries enable row level security;

drop policy if exists "inquiries_staff_all" on public.inquiries;
create policy "inquiries_staff_all" on public.inquiries
  for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "inquiries_customer_select" on public.inquiries;
create policy "inquiries_customer_select" on public.inquiries
  for select to authenticated using (customer_id = auth.uid());

drop policy if exists "inquiries_customer_insert" on public.inquiries;
create policy "inquiries_customer_insert" on public.inquiries
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'open'
    and (order_id is null or exists (
      select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()))
  );

-- ------------------------------------------------------------------
-- inquiry_messages
-- ------------------------------------------------------------------
create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_inquiry_messages_inquiry_id on public.inquiry_messages(inquiry_id, created_at);

alter table public.inquiry_messages enable row level security;

drop policy if exists "inquiry_messages_staff_all" on public.inquiry_messages;
create policy "inquiry_messages_staff_all" on public.inquiry_messages
  for all to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin() and sender_id = auth.uid());

drop policy if exists "inquiry_messages_customer_select" on public.inquiry_messages;
create policy "inquiry_messages_customer_select" on public.inquiry_messages
  for select to authenticated
  using (
    not is_internal
    and exists (select 1 from public.inquiries i where i.id = inquiry_id and i.customer_id = auth.uid())
  );

drop policy if exists "inquiry_messages_customer_insert" on public.inquiry_messages;
create policy "inquiry_messages_customer_insert" on public.inquiry_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not is_internal
    and exists (select 1 from public.inquiries i where i.id = inquiry_id and i.customer_id = auth.uid())
  );

-- ------------------------------------------------------------------
-- order_history_logs (customer-visible order timeline)
-- ------------------------------------------------------------------
create table if not exists public.order_history_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null default 'status_change',
  title text not null default '',
  description text not null default '',
  old_status text,
  new_status text,
  queue_position integer,
  changed_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_history_logs_order_id on public.order_history_logs(order_id, created_at desc);

alter table public.order_history_logs enable row level security;

drop policy if exists "order_history_staff_all" on public.order_history_logs;
create policy "order_history_staff_all" on public.order_history_logs
  for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "order_history_customer_select" on public.order_history_logs;
create policy "order_history_customer_select" on public.order_history_logs
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Every change of orders.status / orders.extended_status writes a history row,
-- so the timeline cannot be skipped by a client forgetting to log it.
create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_s text := coalesce(old.extended_status::text, old.status::text);
  new_s text := coalesce(new.extended_status::text, new.status::text);
begin
  if tg_op = 'INSERT' then
    insert into public.order_history_logs (order_id, event_type, title, new_status, changed_by)
    values (new.id, 'created', 'Order placed', new_s, auth.uid());
  elsif new.status is distinct from old.status or new.extended_status is distinct from old.extended_status then
    insert into public.order_history_logs (order_id, event_type, title, old_status, new_status, changed_by)
    values (new.id, 'status_change', 'Status updated', old_s, new_s, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_order_status_change on public.orders;
create trigger log_order_status_change
  after insert or update of status, extended_status on public.orders
  for each row execute function public.log_order_status_change();
```

- [ ] **Step 4: Run and confirm GREEN**

Run: `cd supabase/tests && npm test`
Expected: `ℹ tests 28`, `ℹ pass 28`, `ℹ fail 0` (27 plus the baseline test).

- [ ] **Step 5: Checkpoint.** CHANGELOG entry: "D1 fixed: inquiries/inquiry_messages/order_history_logs + auto history trigger; re-run safety test".

---

### Task 4: Fail-closed route protection (S7)

**Files:**
- Create: `src/lib/routeAccess.ts`
- Create: `src/lib/__tests__/routeAccess.test.ts`
- Modify: `src/middleware.ts` (full replacement shown below; behaviour-preserving for valid sessions)
- Modify: `package.json`, adding one script: `"test:unit": "node --test --experimental-strip-types \"src/**/__tests__/*.test.ts\""`

**Interfaces:**
- Produces: `decideRoute(pathname: string, role: AppRole | null): { action: 'allow' } | { action: 'redirect'; to: string }`, `isPublicPath(pathname)`, `isAppRole(value)`, `ROLE_HOME`, `LOGIN_PATH`, `type AppRole = 'admin'|'staff'|'customer'`. The Flutter router guard (Plan 07) will mirror this table.

- [ ] **Step 1: Write the failing test**: `src/lib/__tests__/routeAccess.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRoute, isAppRole } from '../routeAccess.ts';

test('no user on a protected route is sent to login (fail closed)', () => {
  assert.deepEqual(decideRoute('/admin/users', null), { action: 'redirect', to: '/sign-up-login-screen' });
});

test('public paths are allowed without a user', () => {
  for (const p of ['/', '/landing', '/sign-up-login-screen', '/auth/callback', '/api/auth/redirect']) {
    assert.deepEqual(decideRoute(p, null), { action: 'allow' }, p);
  }
});

test('worker typing an admin URL is redirected to the staff home', () => {
  assert.deepEqual(decideRoute('/admin/audit-logs', 'staff'), { action: 'redirect', to: '/staff-dashboard' });
});

test('customer typing an admin or staff URL is redirected to the customer home', () => {
  assert.deepEqual(decideRoute('/admin-dashboard', 'customer'), { action: 'redirect', to: '/customer-dashboard' });
  assert.deepEqual(decideRoute('/staff/quality-scan', 'customer'), { action: 'redirect', to: '/customer-dashboard' });
});

test('admin cannot use customer-only shop routes', () => {
  assert.deepEqual(decideRoute('/customer-dashboard/shop', 'admin'), { action: 'redirect', to: '/admin-dashboard' });
});

test('prefixes match whole segments only', () => {
  assert.deepEqual(decideRoute('/administrator', 'admin'), { action: 'redirect', to: '/admin-dashboard' });
  assert.deepEqual(decideRoute('/staffroom', 'staff'), { action: 'redirect', to: '/staff-dashboard' });
  assert.deepEqual(decideRoute('/landingX', null), { action: 'redirect', to: '/sign-up-login-screen' });
});

test('each role reaches its own home', () => {
  assert.deepEqual(decideRoute('/admin-dashboard', 'admin'), { action: 'allow' });
  assert.deepEqual(decideRoute('/staff-dashboard/assigned-tasks', 'staff'), { action: 'allow' });
  assert.deepEqual(decideRoute('/customer-dashboard/order-view', 'customer'), { action: 'allow' });
});

test('isAppRole rejects anything that is not a known role', () => {
  assert.equal(isAppRole('admin'), true);
  assert.equal(isAppRole('superadmin'), false);
  assert.equal(isAppRole(undefined), false);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm run test:unit`
Expected: FAIL, `Cannot find module …/routeAccess.ts`.

- [ ] **Step 3: Implement `src/lib/routeAccess.ts`**

```ts
// Pure routing policy used by src/middleware.ts. No Next.js imports so it can be
// unit-tested with `node --test`. Fail-closed: unknown role or no user => login.
export type AppRole = 'admin' | 'staff' | 'customer';

export const ROLE_HOME: Record<AppRole, string> = {
  admin: '/admin-dashboard',
  staff: '/staff-dashboard',
  customer: '/customer-dashboard',
};

const ROLE_ROUTES: Record<AppRole, string[]> = {
  admin: ['/admin-dashboard', '/real-time-production-dashboard', '/catalog', '/orders', '/admin'],
  staff: ['/staff-dashboard', '/staff'],
  customer: ['/customer-dashboard', '/support'],
};

const CUSTOMER_ONLY_ROUTES = ['/customer-dashboard/shop', '/customer-dashboard/order-status'];

export const PUBLIC_PATHS = ['/sign-up-login-screen', '/auth', '/_next', '/favicon.ico', '/assets', '/api/auth', '/landing'];

export const LOGIN_PATH = '/sign-up-login-screen';

/** Prefix match on whole path segments: '/admin' matches '/admin/users' but not '/administrator'. */
function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function isPublicPath(pathname: string): boolean {
  return pathname === '/' || PUBLIC_PATHS.some((p) => underPrefix(pathname, p));
}

export function isAppRole(value: unknown): value is AppRole {
  return value === 'admin' || value === 'staff' || value === 'customer';
}

export type RouteDecision = { action: 'allow' } | { action: 'redirect'; to: string };

/**
 * @param role  the role from user_profiles, or null when there is no authenticated,
 *              active user or the lookup failed.
 */
export function decideRoute(pathname: string, role: AppRole | null): RouteDecision {
  if (isPublicPath(pathname)) return { action: 'allow' };
  if (role === null) return { action: 'redirect', to: LOGIN_PATH };

  if (CUSTOMER_ONLY_ROUTES.some((r) => underPrefix(pathname, r)) && role !== 'customer') {
    return { action: 'redirect', to: ROLE_HOME[role] };
  }
  if (ROLE_ROUTES[role].some((p) => underPrefix(pathname, p))) return { action: 'allow' };
  return { action: 'redirect', to: ROLE_HOME[role] };
}
```

- [ ] **Step 4: Run and confirm GREEN**

Run: `npm run test:unit`
Expected: `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 5: Replace `src/middleware.ts`** so it delegates to `decideRoute`, treats any auth or profile error **and** `is_active = false` as no role, and never passes a request through on error:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { decideRoute, isAppRole, isPublicPath, type AppRole } from '@/lib/routeAccess';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  const supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) return supabaseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Fail closed: any auth or profile-lookup failure means "no role".
  let role: AppRole | null = null;
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle();
      if (!profileError && profile?.is_active && isAppRole(profile.role)) {
        role = profile.role;
      }
    }
  } catch {
    role = null;
  }

  const decision = decideRoute(pathname, role);
  return decision.action === 'allow' ? supabaseResponse : redirectTo(request, decision.to);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

What changed compared with the old middleware: (a) the old "cookie named `*auth*` exists → let through" branch is removed; (b) the old `catch → return supabaseResponse` is now `role = null` → login; (c) the old default role `'staff'` on profile-lookup failure is now `null` → login; (d) prefix matching is by whole path segment.

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Checkpoint.** CHANGELOG entry: "S7 fixed: middleware fail-closed via routeAccess.decideRoute; 8 unit tests".

---

### Task 5: Truthful labelling of the mock detector (master prompt §40)

**Files:**
- Modify: `src/app/staff/quality-scan/page.tsx` (function at line 47, call sites at lines 143 and 171, `saveDetection` at lines 201–250, header at lines 294–299)
- Modify: `src/app/sign-up-login-screen/components/LoginPageClient.tsx:29`
- Modify: `src/app/staff-dashboard/components/QuickActionTiles.tsx:29`
- Modify: `src/app/staff-dashboard/components/RecentQAFeed.tsx:33`

**Interfaces:** Produces the data convention `detection_logs.scan_mode ∈ {'dev_mock_live_camera','dev_mock_image_upload'}` for mock rows. Plan 02 migrates these to `is_mock = true`, and dashboards must exclude them.

- [ ] **Step 1: Write the failing check.** No UI test runner exists in the Next.js reference app yet, and adding one only for this is out of scope (YAGNI). The check is a grep that must return nothing:

Run: `grep -rn "simulateYOLODetection\|YOLOv8\|from('defects').insert" src/app/staff src/app/staff-dashboard src/app/sign-up-login-screen`
Expected now: **matches** (RED).

- [ ] **Step 2: Rename the generator and state what it is.** In `quality-scan/page.tsx`, replace line 47 `function simulateYOLODetection(): Detection[] {` with:

```ts
// DEVELOPMENT MOCK. Returns RANDOM boxes/classes/confidences. This is NOT a model
// result and must never be shown or stored as one. Replaced by the inference
// service in Plan 05.
const IS_MOCK_DETECTOR = true;
function generateDevMockDetections(): Detection[] {
```
Replace both call sites (`simulateYOLODetection()` at lines 143 and 171) with `generateDevMockDetections()`.

- [ ] **Step 3: Stop persisting mock output as real data.** In `saveDetection`, change the insert fields:

```ts
        scan_mode: `${IS_MOCK_DETECTOR ? 'dev_mock_' : ''}${mode === 'live' ? 'live_camera' : 'image_upload'}`,
        notes: IS_MOCK_DETECTOR ? `[DEVELOPMENT MOCK: random output, not a model result] ${notes}` : notes,
```
Then delete the whole block that starts `// If defects found, also save to defects table` and ends at the closing `}` of `if (detections.length > 0 && selectedOrderId) { … }`. Detections become defects only after human confirmation (Plan 04/08).

- [ ] **Step 4: Visible banner.** Directly after the `<p className="text-sm text-muted-foreground mt-2 max-w-2xl">…</p>` under the `<h1>` (line 297–299), insert:

```tsx
            {IS_MOCK_DETECTOR && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                <span>
                  <strong>Development mock:</strong> no trained YOLOv12 model is connected. Boxes, classes and
                  confidence values below are random and are not inspection results.
                </span>
              </div>
            )}
```
(`AlertTriangle` is already imported on line 5.)

- [ ] **Step 5: Copy that overstates capability.**
  - `LoginPageClient.tsx:29` → `desc: 'YOLO-based defect detection (model integration in progress)'`
  - `QuickActionTiles.tsx:29` → body: `'Opening the camera inspection screen for WP-2847. Defect detection runs in development-mock mode until the YOLOv12 model is connected.'`
  - `RecentQAFeed.tsx:33` → `inspector: 'Auto (development mock)'`

- [ ] **Step 6: Run the check again (GREEN)**

Run the Step 1 grep. Expected: **no output**. Then `npx tsc --noEmit`, which should exit 0.

- [ ] **Step 7: Checkpoint.** CHANGELOG entry: "Mock detector labelled in UI and data; auto defect creation removed". Add **ADR-004 "No unlabelled ML output"** to `docs/decision-log.md`.

---

### Task 6: Remove the dead JSON-file auth system (S8)

**Files:**
- Remove: `src/lib/auth.ts`, `src/lib/db.ts`, `data/db.json`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/forgot/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/api/auth/logout/route.ts`
- Keep: `src/app/api/auth/otp/route.ts`, `src/app/api/auth/redirect/route.ts` (Supabase-based, still used)

- [ ] **Step 1: Prove nothing uses them (must stay empty)**

Run: `grep -rnE "@/lib/(db|auth)['\"]|api/auth/(login|me|forgot|reset-password|logout)" src --include=*.ts --include=*.tsx | grep -v "^src/lib/\(db\|auth\).ts" | grep -v "^src/app/api/auth/"`
Expected: no output.

- [ ] **Step 2: Remove.** Deleting in the connected folder needs the team's permission (the device shell blocks `rm` by default). If permission is declined, move the files into `_to_delete/json-auth/` (already excluded in tsconfig) and list them in the CHANGELOG for the team to delete by hand.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: exit 0, `ℹ fail 0`.

- [ ] **Step 4: Checkpoint.** CHANGELOG entry listing each removed or moved path.

---

### Task 7: Full verification, apply to Supabase (human-gated), review

- [ ] **Step 1: All automated checks**

```bash
cd supabase/tests && npm test            # expect: pass 28, fail 0
cd ../.. && npm run test:unit            # expect: pass 8, fail 0
npx tsc --noEmit                         # expect: exit 0
npx next build                           # expect: 42 routes compiled (37 after Task 6)
npx next lint 2>&1 | grep -c "Error:"    # record the count; must not exceed the baseline recorded in mfqats-current-state.md
```

- [ ] **Step 2: Apply the two migrations to the live Supabase project. HUMAN STEP, irreversible without a backup.**
  1. In the Supabase dashboard, take a backup (Database → Backups) or at least export `user_profiles` and `orders`.
  2. Run `20260925000003_mfqats_security_hardening.sql`, then `20260925000004_…sql`, in the SQL editor (or `supabase db push`).
  3. **Mandatory review query**, run right after:
     ```sql
     select email, role, is_active, updated_at from public.user_profiles
     where role in ('admin','staff') order by role, email;
     ```
     Any account the team doesn't recognise as staff or admin should be demoted with `update public.user_profiles set role='customer' where email='…';` (run as the SQL editor, i.e. service role).

- [ ] **Step 3: Manual smoke test** in the running Next.js app (`npm run dev`, then open http://localhost:4028):

| # | Action | Expected |
|---|---|---|
| 1 | Log in as the seeded customer, open `/admin/audit-logs` | Redirected to `/customer-dashboard` |
| 2 | Customer: reproduce the exploit with a tiny Node script using `@supabase/supabase-js` and the anon key: `signInWithPassword` as the customer → `auth.updateUser({ data: { role: 'admin' } })` → `from('audit_logs').select('*')`. Then reload `/admin-dashboard` in the browser. | `audit_logs` returns `[]`. The browser is still redirected to `/customer-dashboard`. |
| 3 | Customer: place an order in Shop | Succeeds. Order view shows an "Order placed" history entry. |
| 4 | Customer: create an inquiry | Succeeds, gets an `INQ-…` reference |
| 5 | Staff: open Quality Scan | Yellow "Development mock" banner visible. Saving creates **no** rows in `defects`. |
| 6 | Admin: Users → deactivate a test staff account; that user reloads a page | Sent to login |
| 7 | Admin: Users → Add user with role Staff | Account created. Check `user_profiles.role`: `staff` if email confirmation is ON. Record the actual behaviour (see Review Focus #2). |

- [ ] **Step 4: Code review.** Use superpowers:requesting-code-review (or engineering:code-review) on the diff between `_snapshots/2026-09-25-baseline.tar.gz` and the working tree. Fix real findings with superpowers:receiving-code-review.

- [ ] **Step 5: Update docs**
  - `docs/mfqats-current-state.md`: mark S1–S5, S7, S8 and D1 as FIXED (tested locally; applied or not applied to Supabase), and quality-scan as "MOCKED (labelled)".
  - `docs/requirements-traceability.md`: create it with the RBAC row → `20260925000003`, `routeAccess.ts`, the tests, and status PARTIAL (the backend layer arrives in Plan 03).
  - `docs/CHANGELOG.md`: final entry with all command outputs.

---

## Self-review (done while writing)

- **Spec coverage:** S1 ✓ (Task 2), S2 ✓, S3 ✓, S4 ✓, S5 ✓, S6 → documented, deferred to Plan 03 (server admin endpoint), S7 ✓ (Task 4), S8 ✓ (Task 6), S9–S12 → Plans 03/12, D1 ✓ (Task 3), D3 (unsafe migrations) → new migrations are idempotent; the old ones stay unchanged by rule, D4 (seed in schema) → Plan 02, mock YOLO ✓ (Task 5), `.env.example` ✓ (Task 0).
- **Placeholders:** none. All code blocks come from files that were executed.
- **Type consistency:** `AppRole`, `decideRoute`, `isAppRole`, `isPublicPath` are used identically in Task 4's module, test and middleware. SQL helper names match between Tasks 2 and 3.
