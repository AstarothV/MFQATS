# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the supervisor / admin at a desk.** The MVCA Furniture owner or production supervisor who monitors orders moving through production, assigns staff to orders, reviews defect detections, false-alarm requests and rework, spots delays and bottlenecks, manages users, catalog and inventory, and pulls reports and audit logs. When role needs conflict, design decisions favor this user.
- **Workshop staff.** Floor workers who pick the order they are working on, run quality scans with a phone or tablet camera, build the 3D model, move orders through the stages and send possible false alarms to an admin. Per the capstone requirements they may have basic digital literacy and work in a sawdust-heavy, unevenly lit workshop.
- **Customers.** They log in to their own account (there is no tracking by Reference ID): order status, stage times and timeline, estimated completion, the inspection photos and the 3D model of their piece, product browsing and inquiries.

## Product Purpose

MFQATS (MVCA Furniture Quality Assurance and Tracking System) replaces MVCA Furniture's paper checklists and manual visual inspection with a web platform that:

- detects furniture defects from photos;
- tracks each order through the production stages in real time.

It addresses two problems. Quality-control failures surface late and cause costly rework. Supervisors also lack visibility into production progress and delays. Success means:

- defects are caught in-process rather than by customers;
- rework drops;
- supervisors see status and bottlenecks without walking the floor.

## Positioning

A single platform for a furniture MSME that ties automated defect identification directly to the live production workflow. The vision layer combines:

- YOLOv12 surface-defect detection on a photo of every side (a close-up per side where taken);
- a 3D model of the whole piece built from the photos (TRELLIS, or Hunyuan3D-2 as the fallback), shown with the order's ordered dimensions and the photo-scan defects marked on it (edit-mode surface grid or pins). The model is for viewing; it is not to scale and nothing is measured on it.

Its results feed a stage-gated order workflow, implemented as a finite state machine (FSM) across Upload → 3D Reconstruction → Detect Defects → Results → Recommendation, with PERT/WMA delivery estimates. A failed scan can be sent to an admin, who approves it as a false alarm or confirms the defects. Most existing systems keep quality data separate from production state, or target large-scale industry.

## Operating Context

- **Setting:** MVCA Furniture's main workshop, Caloocan City, Metro Manila. The initial implementation is limited to this workshop.
- **Near-term purpose:** both a capstone defense at National Teachers College (BSIT) and a real pilot with MVCA staff. Evaluation uses an ISO/IEC 25010 survey (4-point Likert, weighted mean and standard deviation) with workshop staff, management and QA inspectors, plus Precision, Recall, F1 and IoU for detection.
- **Devices:** desktops/laptops (supervisor), phones and tablets (staff, via camera), customer devices for tracking.
- **Hosting:** the website runs on Vercel and the database, logins and file storage on Supabase (cloud). The Python detection server (YOLO and the 3D model requests) runs on the team's laptop and is reached through a Tailscale Funnel https address, so the laptop, the server and the funnel must be on for the Quality Scan tools to work.
- **Supported furniture types:** cabinets, tables, chairs.

## Capabilities and Constraints

- **Roles:** admin (supervisor), staff (worker), customer. Role-based access is enforced by middleware and Supabase RLS; the database reads each user's role from their profile.
- **Stack (existing codebase):** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime, Storage), Recharts, model-viewer and three.js for 3D. A Python FastAPI service runs YOLOv12n detection and sends the 3D model requests. PnP measuring, RANSAC surface analysis and SfM reconstruction were removed.
- **Admin surfaces:** overview dashboard, inspection progress monitor, user management, product catalog, order management (with staff assignment and, for cancelled orders, delete), messages, inventory, team, reports, audit logs (recorded automatically), defect analytics, rework queue (with scan reviews of possible false alarms).
- **Staff surfaces:** workshop view (pick an order; stage timer that starts at Start Production and can be paused; a stage checklist that ticks itself from the saved work and moves the order on), assigned tasks, order workflow, Quality Scan (Upload → 3D Reconstruction → Detect Defects with close-ups → Results → Recommendation with Finish), inventory, messages.
- **Customer surfaces:** overview (stage times), order view (photo gallery and 3D preview that update as the work is done), inquiry, shop.
- **Known limits:**
  - detects external surface defects only; dents and warping are not detected;
  - accuracy depends on image capture, lighting and camera quality, and false alarms happen (hence the admin review);
  - the 3D model takes about a minute; the free online service has a daily limit, with a local GPU fallback;
  - rework is recommended by the system but performed by hand;
  - no logistics/GPS tracking, no predictive analytics, no machine integration.
