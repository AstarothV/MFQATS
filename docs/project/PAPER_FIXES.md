# Fixes for the MFQATS capstone paper

Paste everything below this line into Claude chat, together with the paper.

---

I am fixing our capstone paper, "MFQATS: MVCA Furniture Quality Assurance and Tracking System". The system is already
built. Below are (A) the facts about the real system and (B) a list of things in the paper that are wrong,
inconsistent or unfinished. Please help me fix them section by section.

Keep the formal academic tone. Do not invent results, numbers, survey scores or citations. Where something has to come
from us, write [TO FILL] instead. Do not use the words "AI" or "artificial intelligence" for our system: describe it as
YOLO-based machine learning, computer vision and rule-based algorithms.

## A. How the real system works (use this as the source of truth)

**Users**
- Admin (supervisor), Staff (worker) and Customer.
- Customers register themselves. Admin creates staff accounts.
- Each role can only open its own pages. Every other page sends the user back to their own dashboard.

**Order flow, enforced by the database (Finite State Machine)**
1. Pending (customer places the order in the Shop).
2. Confirmed (admin approves).
3. The five inspection stages:
   1. Upload
   2. 3D Reconstruction
   3. Detect Defects
   4. Results
   5. Recommendation
4. Delivered.

Rules:
- An order moves one step at a time.
- It can be Cancelled at any point before delivery.
- It cannot move to Results until a scan has been saved during Detect Defects.
- It cannot be Delivered unless the latest scan passed.
- A failed piece goes back to Upload and is inspected again from the start.

**The four algorithms**

The earlier version of the system also had Structure from Motion (SfM) 3D reconstruction, a RANSAC surface check for
dents and warping, and Perspective-n-Point (PnP) measuring with a printed marker. **These were removed from the
system.** Remove them from the paper too (see items 9, 11, 18, 21, 30, 31 and 36).

| Module | Task | Algorithm | Type |
|---|---|---|---|
| 1. Surface Defect Detection | Cracks, knots, holes, scratches and similar defects in photos of each side | YOLOv12 | Machine learning |
| 2. 3D Model | 1 to 6 photos of the piece become a 3D model for viewing, with the defects from module 1 shown on it | Image-to-3D models TRELLIS and Hunyuan3D-2 (through free online services, or Hunyuan3D-2 on a local GPU) | Computer vision |
| 3. Production Timeline | Expected time per stage and estimated completion date | PERT: Te = (O + 4M + P) / 6; plus a Weighted Moving Average (WMA) of recent stage times for the current pace | Statistical |
| 4. Stage Transition Logic | The order flow rules above | Finite State Machine (FSM) | Procedural rule-based |

**Defect detection (YOLOv12)**
- Two trained YOLOv12n models run together and their results are merged:
  - **Coated-wood model:** hole, blister, crack, scratch.
  - **Raw-wood model:** crack, dead knot, hole, live knot, knot with crack, blue stain, knot missing, marrow,
    overgrown, quartzity, resin.
- The photo is also checked in small tiles, so thin scratches are not missed.
- Each defect gets a box, a confidence score, a severity and a repair recommendation.
- Natural features such as live knots are low severity and do not fail the piece.
- A scan fails when it has at least one defect that is not low severity.
- The confidence threshold of the raw-wood model is 0.30. In our threshold test it gave the best F1-score, 0.633.

- Staff can scan one side at a time, or press "Scan all sides" to scan every uploaded photo. Results shows a grid with
  one tile per side and its defects; the scan of all sides is saved as one record.

**Dents and warping are NOT detected**
- The YOLO models have no dent or warp class, and nothing in the system measures the shape of the surface.
- Say this as a delimitation, and list it as a recommendation for future work.

**The 3D Model (Quality Scan step 2, "3D Reconstruction")**
- 1 to 6 photos (front, left, back, right, top, bottom) become a coloured 3D model of the whole piece, through a free
  online 3D service, with a local fallback on a computer with an NVIDIA GPU of 4 GB or more.
- It takes about 1 minute.
- It is NOT to scale, and nothing is measured on it. The "Dimensions" button draws the **ordered size** (length, width
  and height of the product the customer ordered) as lines on the model, for comparison by eye.
