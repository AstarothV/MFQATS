# MFQATS — Current State (Phase 0 Repository Discovery)

- **Date:** 2026-09-25
- **Scope inspected:** `MVCA-main/` (every source file, both SQL migrations, configs, `data/db.json`), the capstone document *MFQATS: MVCA Furniture Quality Assurance and Tracking System* (June 2026), and the installed skills.
- **Method:** Read-only inspection. I also ran a baseline install, type-check, lint and build on a **scratch copy** in the cloud workspace, not in your folder.
- **Status vocabulary:** COMPLETE · PARTIAL · STUBBED · MOCKED · BROKEN · MISSING. Nothing is marked VERIFIED unless a command or a reading of the code backs it up.

---

## 1. Executive summary

The repository is a **single Next.js 15 / React 19 / TypeScript / Tailwind web app** backed by **Supabase** (Postgres + Auth). It was generated with Rocket.new/DhiWise and then extended. Its UI covers admin, staff and customer screens in a purple/cream visual language.

**What the capstone specifies but the repository doesn't have:**

| Capstone technology | In repository? |
|---|---|
| Flutter app | **MISSING**: no Flutter code, no `pubspec.yaml` |
| Laravel backend | **MISSING**: no PHP. Next.js route handlers and direct Supabase client calls take its place |
| Python inference service (OpenCV/YOLOv12) | **MISSING** |
| YOLOv12 weights / dataset / class config | **MISSING**: no `.pt`, `.onnx`, `data.yaml` or dataset |
| SfM / RANSAC / PnP | **MISSING**: no geometry code at all |
| PERT / WMA / FSM | **MISSING**: no estimation or state-machine code |
| Firebase Storage | **MISSING**: no Firebase config. Images are stored as URLs or as **base64 data URLs inside Postgres text columns** |
| Supabase | **PRESENT**: 2 migrations, RLS enabled on every table |

**Most important finding:** the "YOLO Defect Detection" screen (`src/app/staff/quality-scan/page.tsx`) produces **random detections** (`simulateYOLODetection()` uses `Math.random()` for class, confidence and bounding box). Staff can **save these to `detection_logs` and automatically to `defects`** as if they were real results, with no human confirmation step. That breaks the "do not fake the AI" rule and has to be removed or clearly marked as mock before any demo.

**Second most important finding:** a **critical RLS privilege escalation**. Any signed-in user, customers included, can make themselves `admin` in the database's eyes (details in §6).

---

## 2. Git and repository state