- **Terminology:** *stage*, *rework* / *back job*, *pass rate* and *defect rate* (failed inspections ÷ inspections), *false alarm* / *scan review*, *confidence score*.

## Brand Commitments

- **Names, each in its place:** the system is **MFQATS**, *MVCA Furniture Quality Assurance and Tracking System*, built for **MVCA Furniture** (the paper, the defense, staff and admin context). **MVCA WoodWorks** is the shop name customers see on the website (landing page, shop, logo text). Both are confirmed; "MWQATS" is a typo.
- **Palette requirement:** purple and white, per the capstone's specification of "purple and white gradient styling across all devices". Only the requirement is recorded here; how it is expressed belongs to design work.
- **No "AI" wording:** user-visible text and the paper never say "AI" or "artificial intelligence"; describe it as YOLOv12 defect detection, the 3D model, machine learning or rule-based algorithms. AR was dropped from the product.
- **Currency:** Philippine peso (₱) everywhere.
- **Honest results:** detections, time estimates and model output must come from the real models and algorithms, or be clearly labeled as estimates or unavailable. Simulated output must never be presented as real results.

## Evidence on Hand

- **Capstone manuscript:** *MFQATS: MVCA Furniture Quality Assurance and Tracking System* (June 2026). Diaz, Dugenio, Mangaring, Rubia, Sy; adviser Jay Vee L. Capiral. Change notes for it: `docs/project/PAPER_FIXES.md`; testing draft: `docs/project/THESIS_4.4-4.5_TESTING.md`.
- **YOLOv12n training notebook:** `src/api/train_yolov12n_wood.ipynb`. Model registry: `src/api/weights/models.json`.
- **Logo:** `public/assets/images/app_logo.png`.
- **Showcase content kept on purpose:** the landing page's testimonials and figures such as "500+ Happy Customers" are illustrative client-showcase content, kept by the team's choice; they are not real evidence.
- **Absent, not to be fabricated:** real customer testimonials, real production metrics or rework-reduction figures, ISO 25010 survey results, and measured detection accuracy from the pilot. Chapter 5 results are not yet written.

## Product Principles

1. **The supervisor's picture comes first.** Every surface should make production status, quality issues and bottlenecks legible at a glance from a desk.
2. **Truth over impressiveness.** Show real model output with its confidence, label estimates as estimates, and never dress up simulated results. A person (the admin) can overrule a false alarm, but the scan's own result is never rewritten.
3. **Quality is gated in-process.** Orders advance stage by stage only after passing checks. The UI should make the current gate and its outcome obvious rather than letting work skip ahead.
4. **Built for the real workshop.** Staff-facing flows must survive dust, poor lighting, phones and modest digital literacy.
5. **Customers see progress as it happens.** The customer view is read-only and limited to their own orders; it shows the inspection photos as staff add them, the 3D model, stage times and honest estimates, not the internal review.

## Accessibility & Inclusion

- The capstone requires usability for workers with basic digital literacy: progressive, picture- and checklist-led navigation.
- It also requires consistent behavior across desktop, tablet and smartphone.
- No formal WCAG level has been stated. Treat reduced-motion support and readable contrast as the floor (already present in the codebase).