- In step 3 (Detect Defects), the defects that YOLOv12 found on each side's photo are shown on the 3D model in two
  ways:
  - **Edit mode:** the model's surface drawn as an even square grid; the cells where a defect was found are painted
    red (fails the piece), amber (needs checking) or green (natural wood feature).
  - **Defect pins:** a numbered pin with the defect's name on the side where it was found.
- The positions on the model are approximate (the photo's spot laid onto that side of the model). The 3D model itself
  does not find defects.

**Other features**
- Customer: Shop with photos and cart, checkout, OrderView with the stage timeline and estimated completion date,
  Inquiry/messages, notifications on every stage change.
- Admin: Admin Overview (revenue, orders in progress, staff, defect rate = failed inspections ÷ inspections),
  Inspection Progress (average time per stage, inspection pass rate, bottlenecks = orders past their PERT time),
  Order Management, Product Catalog, Inventory, Team, Rework Queue, Defect Analytics, Reports with CSV export, User
  Management, Audit Logs, Messages.
- Staff: Workshop dashboard, Assigned Tasks, Order Workflow, Quality Scan (one step per stage), Inventory, Messages.
- **Staff assignment:** when the admin approves an order, Order Management lists the staff, with the available ones
  (no active order) first, and the admin assigns one. The Team page shows the same assignments (who is working on
  what, orders without staff) and can assign too. The assigned staff member is notified, and the order appears in
  their Assigned Tasks. Both pages update on their own, so they always show the same data.
- **Audit Logs fill themselves:** every sign-in, sign-out, opening of the system and password change is recorded by
  the website; every change to orders (placed, stage moved, staff assigned), products, users, inventory, saved scans,
  defects and rework is recorded by the database itself, with who did it, what changed, the IP address and the
  browser. The Audit Logs page refreshes every 10 seconds.
- Automatic actions:
  - **Saved failing scan:** a rework task with the recommended fixes is created and the admins are alerted.
  - **Passing scan:** the admins are told the results are ready.
  - **Every stage change:** time-stamped automatically, with no manual start/stop.
- Customers log in to see their own orders. Each order has a reference number such as ORD-4421. There is no tracking
  without logging in.

**Technology**
- Website: Next.js 15 (React, TypeScript, Tailwind CSS). One responsive web app for computers, tablets and phones;
  there is no separate mobile app. 3D viewing uses model-viewer and three.js (edit mode).
- Database, logins and storage: Supabase (PostgreSQL, cloud). The order rules and the audit log are handled inside
  the database.
- Detection server: Python with FastAPI, Ultralytics YOLOv12 (PyTorch) and OpenCV. It runs YOLO and sends the 3D
  model requests.
- Camera: the phone or laptop camera through the browser (live scan or photos). No mounted industrial camera.
- Hosting: the website is published on Vercel. The detection server runs on the team's laptop and is reached through
  a secure https tunnel (Tailscale Funnel); phones use the same published website.
- There is NO Laravel and NO Firebase. AR was removed from the system.

**Not finished yet (say so honestly, or leave out)**
- The customer Photo Gallery does not yet show the inspection photos from the Quality Scan.
- 3D models are shown and downloaded but not saved with the order.
- There is no digital checklist screen. The gates between stages are the saved scan and the passed scan. (The
  database has a qa_checklists table, but no screen uses it.)
- The scan photo is saved inside the scan record in the database, not as a separate file in storage.

## B. Things to fix in the paper

### Front matter
1. **Approval sheet:** "March 22, 2025" while the cover says June 2026. Check the year.
2. **Adviser's name:** the Acknowledgement writes "Mr. Jay Vee L. **Capital**"; the Approval Sheet writes
   "**Capiral**". Make them match.
3. **Program head and dean:** the Approval Sheet names Rheyven L. Fernando (Program Head) and Liezel A. Aguilar
   (Dean). The Acknowledgement names Carlito L. Cunanan and Dr. Tessie Palma. Use the correct current officials in
   both places.
4. **Unfinished placeholders:** the Acknowledgement still says "To the panelists, (name)"; the Abstract and Keywords
   are empty; page 2 is a blank page.
5. **Table of Contents:**
   - page numbers are out of order (4.3.3 at page 37 comes after 4.3.2 at page 38);
   - Chapter 1 is titled "INTRODUCTION" in the TOC but "THE PROBLEM AND ITS BACKGROUND" in the text;
   - "1.1 Project Context" has no matching heading in the text (it says "Introduction");
   - the last chapter has no "CHAPTER 6" heading;
   - "List of Tables" and "List of Figures" are listed but missing.
   Regenerate the TOC at the end.

### Chapter 1
6. **The process has FIVE stages**, but most places list four. Write "Upload, 3D Reconstruction, Detect Defects,
   Results, and Recommendation" in: Introduction, Purpose, Project Description, Scope, Significance, and the
   definitions of Automated Time Tracking and IPQC.
7. **Definition of "Stage":** it lists "Upload, 3D Reconstruction, Detect Defects, **staining**, or Results". Replace
   "staining" with Results and Recommendation.
8. **"bents"** → **"bends"** everywhere (Introduction, Project Description, Scope).
9. **Which algorithm finds what:**
   - The text says YOLO and 3D rendering find dents, bends and voids. In the system, YOLO finds surface defects
     (cracks, knots, holes, scratches, blisters, stains, resin).
   - Dents and bends are not detected by any part of the system (Part A). The 3D model only shows the defects YOLO
     found in the photos.
   - Fix the Introduction, the Project Description, and the Scope bullet "ML-Based Detection – … 3D rendering for
     detecting physical anomalies (dents/bents)". Add a delimitation: the system does not detect dents, bends or
     warping.
10. **Scope, YOLO bullet:** the listed defect groups ("uneven finishes, structural misalignment and incomplete 3D
    Reconstruction") are not what the models detect. Use the real defect classes in Part A.
11. **Scope, 3D Modeling bullet:** it says inspectors measure dimensions directly on the 3D model. That is not true.
    - Nothing is measured. The 3D model is not to scale; the "Dimensions" lines show the ordered size from the
      customer's order, for comparison by eye.
    - Rewrite it as two bullets: 3D Model of the whole piece (step 2, with the ordered size shown), and defects shown
      on the 3D model in edit mode and as pins (step 3, positions approximate).
    - Add two more Scope bullets: staff assignment (Order Management and Team), and the automatic Audit Logs.
12. **Delimitation "Limited for internal use … accessible only to Staff/Worker, Supervisors/Administrators":** this
    contradicts the customer portal and shop. Customers also use the system, but only for their own orders.
13. **Delimitation "does not include any predictive analytics, and AI forecasting":** the system estimates completion
    dates with PERT. Reword to say it uses a statistical estimate (PERT), not machine-learning forecasting. Avoid the
    word "AI".
14. **Delimitation "rendering a detailed model can take 20–30 minutes":** wrong. The 3D Model takes about 1 minute.
    Also mention that the free online 3D service has a daily limit of a few models, with the local GPU fallback.
15. **"Order Progress Portal … by entering a unique Reference ID":** customers log in to their account and see their
    orders with their reference numbers. Fix it here, in Project Description, and later in the Context Diagram and the
    DFD.
16. **"first-time pass rates":** the dashboards show the inspection pass rate and the defect rate (failed ÷ inspected).
    Use those terms, or define "first-time pass rate" the way the system computes it.
17. **"digital checklists":** these appear in Specific Objectives, Delimitation, the IPQC definition and Section 4.2,
    but there is no checklist screen. Either remove them, or describe the real gates (saved scan before Results,
    passed scan before Delivery). Do not claim a feature that is not there.
18. **Definitions to add:** 3D model (mesh), image-to-3D, edit mode (surface grid), PERT, Weighted Moving Average
    (WMA), Finite State Machine (FSM), audit log, Intersection over Union (IoU), Precision / Recall / F1-score. If the
    draft already defines SfM, point cloud, RANSAC, point-to-plane distance or PnP, remove those definitions.
19. **Definition of Machine Learning ("A field of artificial intelligence …"):** reword without "artificial
    intelligence".
20. **Definition of Defect:** includes "wrong colors". The system does not detect colour errors. Remove it, or say
    those are checked by hand.
21. **Specific Objectives:** make them match the four modules, plus staff assignment and audit logging. Add completion
    estimates (PERT). Remove any objective about measuring dimensions or detecting dents. Replace "with a high degree
    of accuracy" with something measurable, e.g. "evaluated by Precision, Recall and F1-score at IoU 0.50".

### Chapter 2
22. **Heading typo:** "2.1 Related Literature (Foreign and Local" is missing the closing ")".
23. **Section 2.2 sub-headings:** they say "FOREIGN LITERATURE" and "LOCAL LITERATURE". They should say "FOREIGN
    STUDIES" and "LOCAL STUDIES".
24. **Zhang et al. (2017)** is under Local Studies but is not a Philippine study. Move it to Foreign Studies.
25. **Sources named by publisher instead of author:** "ResearchGate (2017)", "MDPI Open Access (2024)", "MDPI Applied
    Sciences, 2026", "eJournals Philippines (2021)", "Philippine Engineering Journal (2020)". Cite the actual authors
    and titles.
26. **Check that every citation is real**, and keep its link or DOI for the References list. This matters most for
    the 2025–2026 sources: Patrashko & Gurau, Acebo et al., Kowalczyk et al., Castilla et al., Mia & Jimenez et al.,
    Fhrizz et al., Prima et al., Kim et al.
27. **Weak or off-topic sources:**
    - Company blogs (Deskera, Vidi Corp, Breeze, Sprout Solutions, Focus Softnet, BatchMaster, Cebu Office Furniture
      Den, Fortune Business Insights) are weak academic sources. Replace them with journal or government sources
      where possible.
    - The Breeze paragraph (time management) and the Sprout paragraph (payroll, DOLE, overtime pay) are off-topic:
      the system has no payroll. Remove them or tie them to automatic stage timing.
28. **Six Sigma paragraph** has no citation.
29. **Redmon et al. (2016)** is the first YOLO. The system uses **YOLOv12**: add Tian, Ye & Doermann (2025), "YOLOv12:
    Attention-Centric Real-Time Object Detectors".
30. **Add the foundational sources for the algorithms we use:**
    - Xiang et al. (2024), "Structured 3D Latents for Scalable and Versatile 3D Generation": TRELLIS.
    - Tencent Hunyuan3D Team (2025), "Hunyuan3D 2.0: Scaling Diffusion Models for High Resolution Textured 3D Assets
      Generation": Hunyuan3D-2.
    - Malcolm et al. (1959): PERT.
    If the draft cites RANSAC, SIFT, Structure from Motion or PnP sources for our own system, remove those parts (the
    sources can stay only as related literature).
31. **"In this study, YOLO will be used to … determine the size of furniture items":** wrong. Nothing is measured;
    the size shown is the ordered size from the customer's order.
32. **Leftover find-and-replace words:** some sentences were broken when stage names were changed, e.g. Sioma (2015)
    "flag out-of-spec lumber **prior to 3D Reconstruction**", and Section 2.3 "**content management** systems". Read
    Chapter 2 again for these.

### Chapter 3
33. **Section 3.1:** too general. Name the real technologies (Part A).
34. **Section 3.2:** two more broken find-and-replace phrases:
    - "manual checks of furniture parts in each of the following **3D reconstruction phases**";
    - "bends **before 3D reconstruction**".
    These describe MVCA's current manual process. Use their real production steps (e.g. cutting, assembly, sanding,
    finishing) and "before delivery".
35. **3.3.1 Hardware:**
    - Camera: there is no mounted 1080p industrial camera streaming to a local unit. It is the phone or laptop camera
      through the browser.
    - GPU: YOLO runs on the normal processor. The NVIDIA GPU (4 GB or more) is only needed for the optional local 3D
      model server. Fix the GPU row.
    - The printed marker is no longer used. Remove it if it is listed.
    - Do not name a specific GPU model; state the minimum requirement instead.
36. **3.3.2 Software:**
    - There is no Laravel and no separate mobile app. Backend & API = Next.js (website) + Supabase (database, logins,
      order rules) + Python FastAPI detection server.
    - "PyTorch or TensorFlow" → PyTorch (through Ultralytics).
    - Add the 3D tools: TRELLIS and Hunyuan3D-2 (3D model), model-viewer and three.js (3D viewer and edit mode).
    - Add hosting: Vercel (website) and Tailscale Funnel (https tunnel to the detection server).
    - Image Storage: the scan photo is saved with the scan record in Supabase.
37. **3.3.3 Network:** "To maintain the Tailwind CSS Framework app connected": Tailwind is only a styling library.
    Write "the web app". Describe the real setup: the website on Vercel, the database on Supabase, and the detection
    server on the laptop reached through the Tailscale Funnel https tunnel.

### Chapter 4
38. **SDLC mismatch:** 4.1 says the **Agile** model, but the figure and the paragraph below describe **Waterfall**.
    Pick one and make the text, the figure and its caption match.
39. **Figure captions:** they end with "(author". Close the parenthesis, or write "(Proponents, 2026)".
40. **4.2 Functional Requirements:**
    - "Digital Inspection Checklists": see item 17.
    - Add the implemented features that are missing:
      - Shop and checkout;
      - Inquiry/messaging;
      - Notifications;
      - Inventory;
      - Rework Queue with automatic rework tasks;
      - Scan all sides, and the defects-by-side grid in Results;
      - 3D Model viewer with the ordered size;
      - Defects on the 3D model (edit mode and pins);
      - Staff assignment (Order Management, Team, Assigned Tasks);
      - PERT completion estimate;
      - Reports with CSV export;
      - Automatic Audit Logs.
41. **4.3.1 Context Diagram:**
    - Customer sends "Login Credentials **or Reference ID**": only login (item 15).
    - Customer receives "approved final-inspection photos": not connected yet.
    - Admin sends "Tolerance Rule Updates": there are no tolerance rules. Replace with "Staff Assignment".
    Update the diagram and its paragraph.
42. **4.3.2 Use Case Diagram:**
    - Customers are described as having "read-only access", but they shop, order and send inquiries.
    - "Manage Product Rules" should be "Manage Product Catalog".
    - Add for staff: View Assigned Tasks, Build 3D Model, View Defects on the 3D Model.
    - Add for admin: Assign Staff, Rework Queue, Inventory, Audit Logs.
43. **4.3.3 DFD:**
    - The text says D5 = Production Logs and D6 = Rework Logs; the diagram shows D6 Production Logs and D5 Rework
      Logs. Make them match.
    - Remove "Reference ID" (item 15).
44. **4.3.4 ERD:** it does not match the real database. It has `int` keys, a USERS table with a password, ROLES,
    DEFECT_IMAGES with a **firebase_url**, ANNOTATED_IMAGES, DETECTION_RESULTS, FURNITURE_DIMENSIONS, MODEL_PREDICTIONS
    and TIME_LOGS. Redraw it from the real tables:
    - **Real tables:** user_profiles, orders, products, product_items, cart_items, production_stages, time_tracking,
      order_stage_history, order_status_transitions, stage_time_defaults, detection_logs, defects, rework_logs,
      measurements, inspection_images, qa_checklists, notifications, messages, inquiries, inquiry_messages, inventory,
      audit_logs, otp_codes.
    - **Keys:** all primary keys are `uuid`. Logins are handled by Supabase Auth; passwords are not stored in our
      tables.
    - **orders** now also has `assigned_to` (uuid, FK to user_profiles: the assigned staff member) and `assigned_at`
      (timestamptz). Draw the relationship user_profiles 1 → many orders (assigned).
    - **measurements** is left from the removed Measure Dimensions tool; no screen uses it now. Mark it "not used", or
      remove it.
45. **4.3.5 Data Dictionary:**
    - **Primary key names:** the real database calls every primary key `id` (not `audit_id`, `products_id`,
      `user_profiles_id` and so on). Either use the real names, or say the dictionary renames them for readability.
    - **Table 5 and Table 7** are both USER_PROFILES. Remove one and renumber.
    - **Table 11 "PRODUCT_ITEMS"** actually contains the order_stage_history columns. The real product_items is
      Table 16. Remove Table 11.
    - **Tables 19 and 20 are swapped:** the table titled "Inquiries_Messages" holds the INQUIRIES columns, and the other
      way round.
    - **Tables 25 and 27** are headed "INVENTORY". Table 25 is really **stage_time_defaults** (the PERT starting
      estimates). Table 27 is **order_status_transitions** (from_status, to_status, gate). Table 26 is missing from the
      numbering.
    - **Column names and types to correct:**
      - "optimistics_hours" → **optimistic_hours**.
      - "inspectore_id" → **inspector_id**.
      - DETECTION_LOGS "overall_results / qa_results" → **overall_result / qa_result**.
      - "Timestamptz" → **timestamptz**.
      - Table 12 title "Detection-Logs" → **Detection_Logs**.
      - The DEFECTS table is missing its PK/FK marks.
    - **products.ar_model_support:** AR was removed. Remove the column from the dictionary, or mark it "not used".
    - **qa_checklists:** no screen uses it (item 17). Mark it "reserved", or remove it.
    - **ORDERS:** add `assigned_to` and `assigned_at` (item 44).
    - **AUDIT_LOGS:** columns user_id, action, entity_type, entity_id, old_values (jsonb), new_values (jsonb),
      ip_address, user_agent, created_at. Describe it as filled automatically (Part A).
46. **4.4 to 4.5:** delete all the "TEMPLATE: what to include" blocks. Replace these sections with our filled-in
    draft (THESIS_4.4-4.5_TESTING.md): real unit, integration and system test cases and results. Fill in the [TO
    FILL] parts.
47. **Table titles "… of LibraTrack":** a template leftover. Change to "… of MFQATS". The unit test table title "Unit
    Test Cases of ()" is also unfinished.
48. **Table numbering:** the data dictionary uses Table 1 to 27; Chapter 4 uses Table 4.1 to 4.8. Use one scheme for
    the whole paper (e.g. Table 4.1, 4.2 …).
49. **Rating scale:** the template text says a "5-point scale", but Table 4.7 is a 4-point scale. Make the text say
    4-point.
50. **Statistical treatment** says a reliable defect needs "IoU of 0.50 or higher **and a confidence score of 80% or
    more**". The system uses a confidence threshold of 0.30, chosen because it gave the best F1-score (0.633). Keep IoU
    ≥ 0.50 for the evaluation and explain the 0.30 threshold, or explain why the paper uses a different value.
51. **Table 4.6 Respondents:** fill in the percentages (40%, 40%, 20%).
52. **Weighted mean formula:** the symbol for N shows as a broken character "□". Retype it.

### Chapter 5 and 6
53. **Chapters 5 and 6 are empty.** They need:
    - **5.1:** screenshots of the system, one per main page per role;
    - **5.2:** the real survey results (weighted mean and verbal interpretation per ISO/IEC 25010 characteristic);
    - **5.3:** discussion;
    - **6.1 to 6.3:** summary, conclusions, recommendations.
    Possible recommendations, taken from the system's real limits: real MVCA product photos for the shop; connect
    the customer Photo Gallery to the inspection photos; save 3D models with the order; a larger defect dataset;
    detecting dents and warping (for example with a to-scale 3D scan); measuring the real size of the piece and
    comparing it with the ordered size.
54. **5.2 heading typo:** "ISO/**EIC** 25010" → "ISO/**IEC** 25010".
55. **Chapter 6 heading:** add "CHAPTER 6" above "CONCLUSIONS AND RECOMMENDATIONS".

### Whole paper
56. Use one name for each thing everywhere:
    - "MFQATS" (not "Web-Based Quality Assurance and Time Tracking for MVCA Furniture", used in the use case caption);
    - "Admin/Supervisor", "Staff/Worker", "Customer";
    - "Quality Scan".
57. Remove every mention of AR / augmented reality.
58. Currency is Philippine peso (₱) everywhere.
