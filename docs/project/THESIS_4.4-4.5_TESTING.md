# Draft for the paper: 4.4 Software Testing Plan and 4.5 User Acceptance Testing

Copy these sections into the paper. Every result marked **Pass** was really run, on the date shown.
Text in **[brackets]** is for the team to fill in, because only you know it (names, phones used, survey answers).
Re-run a test before the defense if the code changes; how to run each one is in the last section.

---

## 4.4 Software Testing Plan

**Purpose.** The system was tested to prove that it does what Section 4.2 requires. The tests check that:
- every module gives correct results (defect detection, 3D model requests, stage rules, delivery estimate);
- the modules work together;
- the complete system is secure, fast enough and usable on computers and phones.

**Testing approach.** Testing was done at three levels:
- **Unit testing** checked each algorithm and rule by itself, using inputs whose correct answer is known in advance.
- **Integration testing** checked that the website, the database and the detection server pass data to each other
  correctly.
- **System testing** checked the complete system against the requirements: functional, security, performance,
  compatibility and reliability tests.

**Test environment.** See Table 4.2.

**Testers and schedule.** See Table 4.1. The proponents ran the unit, integration and system tests during development
(September to October 2026). The user acceptance test was done by **[admin, staff and customer respondents, students
and IT professionals]** on **[dates]**.

**Test case format.** Each test case has an ID, the module tested, a description, the test data, the expected result,
the actual result and a status (Pass or Fail).

**Pass/fail criteria.**
- A test case passes when the actual result matches the expected result.
- A level of testing is complete when all of its test cases pass.

**Defect handling.** When a test failed, the cause was found and fixed in the code, and the test was run again until it
passed. Fixes were recorded in the project's version history (Git). Examples of defects found and fixed during system
testing are listed after Table 4.5.

**Table 4.1. Levels of Testing**

| Level | What Was Tested | Tested by | Schedule |
|---|---|---|---|
| Unit Testing | Each algorithm and rule by itself: YOLOv12 result handling, 3D model requests, stage rules (FSM), PERT and WMA | Proponents | September 26 to October 30, 2026 |
| Integration Testing | Website with database, website with detection server, saved scans with automatic rework and alerts, staff assignment, audit logs | Proponents | October 2026 |
| System Testing | The complete system: all pages for the three roles, role security, page speed, phone layout, reliability | Proponents | October 28 to 30, 2026 |

**Table 4.2. Test Environment**

| Item | Specification |
|---|---|
| Hardware | Laptop with Intel Core processor, 16 GB RAM and NVIDIA GPU (development and server computer); **[phone models used]** for camera and phone tests |
| Operating System (OS) | Windows 11 Pro; **[Android/iOS versions of the phones]** |
| Server Software | Next.js 15.5.28 on Node.js 24; Python 3.14 with FastAPI, Ultralytics YOLOv12 and OpenCV; Supabase (PostgreSQL database and logins) |
| Hosting | Website published on Vercel; detection server on the laptop, reached through Tailscale Funnel (https) |
| Browsers | Microsoft Edge (desktop); **[phone browsers used, e.g. Chrome on Android]** |
| Testing Tools | Python self-check scripts (assert-based unit tests); SQL self-test scripts run in the Supabase SQL Editor; Playwright browser automation (scripted page tests); TypeScript compiler and Next.js production build |

### 4.4.1 Unit Testing

Unit testing checks the smallest parts of the system one at a time. The technique was **white-box testing**: each
test feeds an algorithm an input whose correct answer is known, then checks the output.

For the detection server, the test inputs are **prepared test data with a known true answer**. Examples:
- a 2000 × 1500 px photo with a 15 px scratch placed at a known spot;
- a simulated "daily quota used up" answer from the online 3D service.

For the database rules, the test scripts create a test order, move it through the stages, check every answer and then
undo everything. The tests cover:
- **valid input:** normal photos, detections and stage moves;
- **invalid input:** missing photos, wrong file types, unknown defect types, illegal stage moves;
- **boundary values:** overlapping boxes from the two models, a defect too small for a whole-photo pass.

**Table 4.3. Unit Test Cases of MFQATS**

