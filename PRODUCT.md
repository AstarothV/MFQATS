# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the supervisor / admin at a desk.** The MVCA Furniture owner or production supervisor who monitors orders moving through production, reviews defect detections and rework, spots delays and bottlenecks, manages users, catalog and inventory, and pulls reports. When role needs conflict, design decisions favor this user.
- **Workshop staff.** Floor workers who view assigned tasks, run AI quality scans with a phone or tablet camera, fill digital checklists, log work and rework. Per the capstone requirements they may have basic digital literacy and work in a sawdust-heavy, unevenly lit workshop.
- **Customers.** Read-only order tracking: order status and timeline, estimated completion, approved final-inspection photos, product browsing and inquiries.

## Product Purpose

MFQATS (MVCA Furniture Quality Assurance and Tracking System) replaces MVCA Furniture's paper checklists and manual visual inspection with a web platform that:

- detects furniture defects from photos;
- measures surface deviations and dimensions;
- tracks each order through the production stages in real time.

It addresses two problems. Quality-control failures surface late and cause costly rework. Supervisors also lack visibility into production progress and delays. Success means:

- defects are caught in-process rather than by customers;
- rework drops;
- supervisors see status and bottlenecks without walking the floor.

## Positioning

A single platform for a furniture MSME that ties automated defect identification directly to the live production workflow. The vision layer combines:

- YOLOv12 surface-defect detection;
- rule-based 3D surface analysis (Structure-from-Motion reconstruction, RANSAC plane fit, point-to-plane deviation);
- PnP marker-based dimensional measurement.

Its results feed a stage-gated order workflow, implemented as a finite state machine (FSM) across Upload → 3D Reconstruction → Detect Defects → Results → Recommendation, with PERT/WMA delivery estimates. Most existing systems keep quality data separate from production state, or target large-scale industry.

## Operating Context

- **Setting:** MVCA Furniture's main workshop, Caloocan City, Metro Manila. The initial implementation is limited to this workshop.
- **Near-term purpose:** both a capstone defense at National Teachers College (BSIT) and a real pilot with MVCA staff. Evaluation uses an ISO/IEC 25010 survey (4-point Likert, weighted mean and standard deviation) with workshop staff, management and QA inspectors, plus Precision, Recall, F1 and IoU for detection.
- **Devices:** desktops/laptops (supervisor), phones and tablets (staff, via camera), customer devices for tracking. Hybrid deployment: YOLO and geometry processing run on a local edge workstation; the web app and database are cloud-hosted.
- **Supported furniture types:** cabinets, tables, chairs.

## Capabilities and Constraints

- **Roles:** admin (supervisor), staff (worker), customer. Role-based access is enforced by middleware and Supabase RLS.
- **Stack (existing codebase):** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime), Recharts. There is also a Python service for YOLOv12n inference, PnP measurement, RANSAC surface analysis and SfM reconstruction.
- **Admin surfaces:** overview dashboard, inspection progress monitor, user management, product catalog, order management, messages, inventory, team, reports, audit logs, defect analytics, rework queue.
- **Staff surfaces:** workshop view, assigned tasks, order workflow, Quality Scan (AI), inventory, messages.
- **Customer surfaces:** overview, order view, inquiry, shop.
- **Known limits (from the manuscript):**
  - detects external defects only;
  - accuracy depends on image capture, lighting and camera quality;
  - detailed 3D reconstruction can take 20–30 minutes on workshop hardware;
  - rework is recommended by the system but performed by hand;
  - no logistics/GPS tracking, no predictive analytics, no machine integration.
- **Terminology:** *stage*, *rework* / *back job*, *first-time pass rate*, *Reference ID* (customer order tracking), *confidence score*.

## Brand Commitments

- **Name:** the product is **MFQATS**, *MVCA Furniture Quality Assurance and Tracking System*, built for **MVCA Furniture**. Some UI copy still reads "MVCA WoodWorks" or "MWQATS"; the confirmed name is MFQATS.
- **Palette requirement:** purple and white, per the capstone's specification of "purple and white gradient styling across all devices". Only the requirement is recorded here; how it is expressed belongs to design work.
- **Honesty about AI:** detections, measurements, surface analyses and time estimates must come from the real models and algorithms, or be clearly labeled as estimates or unavailable. Simulated output must never be presented as real results.

## Evidence on Hand

- **Capstone manuscript:** *MFQATS: MVCA Furniture Quality Assurance and Tracking System* (June 2026). Diaz, Dugenio, Mangaring, Rubia, Sy; adviser Jay Vee L. Capiral.
- **YOLOv12n training notebooks:** `train_yolov12n_wood.ipynb`, `train_yolov12n_wood_w_results.ipynb`. Model registry: `src/api/weights/models.json`.
- **Surface-analysis samples:** `src/api/samples/*.ply` (flat, dent, warp boards).
- **Measurement marker:** printable at `public/assets/mfqats-marker-150mm.pdf`.
- **Logo:** `public/assets/images/app_logo.png`.
- **Absent, not to be fabricated:** customer testimonials, real production metrics or rework-reduction figures, ISO 25010 survey results, and measured detection accuracy from the pilot. Chapter 5 results are not yet written.

## Product Principles

1. **The supervisor's picture comes first.** Every surface should make production status, quality issues and bottlenecks legible at a glance from a desk.
2. **Truth over impressiveness.** Show real model output with its confidence, label estimates as estimates, and never dress up simulated results. The panel and MVCA both need to trust the numbers.
3. **Quality is gated in-process.** Orders advance stage by stage only after passing checks. The UI should make the current gate and its outcome obvious rather than letting work skip ahead.
4. **Built for the real workshop.** Staff-facing flows must survive dust, poor lighting, phones and modest digital literacy.
5. **Customers see progress, not internals.** The customer view is read-only, limited to their own order, approved photos and honest estimates.

## Accessibility & Inclusion

- The capstone requires usability for workers with basic digital literacy: progressive, picture- and checklist-led navigation.
- It also requires consistent behavior across desktop, tablet and smartphone.
- No formal WCAG level has been stated. Treat reduced-motion support and readable contrast as the floor (already present in the codebase).
