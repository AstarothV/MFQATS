# MFQATS Roadmap: plan of plans

**Spec:** the master build prompt + the capstone document + `docs/mfqats-current-state.md` (including "Decisions taken").

MFQATS has four independent subsystems: the database, the Laravel API, the Python CV service, and the Flutter app. Following superpowers:writing-plans, each gets its **own plan**. Each plan produces working, tested software on its own. A plan is written in detail only when the one before it is done, so it can use real interfaces instead of guesses.

## Target architecture (decided)

```
Flutter app (web + Android + desktop)          ← replaces the Next.js UI; Next.js kept as visual reference
   │ HTTPS + Supabase JWT
   ▼
Laravel 11 API  (/api/v1)                      ← FSM, RBAC permissions, checklists, audit, PERT/WMA, reports
   │  pgsql (Supabase Postgres)   │ HTTP (internal)
   ▼                              ▼
Supabase Postgres + Auth +     Python FastAPI inference service (on-prem workstation)
Supabase Storage + Realtime      ├─ image quality checks (OpenCV)
                                 ├─ YOLOv12 adapter  (mock adapter until weights exist, labelled)
                                 ├─ SfM job runner    (async; COLMAP/OpenCV)
                                 ├─ RANSAC plane fit + point-to-plane deviation
                                 └─ PnP / Euclidean dimensional measurement (calibration required)
```

**Two-level workflow:**
- **Production FSM** (per product item): `cutting → assembly → sanding → staining → finishing → quality_check → shipping`, with `rework` as a side state. A stage can't complete until its QA gate passes.
- **QA gate pipeline** (per stage inspection): `UPLOAD → RECONSTRUCTION_3D → DETECT_DEFECTS → RESULT` (+ recommendation). A failing result creates rework, and re-inspection retries the gate.

## Plans (in order)

| # | Plan | Delivers | Depends on | Status |
|---|---|---|---|---|
| 01 | **Security & truthfulness foundation** | Baseline snapshot, `.env.example`, RLS privilege-escalation fixes, missing inquiry/history tables, fail-closed middleware, labelled mock YOLO, removal of the dead JSON auth, PGlite DB test harness | — | **Written, awaiting approval** |
| 02 | Domain schema v2 | Stage FSM tables (`stage_transitions`), QA-gate pipeline runs, checklist templates + responses, tolerance rules per product type, inspection images → Storage, detection results/model predictions, reconstruction jobs, RANSAC/PnP results, PERT/WMA tables, audit triggers, seed data split from schema | 01 | Not written |
| 03 | Laravel API foundation | Laravel 11 project in `backend/`, Supabase JWT guard, permission map (capabilities, not role checks), policies, API resources, error envelope, audit service, admin user-creation endpoint (service role), Pest tests including negative RBAC | 02 | Not written |
| 04 | Workflow services | FSM service + transition endpoint, QA-gate pipeline service, checklist validation, automatic time tracking (start/stop per stage, no duplicate timers, idempotency keys), rework recommendation rules | 03 | Not written |
| 05 | Python CV service | FastAPI in `services/inference/`, image-quality checks, `Detector` interface + `MockDetector` (flagged `is_mock`) + `YoloV12Detector` (loads `.pt` when present), class-mapping config, RANSAC, PnP, Euclidean distance, all pytest-tested on synthetic fixtures; YOLO training scaffolding (`data.yaml` template, train script) | 02 (schema), 03 (callback contract) | Not written |
| 06 | SfM reconstruction jobs | Async job queue (Laravel queue → inference service), COLMAP or OpenCV SfM pipeline, point-cloud storage (PLY in Storage), job states queued/processing/completed/failed, insufficient-overlap handling | 05 | Not written |
| 07 | Flutter foundation | `flutter/` app, design tokens from the Next.js theme, AppTheme, core widgets, go_router + guards, Supabase auth, API client, responsive shell (phone/tablet/desktop breakpoints), widget tests. Plus `docs/ui-migration-map.md` | 03 | Not written |
| 08 | Flutter: staff flows | Assigned tasks, stage start/stop, checklist, camera capture + upload queue, detection review (confirm/reject/escalate), rework | 04, 05, 07 | Not written |
| 09 | Flutter: 3D + measurement | Point-cloud viewer, RANSAC deviation overlay, measurement display that never shows millimetres without calibration | 06, 08 | Not written |
| 10 | Analytics | PERT + WMA services (tested), dashboard metrics defined in `docs/dashboard-metrics.md`, server-side aggregation, realtime, admin dashboard in Flutter | 04 | Not written |
| 11 | Customer portal + reports | Read-only customer views, approved final photos only, feedback, report generation | 10 | Not written |
| 12 | Hardening & evidence | Security review, performance baseline, full regression, requirements traceability, deployment docs, ISO 25010 evidence pack | all | Not written |

## Constraints that apply to every plan
- Next.js app under `src/` is **kept and not destructively changed**. Plan 01 fixes only security and truthfulness defects in it.
- **No fabricated ML results or metrics.** Anything mocked is labelled in data (`is_mock` / `scan_mode='dev_mock_*'`) and in the UI.
- **No git (team decision).** Each plan starts from a snapshot archive, and every task appends to `docs/CHANGELOG.md`.
- The tooling on the team machine lacks Flutter, PHP and Docker, so Plans 03 and 07 begin with a tooling-install task.