| ID | Function/Module | Test Description | Test Data/Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| UT-01 | Defect detection result (YOLOv12) | A photo with no defects | Empty detection list | Result "pass", 0 defects, average confidence 0 | As expected | Pass |
| UT-02 | Defect detection result | Natural wood feature only | One live knot at 85.3% confidence | Result "pass", severity low (natural features do not fail a piece) | As expected | Pass |
| UT-03 | Defect detection result | Several defects, including an unknown type | 3 detections, one with an unknown class name | Result "fail", 3 defects, average confidence 70.0%, unknown type gets medium severity and "inspect manually" advice | As expected | Pass |
| UT-04 | Merging the two YOLO models | The same defect found by both models | Overlapping boxes from both models; boxes far apart | Overlapping boxes merged into one defect; far-apart boxes kept separate | As expected | Pass |
| UT-05 | Tiled detection | A very small scratch on a large photo | 2000 × 1500 px photo with a 15 px scratch and a large defect | Whole-photo pass misses the scratch; tiles find it at the right position; the large defect is not split | As expected | Pass |
| UT-06 | 3D Model requests | Invalid requests | Wrong number of photo slots; no photos; no front photo; web link instead of a photo; unknown job | Refused (errors 400, 422 and 404) | As expected | Pass |
| UT-07 | 3D Model fallback | Free online service unavailable | Simulated "daily quota used up" from the online service | Falls back to the local 3D server; colours fail → shape only, with a note to the user | As expected | Pass |
| UT-08 | Stage rules (FSM) | Skipping a stage | Order moved from Pending straight to Upload | Blocked by the database | **[run fsm_check.sql]** | **[ ]** |
| UT-09 | Stage rules (FSM) | Normal forward moves | Pending → Confirmed → Upload → 3D Reconstruction → Detect Defects | Allowed, one step at a time | **[ ]** | **[ ]** |
| UT-10 | Stage rules (FSM) | Moving to Results without a scan | Order in Detect Defects, no scan saved | Blocked | **[ ]** | **[ ]** |
| UT-11 | Stage rules (FSM) | Delivering a failed piece | Failed scan, then Results → Recommendation → Delivered | Delivery blocked | **[ ]** | **[ ]** |
| UT-12 | Stage rules (FSM) | Re-inspection | Order sent back to Upload | A new scan is required again | **[ ]** | **[ ]** |
| UT-13 | Stage rules (FSM) | Passed piece; final status | Passing scan → Delivered; then any move | Delivered allowed; nothing allowed after Delivered | **[ ]** | **[ ]** |
| UT-14 | Automatic time tracking | Stage move timestamps | Any stage move | Old stage closed and new stage opened with the time, automatically | **[run pert_wma_check.sql]** | **[ ]** |
| UT-15 | PERT estimate | Expected stage time | Three past Results stages of 4 h, 6 h and 8 h | O = 4, M = 6, P = 8; Te = (4 + 4×6 + 8) / 6 = 6 h | **[ ]** | **[ ]** |
| UT-16 | WMA current pace | Weighted average of the same stages | Same 4 h, 6 h, 8 h (newest weighted most) | (5×8 + 4×6 + 3×4) / 12 = 6.33 h | **[ ]** | **[ ]** |
| UT-17 | Delivery estimate and completion % | Estimated completion date; % per stage | Order at Upload | ETA = now + sum of the remaining stages' Te; completion % rises with each stage | **[ ]** | **[ ]** |

**Summary.**
- **UT-01 to UT-07:** 7 test cases on the detection server. All 7 passed when last run on October 30, 2026.
- **UT-08 to UT-17:** these test the database rules. Fill them in after running `fsm_check.sql` and
  `pert_wma_check.sql`: each line of the report must start with PASS.

**[Add here any test that failed during development and what was fixed. Example: the defect rate was computed as
defects ÷ orders and could go above 100%; it was corrected to failed inspections ÷ inspections.]**

### 4.4.2 Integration Testing

Integration testing checks that modules which passed unit testing work correctly together and pass data correctly.
The approach was **incremental**: each module was connected and tested as it was finished, in this order:
1. website and database;
2. detection server;
3. 3D model;
4. automatic follow-ups (rework, alerts, staff assignment, audit logs).

**Table 4.4. Integration Test Cases of MFQATS**