| Item | Finding |
|---|---|
| Git | **Not a git repository** (`fatal: not a git repository`). The folder name `MVCA-main` suggests a ZIP downloaded from a GitHub `main` branch. |
| Branches / history | None available locally |
| `node_modules` | Not installed in your folder |
| `.env` | Present, **correctly git-ignored**. Holds 10 keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and **unused** `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, Stripe publishable key, GA and AdSense IDs. No code references the AI keys (Rocket.new template leftovers). |
| `.env.example` | **MISSING** |

---

## 3. Current architecture

```
Browser (Next.js 15 App Router, React 19, Tailwind 3)
  │  src/app/**            — pages; almost all are 'use client'
  │  src/contexts/AuthContext.tsx — Supabase auth session + user_profiles
  │  src/middleware.ts     — route guard by role (reads user_profiles.role)
  │
  ├── supabase-js (anon key) ──► Supabase Postgres (RLS)   ← main data path
  │       most CRUD happens directly from client components
  │
  └── Next.js route handlers  src/app/api/auth/*
          ├─ redirect, otp       → Supabase
          └─ login, me, forgot, reset-password, logout
                → **a second, separate auth system**: data/db.json + custom HMAC JWT
                  (not called by any UI; dead code)
```

No backend service layer exists: business rules (for example turning a scan into defect records) run in React components.

### Folder structure (source only)

```
src/
  app/
    admin/            audit-logs, chat, defect-analytics, inquiry, inventory, reports, rework, team, users
    admin-dashboard/  AdminDashboardContent
    api/auth/         forgot, login, logout, me, otp, redirect, reset-password
    auth/callback/    Supabase OAuth/email code exchange
    catalog/          product catalog CRUD (admin)
    customer-dashboard/ overview, order-status, order-view, shop, inquiry (+ 3D viewer, photo gallery, timeline)
    landing/          marketing landing page
    orders/           order management (admin)
    real-time-production-dashboard/  KPI cards, charts, workstation grid, alerts
    sign-up-login-screen/
    staff/            ar-visualization, chat, inquiry, quality-scan
    staff-dashboard/  assigned-tasks, inventory, orders (+ timer, tasks, QA feed, stage panel)
    support/
  components/         AppLayout, Sidebar, Topbar, RoleNavigation, NavButton, StatusBadge, LoadingSkeleton, AppIcon/Image/Logo,
                      ChatSystem, InquirySystem, CustomerShopContent, Inventory*Content; navigation hooks + 2 "Example" demo components
  contexts/           AuthContext
  lib/                supabase/{client,server}.ts, auth.ts + db.ts (JSON-file auth), validators.ts
  styles/             tailwind.css (design tokens), index.css
supabase/migrations/  20260519000001_mwqats_core_schema.sql, 20260521000002_mwqats_phase2_features.sql
data/db.json          JSON "database" for the unused custom auth
*.md (13 files)       navigation-system notes from generation (not project docs)
```

### Technology stack (actual)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.1.11 |
| UI | React | 19.0.3 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS + forms/typography plugins | 3.4.6 |
| Charts | Recharts | ^2.15.2 |
| Icons | lucide-react, @heroicons/react | — |
| Forms | react-hook-form | 7.54.2 |
| Data/Auth | @supabase/supabase-js, @supabase/ssr | 2.49.4 / 0.5.2 |
| Font | DM Sans (next/font/google) | — |
| Deploy hint | @netlify/plugin-nextjs | ^5.11.1 |
| Tests | **none** (no Jest/Vitest/Playwright, no test files) | — |

---

## 4. Baseline verification (scratch copy, 2026-09-25)

| Command | Result | Notes |
|---|---|---|
| `npm install` | PASS | |
| `tsc --noEmit` | **PASS (0 errors)** | |
| `next lint` | **FAIL** | 1,659 prettier-format errors, plus 71 `no-explicit-any`, 39 unused vars, 17 `<img>`, 7 `exhaustive-deps`, 2 missing `alt`, and others |
| `next build` | **PASS (42 routes)** | Only after the Google-Fonts fetch was stubbed, because the sandbox can't reach fonts.googleapis.com. That's an environment limit, not a code defect. |
| Tests | **N/A**: none exist | |

---

## 5. Database (Supabase migrations)

**20 tables:** `user_profiles, orders, product_items, production_stages, defects, detection_logs, qa_checklists, time_tracking, inspection_images, rework_logs, audit_logs, notifications, measurements, inventory, products, cart_items, messages, otp_codes`. (The core file says "14 entities" but also creates `inventory`.)

**Enums:** `user_role(admin,staff,customer)`, `order_status` (7 values), `stage_name(cutting, assembly, sanding, staining, finishing, quality_check, shipping)`, `stage_status`, `defect_severity`, `qa_result`, `rework_status`, `notification_type`, `measurement_status`, `product_availability`, `cart_status`, `message_status`, `extended_order_status` (12 values).

**Strengths:** foreign keys throughout, RLS enabled on every table, `updated_at` triggers, sensible indexes, and a profile auto-created on sign-up.

**Problems:**

| # | Problem | Severity |
|---|---|---|
| D1 | The code queries **`inquiries`, `inquiry_messages`, `order_history_logs`**, but **no migration creates them**, so the inquiry system and order history break on a fresh database | High (BROKEN) |
| D2 | Two parallel order-status columns (`orders.status` with `order_status`, `orders.extended_status` with `extended_order_status`) with different value sets. The UI mixes them. | Medium |
| D3 | Migrations begin with `DROP TYPE … CASCADE`. Re-running them on a live database drops dependent columns. They aren't safe to re-run. | High |
| D4 | Seed/mock data (4 auth users with known passwords like `Admin@2026`) lives **inside the schema migration**, so production and demo data aren't separated | Medium |
| D5 | Mock-data blocks end in `EXCEPTION WHEN OTHERS THEN RAISE NOTICE`, so seed failures are silently swallowed | Low |
| D6 | No `roles` table (the capstone ERD has ROLES), no `time_logs` naming (the repo has `time_tracking`), no `detection_results`, `model_predictions`, `annotated_images`, `furniture_dimensions` (partly covered by `detection_logs.detections JSONB` and `measurements`) | Traceability gap |
| D7 | No tables for FSM transitions, checklist templates, tolerance rules, 3D reconstruction jobs, point clouds, RANSAC results, PERT estimates or WMA inputs | MISSING |
| D8 | `detection_logs.image_url` receives full **base64 data URLs** from the quality-scan page, which bloats Postgres | Medium |
| D9 | `products.rating DEFAULT 4.5` and `review_count` are seeded with invented values (4.8 ★, 24 reviews) | Low (fabricated display data) |

---

## 6. Security findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| S1 | **Privilege escalation via `user_metadata`.** `is_admin()`, `is_staff_or_admin()`, `get_user_role()` and `is_customer()` read `auth.users.raw_user_meta_data->>'role'`. Supabase lets **any signed-in user edit their own `user_metadata`** (`supabase.auth.updateUser({ data: { role: 'admin' } })`). A customer can make RLS treat them as admin and read or write every table, audit logs included. | core schema, STEP 4 | **Critical** |
| S2 | **Self-assigned role at sign-up.** `handle_new_user()` copies the role from sign-up metadata, which the client supplies. The public sign-up form sends `role: 'customer'`, but anyone calling the API directly can send `role: 'admin'`. | core schema, `AuthContext.signUp` | **Critical** |
| S3 | **Users can change their own `user_profiles.role`.** The policy `users_manage_own_profile` is `FOR ALL … USING (id = auth.uid())` with no column restriction. The middleware trusts `user_profiles.role` for routing. | core schema, `middleware.ts` | **Critical** |
| S4 | **Customers can write their own orders.** `orders_access` is `FOR ALL` with `customer_id = auth.uid()`, so a customer can change `status`, `amount` or `completion_pct`, or delete the order. The spec says customer access is read-only. | core schema | High |
| S5 | **Role drift.** Admin role changes update `user_profiles.role`, but RLS reads `user_metadata`. The UI and the database then disagree about a user's role. | `admin/users/page.tsx` + helpers | High |
| S6 | **Admin creates users with `supabase.auth.signUp` in the browser.** This replaces the admin's own session in some configurations, and role assignment goes through the same metadata as S2. User creation needs a server-side admin API. | `admin/users/page.tsx:99` | High |
| S7 | **Middleware fails open.** When `getUser()` errors but any cookie whose name contains `auth` exists, the request **continues without authorization**. Any exception also continues ("non-blocking"). | `middleware.ts` | High |
| S8 | **A second auth system with a hardcoded secret.** `lib/auth.ts` falls back to `JWT_SECRET = 'mvcawoodworks-secret-key-2026'`. `data/db.json` holds password hashes. `/api/auth/forgot` confirms whether an email exists (404) and never sends an OTP ("simulated"). Unused by the UI but still deployed. | `lib/auth.ts`, `api/auth/*` | Medium |
| S9 | OTP `POST` accepts an arbitrary `userId` from the body and returns the code in development. OTP comparison isn't constant-time. 2FA isn't wired into login. | `api/auth/otp/route.ts` | Medium |
| S10 | A monkey-patched `window.fetch` injects the Supabase access token as an `x-sb-token` header, and tokens can fall back to `localStorage` | `lib/supabase/client.ts` | Low–Medium |
| S11 | Seeded demo passwords are committed in the migration | core schema, STEP 8 | Medium (demo only) |
| S12 | No rate limiting on auth endpoints. No file-type or size validation on uploads. | — | Medium |

**S1 and S3 were reproduced** (2026-09-25) against the unmodified migrations in an in-process Postgres (PGlite) with a stubbed Supabase `auth` schema. Before the self-edit, the seeded customer `claire.leblanc@gmail.com` saw **0** `audit_logs` rows. After writing `{"role":"admin"}` into their own `raw_user_meta_data` they saw **3**. They could also run `update user_profiles set role='admin' where id = auth.uid()` successfully.

---

## 7. Feature-completion matrix (against the capstone and the master prompt)

| # | Capability | Status | Evidence / notes |
|---|---|---|---|
| 1 | Production tracking | PARTIAL | `orders`, `product_items`, `production_stages` exist. Staff dashboard widgets are **hardcoded** (`AssignedTasksList`, `StageProgressPanel`, `ActiveTimerWidget`, `RecentQAFeed`, `QuickActionTiles` don't query Supabase). |
| 2 | Digital QA checklists | PARTIAL | `qa_checklists.checklist_items JSONB` plus seeded rows. No template table, no per-stage required items, no submission validation, no UI that loads checklists from the database. |
| 3 | Photo capture/upload | PARTIAL | Camera through `getUserMedia` and file upload on quality-scan. **No storage upload**: a data URL goes into Postgres. No quality validation (blur, dark, exposure, resolution). |
| 4 | YOLOv12 detection | **MOCKED (unlabeled)** | `simulateYOLODetection()` returns random results, the UI presents them as YOLO, and they get persisted. The login page says "YOLOv8". |
| 5 | Annotations + confidence | MOCKED | Random bounding boxes and confidences |
| 6 | SfM 3D reconstruction | MISSING | |
| 7 | 3D point-cloud analysis | MISSING | `ProductDetail3D.tsx` is a CSS-transform "3D" viewer of product images, not a point cloud or mesh |
| 8 | RANSAC plane fitting | MISSING | |
| 9 | PnP dimensional estimation | MISSING | `measurements` table exists. "AR visualization" is `simulateARLoad()`. |
| 10 | Rule-based dimensional verification | PARTIAL (data only) | `measurements` has expected/actual/tolerance columns and seeded rows. No computation code. |
| 11 | PERT | MISSING | `products.estimated_production_days` is a static integer |
| 12 | WMA | MISSING | |
| 13 | FSM workflow | MISSING | Stage and status are free-form updates from the client. Nothing enforces preconditions. |
| 14 | Rework recommendations | STUBBED | Template string ``Inspect and address ${label}…``. `admin/rework` lists `rework_logs` from the database. |
| 15 | Production dashboards | PARTIAL / MOCKED | Admin dashboard queries real tables but **fabricates** the revenue trend (`totalRevenue*(0.6+i*0.08)`) and the `'+18%'` delta. The real-time production dashboard (KPI grid, throughput, defect frequency, workstation grid, alerts, header) is **entirely hardcoded**. |
| 16 | Defect & quality analytics | PARTIAL | `admin/defect-analytics` queries `defects` |
| 17 | Time tracking | PARTIAL | `time_tracking` table exists. The timer widget is client-side and hardcoded. Nothing creates entries on stage start or end. |
| 18 | Customer order portal | PARTIAL | Order view, timeline, photo gallery and inquiries query Supabase. Access requires login, while the spec also describes a Reference-ID lookup. |
| 19 | RBAC | PARTIAL / **UNSAFE** | Role routing works in middleware, but see S1–S7 |
| 20 | Audit trail | PARTIAL | `audit_logs` table and an admin viewer. **No code writes audit events** apart from seed rows. |
| 21 | Realtime sync | MISSING | No `supabase.channel()` subscriptions |
| 22 | Reports | STUBBED | `admin/reports` lists report types. Needs checking whether export works (no export library is installed). |
| 23 | Responsive UX | PARTIAL | Tailwind responsive classes, collapsible sidebar. Not verified on devices. |
| 24 | Secure persistence | PARTIAL | See §6 |
| 25 | Testing / traceability | MISSING | No tests, no traceability docs |
| — | Inventory, product catalog, shop/cart, chat, inquiries | PARTIAL | Outside the capstone scope ("does not support outbound logistics"). Inquiries are broken (D1). Shop/cart goes beyond the capstone's read-only customer role. |
| — | Flutter app | MISSING | |
| — | Laravel API | MISSING | |

---

## 8. Design system (reference for the Flutter migration)

Taken from `src/styles/tailwind.css` and `tailwind.config.js`:

- **Primary** `#7C3AED` (violet-600) · **Accent** `#A78BFA` · **Ring** `#7C3AED`
- **Light surfaces:** background `#F7F5F1` (warm cream), card `#FFFFFF`, secondary `#EEE8DF`, muted `#F3EFE8`, border `#E4DDD4`
- **Text:** foreground `#1F1F1F`, muted-foreground `#6B7280`
- **Semantic:** success `#22C55E`, warning `#F59E0B`, danger `#EF4444`, info `#3B82F6`
- **Customer theme:** bg `#F8F5FF`, border `#E9D5FF`
- **Dark theme** defined (`.dark`): bg `#1F1F1F`, card `#2A2A2A`, border `#383838`
- **Radius** base 8px (sm 6, lg 12, xl 16, 2xl 20). Cards commonly use `rounded-3xl`.
- **Font** DM Sans 400/500/600/700
- **Shared components** to port: AppLayout (sidebar + topbar), Sidebar (collapsible 18rem/5rem), Topbar (notifications), RoleNavigation, StatusBadge (variants ok/warning/danger/info/neutral/purple), LoadingSkeleton, NavButton, card-dark, btn-primary, input-dark utility classes

Inconsistency to note: some charts hardcode dark tooltip colors (`#1F1F1F`) on a light theme, and the quality-scan toast uses inline hex values.

---

## 9. Contradictions found

| # | Capstone says | Repository does | Proposed handling |
|---|---|---|---|
| C1 | Flutter frontend (web + APK) | Next.js/React | Master prompt: build Flutter separately and keep Next.js as the reference. **Decision needed.** |
| C2 | Laravel backend enforces business rules | No backend. Client-side Supabase calls. | **Decision needed** (Laravel vs Supabase-native) |
| C3 | Production stages = **Upload → 3D Reconstruction → Detect Defects → Result** (+ Recommendation) | Stages = **cutting, assembly, sanding, staining, finishing, quality_check, shipping** | **Decision needed.** The capstone text shows signs of a global find-and-replace (for example "uneven *Detect Defects*", "flag out-of-spec lumber prior to *3D Reconstruction*", "one of the **five** sequential phases" followed by four names). |
| C4 | YOLOv12 | Login page advertises YOLOv8. No model exists. | Use YOLOv12 per spec and fix the copy |
| C5 | Firebase Storage for images, Supabase for data | No Firebase. Images are external URLs or base64 in Postgres. | Recommend **Supabase Storage** (one vendor, already configured, RLS-integrated) and record it as a decision-log entry that deviates from the capstone |
| C6 | Customer is **read-only**, tracks by Reference ID | Customer logs in and can shop, add to cart, order, chat and has **write** access to orders | Keep login and restrict writes. The Reference-ID lookup needs a decision (public lookup plus a second factor vs login only). |
| C7 | Roles: Admin/Supervisor, Staff/Worker, Customer. ERD has a ROLES table. | Postgres enum with 3 roles, no roles table | Keep the enum and add a permission map (capabilities) server-side |
| C8 | The capstone says there's "no predictive analytics / AI forecasting" | PERT/WMA estimated completion is required | Not a real conflict: PERT/WMA is deterministic estimation. Document it that way. |
| C9 | ERD names `time_logs`, `audit_trails`, `defect_images`, and others | `time_tracking`, `audit_logs`, `inspection_images` | Keep the repository names and map them in `database.md` / the traceability doc |
| C10 | 3D rendering takes 20–30 minutes (limitation) and detection takes 3–5 s per image (requirement) | — | Asynchronous jobs for SfM, synchronous for YOLO. Measure both. |
| C11 | Name "MFQATS" | Code says "MWQATS — MVCA **Wood** Quality…" | Rename in copy |

---

## 10. Technical debt

1. Business logic lives in React client components (scan → defect creation, user creation).
2. A dead parallel auth system (`lib/auth.ts`, `lib/db.ts`, `data/db.json`, 5 routes).
3. 13 generator-produced navigation markdown files at the repository root, plus `NavigationExample.tsx` and `RoleNavigationExample.tsx` demo components.
4. Duplicate navigation abstractions (`navigation.ts`, `roleNavigation.ts`, `useRoleNavigation.ts`, `RoleNavigation.tsx`, `Sidebar.tsx`).
5. 71 `any` types. Lint fails on formatting.
6. No tests, no CI.
7. Hardcoded demo data inside components (staff dashboard, production dashboard, team page, landing testimonials).
8. `@dhiwise/component-tagger` and a `rocketCritical` block in `package.json` are generator artifacts.

---

## 11. Available skills (inspected)

Skills that apply and will be used: **superpowers** (brainstorming, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents, test-driven-development, systematic-debugging, verification-before-completion, requesting- and receiving-code-review, using-git-worktrees, finishing-a-development-branch), **engineering** (architecture/ADR, system-design, code-review, testing-strategy, tech-debt, documentation, deploy-checklist, debug), **design** (design-system, accessibility-review, design-critique, ux-copy, design-handoff), and **dataviz** for dashboard charts.

**Not available:** no Flutter-specific skill, no computer-vision/ML skill, no dedicated frontend-design skill. Flutter and CV work will follow general engineering practice.

**Tooling on your machine (Linux shell in the desktop app's VM):** node 22, npm, git 2.34, python 3.10, pip. **Not installed: Flutter/Dart, PHP/Composer (Laravel), Docker, psql, Supabase CLI, any NVIDIA GPU.** The cloud workspace can install Flutter/PHP/Python packages to build and test, but GPU training or inference isn't available there.

---

## 12. Proposed implementation sequence (draft, pending decisions in §9)

The master prompt's phase order stays in place, with two corrections based on the evidence: **security (S1–S4) comes first**, because every later phase builds on RLS, and **the unlabeled mock YOLO is neutralized immediately**.

| Step | Work | Why first |
|---|---|---|
| 0 | `git init` (or connect to the existing GitHub repository), baseline commit of the untouched code, `.env.example` | Rollback safety and reviewable diffs |
| 1 | **Security migration:** roles from `app_metadata` or a server-owned table (not `user_metadata`), lock `user_profiles.role`, customer read-only orders, fail-closed middleware, delete the JSON-file auth | Critical holes affect every screen |
| 2 | Label the existing mock detection as **"DEVELOPMENT MOCK — not a model result"** and stop auto-creating defects from it | Truthfulness before any demo |
| 3 | Missing migrations (`inquiries`, `inquiry_messages`, `order_history_logs`) plus idempotent migrations and separated seed data | Fixes BROKEN features |
| 4 | Domain schema: stage FSM + transitions table, checklist templates, tolerance rules, reconstruction jobs, detection results, PERT/WMA tables | Foundation for §9–19 of the prompt |
| 5 | Backend service layer (Laravel **or** Supabase-native, per decision C2): FSM service, audit logging, permission map, with tests | Rules move out of the UI |
| 6 | Python inference service: YOLO adapter interface + **clearly labeled mock adapter**, image-quality checks (blur/dark/exposure/resolution), RANSAC/PnP/distance math with synthetic fixtures (pytest) | Deterministic math is testable without weights |
| 7 | Flutter app foundation: design tokens from §8, AppTheme, routing plus guards, auth, responsive shell | |
| 8 | Screen-by-screen Flutter migration following `ui-migration-map.md` | |
| 9 | SfM job pipeline (COLMAP or OpenCV based), point-cloud viewer | Heaviest, needs hardware decisions |
| 10 | PERT/WMA, real dashboards (replace hardcoded widgets), realtime, customer portal, reports | |
| 11 | Hardening, performance baseline, full tests, docs, traceability | |

### Decisions taken (2026-09-25, by the project team)

| Question | Decision |
|---|---|
| C1/C2 Architecture | **Flutter + Laravel API + Python (FastAPI) inference service.** Supabase Postgres and Supabase Auth stay in place; Laravel verifies Supabase JWTs. |
| C3 Stages | **Superseded on 2026-09-30: one workflow.** The only process stages are **Upload → 3D Reconstruction → Detect Defects → Results → Recommendation**. An order is `pending → confirmed → [the five stages] → delivered` (or `cancelled`); the workshop stages (cutting … shipping) are no longer tracked. Defined in `src/lib/orders.ts` and enforced by `supabase/migrations/20260930000006_five_stage_process.sql`. *(Earlier decision: two levels, workshop stages as the FSM with the inspection pipeline at each QA gate.)* |
| YOLO | **No weights or dataset yet.** Build the inference interface, a clearly labelled mock adapter, and training scaffolding. Metrics stay "Not yet measured". |
| Git | **No git.** Mitigation: a baseline snapshot archive before the first change, plus a `docs/CHANGELOG.md` entry per task. |

Plans: `docs/superpowers/plans/2026-09-25-mfqats-roadmap.md` and `docs/superpowers/plans/2026-09-25-plan-01-security-truthfulness-foundation.md`.