| ID | Modules Integrated | Test Case Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| IT-01 | Login + Database (role) | Admin, staff and customer each log in | Each is taken to their own dashboard | As expected (October 28 and 29, 2026) | Pass |
| IT-02 | Shop + Orders + Notifications | Customer adds furniture to the cart and places an order | Order saved as Pending; customer gets a notification | **[ ]** | **[ ]** |
| IT-03 | Order Management + Stage rules + Notifications | Admin approves the order (Pending → Confirmed) | Status changes; customer notified; time recorded | **[ ]** | **[ ]** |
| IT-04 | Quality Scan + Detection server (YOLOv12) | Staff scans a photo of a defect | Boxes, confidence, severity and repair advice shown | **[ ]** | **[ ]** |
| IT-05 | Quality Scan + Database + Rework Queue | Staff saves a failing scan | Scan saved with the order; rework task created with the fixes; admins alerted | **[ ]** | **[ ]** |
| IT-06 | Quality Scan + Stage rules | Staff moves the order to Results after saving a scan | Move allowed only after a scan was saved | **[ ]** | **[ ]** |
| IT-07 | Order Management + Team + Assigned Tasks + Notifications | Admin approves an order and assigns a staff member | Available staff listed first; the same assignment shown in Order Management and Team; the staff member is notified and sees the order in Assigned Tasks | **[ ]** | **[ ]** |
| IT-08 | Website + Database + Audit Logs | A staff member signs in and moves an order to the next stage | "Signed in", "Opened the system" and "Stage update" entries appear in Audit Logs within 10 seconds, with who did it | **[ ]** | **[ ]** |
| IT-09 | 3D Model + online 3D service + Orders | Staff builds a 3D model from the inspection photos and turns on Dimensions | Coloured 3D model shown and downloadable; the ordered length, width and height drawn on it | **[ ]** | **[ ]** |
| IT-10 | Quality Scan (all sides) + 3D Model | Staff adds close-ups and presses "Scan all sides" in Detect Defects | Every side scanned, from its close-up if it has one; the defects shown on the 3D model in edit mode (painted grid) and as pins; Results shows one tile per side | **[ ]** | **[ ]** |
| IT-11 | Stage history + PERT + OrderView | Customer opens OrderView for an order in progress | Stage timeline and estimated completion date shown | **[ ]** | **[ ]** |
| IT-12 | Saved scans + Dashboards | Admin opens Admin Overview and Defect Analytics | Defect rate and defect charts include the new scan | **[ ]** | **[ ]** |
| IT-13 | Quality Scan + Storage + OrderView | Staff adds photos and builds a 3D model while the customer has OrderView open | Photos appear in Photo Gallery, the model in 3D Preview and the stage moves on, within about 10 seconds; another customer cannot open them | **[ ]** | **[ ]** |

**Summary. [Fill in after running IT-02 to IT-13, for example with the demo accounts, following
docs/setup/DEVICE_TESTING.md. Record any defect found and how it was fixed.]**

### 4.4.3 System Testing

System testing checks the complete, integrated system against the requirements in Section 4.2.

**Table 4.5. System Test Cases of MFQATS**

| ID | Test Type | Test Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| ST-01 | Functional | Open every page of the three roles (14 admin, 7 staff, 6 customer) plus the landing and login pages | Every page loads with no error, no crash and no failed request | All pages loaded with no errors (October 28, 2026) | Pass |
| ST-02 | Security | Open admin, staff and customer pages while logged out | Sent to the login page | All 3 sent to login | Pass |
| ST-03 | Security | Log in with a wrong password | Login refused | Stayed on the login page | Pass |
| ST-04 | Security (role-based access) | Customer opens admin, staff and catalog pages | Refused, sent back to the customer dashboard | All 3 refused | Pass |
| ST-05 | Security (role-based access) | Staff opens admin pages and the customer shop | Refused, sent back to the staff dashboard | All 3 refused | Pass |
| ST-06 | Security (role-based access) | Admin opens staff Quality Scan and the customer shop | Refused, sent back to the admin dashboard | Both refused | Pass |
| ST-07 | Security | Stage rules enforced by the database, not only the screens | Illegal stage moves refused even outside the website | See UT-08 to UT-13 | **[ ]** |
| ST-08 | Performance | Load 9 main pages, 3 times each (production build) | Each page loads in 3 seconds or less | Slowest 0.58 s; most pages 0.2 to 0.4 s | Pass |
| ST-09 | Performance | Detection on one photo | Result in **[target, e.g. 5 s or less]** | **[measure]** | **[ ]** |
| ST-10 | Compatibility | 8 main pages at phone width (390 px) | Page fits the screen, no sideways scrolling | All 8 fit | Pass |
| ST-11 | Compatibility | Use the system on real phones through the https tunnel, including the camera | Pages usable; camera opens for live scan and photos | **[phones used]** | **[ ]** |
| ST-12 | Reliability | Free online 3D service unavailable | System falls back to the local 3D server and tells the user | Falls back as expected (see UT-07) | Pass |
| ST-13 | Reliability | Production build of the complete system | Builds with no errors | Built with no errors (October 30, 2026) | Pass |

ST-08 page load times, production build, one user, server and browser on the same laptop (October 29, 2026):

| Page | Load times (3 runs) |
|---|---|
| Landing | 0.16 s, 0.11 s, 0.15 s |
| Admin Overview | 0.58 s, 0.22 s, 0.32 s |
| Order Management | 0.36 s, 0.26 s, 0.41 s |
| Reports | 0.24 s, 0.27 s, 0.44 s |
| Inspection Progress | 0.24 s, 0.30 s, 0.23 s |
| Staff Workshop | 0.26 s, 0.26 s, 0.41 s |
| Quality Scan | 0.27 s, 0.22 s, 0.27 s |
| Customer Overview | 0.26 s, 0.28 s, 0.25 s |
| Shop Products | 0.24 s, 0.27 s, 0.33 s |

These were measured with one user on the same computer as the server. Times over Wi-Fi or the internet, or with many
users at once, will be higher. **[Optional: repeat ST-08 from a phone on the workshop Wi-Fi.]**

**Summary.**
- **10 of the 13 system test cases passed;** ST-07, ST-09 and ST-11 are still to be filled in.
- Defects found during system testing and fixed:
  - pop-up windows left a light strip at the top of the screen;
  - the top bar's menus showed the page behind them unblurred;
  - the password reset link opened the home page instead of the new-password form.

**[Add any others the team found.]**

---

## 4.5 User Acceptance Testing (UAT) and Evaluation

**Purpose.**
- User acceptance testing lets the real users try the system and confirm that it meets their needs.
- The evaluation measures software quality using the **ISO/IEC 25010** standard. It covers eight quality
  characteristics: Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security,
  Maintainability and Portability.

**Respondents.** The respondents were chosen by **purposive sampling**: people who will use the system, plus people
able to judge its technical quality.

**Table 4.6. Respondents of the Study**

| Group | Number of Respondents | Percentage |
|---|---|---|
| MVCA Furniture admin, staff and customers | 20 | 40% |
| Students | 20 | 40% |
| IT professionals | 10 | 20% |
| **Total** | **50** | **100%** |

**Instrument.**
- The questionnaire has statements under each of the eight ISO/IEC 25010 characteristics, rated on a 4-point scale.
- It was checked by **[the adviser / an IT expert]** before use.
- The full questionnaire is in Appendix C.

**Table 4.7. Rating Scale and Verbal Interpretation**

| Scale | Mean Range | Verbal Interpretation |
|---|---|---|
| 4 | 3.51 – 4.00 | Strongly Agree |
| 3 | 2.51 – 3.50 | Agree |
| 2 | 1.51 – 2.50 | Disagree |
| 1 | 1.00 – 1.50 | Strongly Disagree |

**Procedure. [Describe what actually happened.]** Suggested wording:
1. The proponents gave each respondent a short demonstration of the system.
2. Each respondent then used the system with an account for their role. MVCA staff and admins did a quality scan of a
   furniture piece and followed an order through the stages; customers placed and tracked an order; students and IT
   professionals tried all three roles with the demo accounts.
3. Respondents answered the questionnaire right after using the system, on **[date(s)]**, at **[place]**.

**Statistical treatment.**
- **Weighted mean and standard deviation (survey).** The weighted mean of each quality characteristic shows the
  overall rating. The standard deviation shows how much the respondents agreed:
  - 0.00 to 0.50: very high consensus;
  - 1.51 and above: low consensus.
- **YOLOv12 detection model.** The model is evaluated with **Precision, Recall and F1-score** on a test set it was not
  trained on. A detection counts as correct when its box overlaps the true box with an **Intersection over Union (IoU)
  of 0.50 or more**.
- **Confidence threshold.** The threshold was chosen from a test of thresholds from low to high. For the wood20k model,
  the highest F1-score (0.633) was at a confidence of 0.30, so the system uses 0.30.

**[Check this against the "confidence score of 80% or more" written in the current draft. The system uses 0.30 because
it gave the best F1-score. Pick one and make the paper match.]**

Weighted mean formula: x̄w = Σ(f · x) / N, where:
- f is the frequency of each response;
- x is the weight of the response;
- N is the total number of respondents.

**Table 4.8. UAT Sign-off Form**

| Item | Details |
|---|---|
| System Name | MFQATS: MVCA Furniture Quality Assurance and Tracking System |
| Test Period | **[Start date]** to **[End date]** |
| Result of UAT | The system meets the users' requirements and is accepted for use. |
| Accepted by | **[Name]**, MVCA Furniture **[position]** Signature: __________ Date: __________ |
| Prepared by | Diaz, Roland Federic D.; Dugenio, Brian James A.; Mangaring, Joyce Lyn E.; Rubia, Sean Michael R.; Sy, Keith Wednesday M. |

The mean scores and their discussion go in Chapter 5, Sections 5.2 and 5.3.

---

## How to re-run each test

| Tests | How |
|---|---|
| UT-01 to UT-07 | `cd src/api` then `..\..\.venv\Scripts\python.exe test_yolo_server.py` (prints `ok`) |
| UT-08 to UT-13 | Paste `supabase/checks/fsm_check.sql` into Supabase SQL Editor → Run. The red error box is on purpose: it undoes the test order. Every line must start with PASS. |
| UT-14 to UT-17 | Same with `supabase/checks/pert_wma_check.sql` |
| ST-01 to ST-08, ST-10 | Browser test scripts (Playwright), run by the proponents against the production build |
| ST-13 | `npx next build` |
