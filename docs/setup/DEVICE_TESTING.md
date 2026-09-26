# Device Testing Checklist: YOLO Quality Scan

Follow this **every time** you test the AI Quality Scan, on a laptop, Android phone, iPhone or tablet.
Do the steps **in order**; most problems come from skipping a step or doing them out of order.

> First time on this computer? Do the one-time setup in [YOLO_SERVER_SETUP.md](YOLO_SERVER_SETUP.md) first
> (Node, Python, `.venv`, `.env`, and the `.pt` model files in `src/api/weights/`).

---

## How the pieces connect

```
Laptop / phone browser
        │  https://….trycloudflare.com   (phones)   or   http://localhost:4028   (the laptop itself)
        ▼
Terminal 3: Cloudflare tunnel  (phones/tablets only)
        ▼
Terminal 2: Website (Next.js, port 4028) ──/staff/yolo──▶ Terminal 1: AI server (Python, port 8000, all models)
```

- The **laptop runs everything**. Phones only open a link; nothing gets installed on them.
- If **any** of the three terminals stops, or the laptop sleeps, the flow breaks.

---

## Step 0: Before you start (every session)

- [ ] Laptop **plugged in**.
- [ ] Laptop **won't sleep**: Windows Settings → System → Power → *Screen and sleep* → "When plugged in, put my device to sleep after" = **Never**.
- [ ] Any new model is in `src/api/weights/` **and** listed in `src/api/weights/models.json`.
- [ ] Code is up to date: `git checkout main` then `git pull` (if teammates changed something).

## Step 1: Start the three terminals (in this order)

In VS Code, open the project folder, then **Terminal → New Terminal**. Use **+** for each extra terminal.

**Terminal 1: AI server**
```powershell
.venv\Scripts\activate
uvicorn src.api.yolo_server:app --reload --port 8000
```
✅ Wait for one `loaded ...` line **per model**, then `Application startup complete`.

**Terminal 2: Website**
```powershell
npm run dev
```
✅ Wait for `Ready`.

**Terminal 3: Tunnel** (only when testing phones/tablets)
```powershell
cloudflared tunnel --url http://localhost:4028
```
✅ Copy the `https://….trycloudflare.com` link it prints. **It is new every time you start the tunnel.**

## Step 2: Quick health check (laptop)

- [ ] Open **http://localhost:8000/health**: every model is listed with its `conf` and `classes`.
- [ ] Open **http://localhost:4028**: log in as a **staff** account.
- [ ] Go to **Quality Scan (AI)**: the page loads with **no** yellow "AI detection server is offline" alert.

If any of these fail, stop and fix it first (see *If something breaks* below). Testing phones won't work either.

---

## Step 3: Test each device

Record results in the log at the bottom (useful as evidence for the paper's Table 16).

### A. Laptop (Chrome or Edge)

Open **http://localhost:4028**. The laptop can use `localhost`, so no tunnel is needed.

| # | Test | Expected result |
|---|---|---|
| A1 | **Upload Image** → pick a wood photo | Red boxes with labels (e.g. `Dead Knot (52.7%)`), PASS/FAIL badge, defect list with severity + recommendation |
| A2 | **Live Camera → Start Camera** | Browser asks for camera permission → **Allow** → webcam video appears |
| A3 | **Start Scan** | "SCANNING..." overlay, boxes update about once per second |
| A4 | **Capture & Analyze** | Frame freezes, full result appears |
| A5 | Type **Inspection Notes** → **Save Detection** | "Detection saved successfully"; entry appears in **Detection History** |
| A6 | **Clear & Retry** | Image, boxes and notes clear; live scanning resumes |
| A7 | Stop Terminal 1 (Ctrl+C) → **Upload Image** | Yellow "AI detection server is offline" alert. Then **restart Terminal 1** before continuing. |

### B. Android phone (Chrome)

Open the **`https://….trycloudflare.com`** link from Terminal 3.

| # | Test | Expected result |
|---|---|---|
| B1 | Log in as staff → **Quality Scan (AI)** | Page loads, no offline alert |
| B2 | **Upload Image** → *Camera* or *Files* | Same result as A1 |
| B3 | **Live Camera → Start Camera** | Permission prompt → **Allow** → **back camera** video |
| B4 | **Start Scan**, point at wood from 15–30 cm | Boxes appear and update about once per second |
| B5 | **Capture & Analyze** → **Save Detection** | Result + "Detection saved successfully" |

### C. iPhone / iPad (Safari, or Chrome on iOS)

Open the **same `https://` link**.

| # | Test | Expected result |
|---|---|---|
| C1 | Log in as staff → **Quality Scan (AI)** | Page loads, no offline alert |
| C2 | **Upload Image** → *Take Photo* or *Photo Library* | Same result as A1 |
| C3 | **Live Camera → Start Camera** | Permission prompt → **Allow** → back camera video (plays inside the page, not full screen) |
| C4 | **Start Scan** → **Capture & Analyze** → **Save Detection** | Same results as B4–B5 |

> iPhones may ask for camera permission **every visit**. That's normal. To stop it: Settings → Safari → Camera → *Allow*.

### D. Android tablet

Same steps as **B**, using the same `https://` link.

---

## Rules that keep the flow from breaking

| Rule | Why |
|---|---|
| **Phones always use the `https://` tunnel link**, never `http://192.168…` | Phones only allow the camera on `https://` pages. On `http` the permission prompt never appears. |
| **New tunnel link = log in again** on the phone | Each link is a new website address, and logins are stored per address |
| **Keep all three terminals open**, and don't let the laptop sleep | Closing any of them, or sleep, stops the site, the AI or the tunnel |
| **Restart Terminal 1** after changing models or `models.json` | Models are only loaded when the AI server starts |
| **Restart Terminal 2** after changing `next.config.mjs` | That file is only read when the website starts |
| Log in as a **staff** account | The Quality Scan page and the AI server path (`/staff/yolo`) are staff-only |
| Only share the tunnel link with the team, and close Terminal 3 when done | Anyone with the link can reach the login page while it runs |

**Tips for good detections:** good even lighting, no glare on varnish, hold the camera steady and parallel to the
surface, and get close enough that the defect fills a good part of the frame.

---

## If something breaks

| What you see | Cause | Fix |
|---|---|---|
| `cloudflared` **is not recognized** right after installing it | VS Code's terminals still use the old program list | Close **all** VS Code windows and reopen. Or run it by its full path: `& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:4028` |
| **No camera permission prompt** on a phone | Opened with `http://` | Use the `https://….trycloudflare.com` link |
| "Camera needs a secure (https://) link" | Same as above | Same as above |
| "Camera permission was blocked" | You tapped *Block* earlier | Android Chrome: ⋮ → Settings → Site settings → Camera → allow the site. iPhone: Settings → Safari → Camera → Allow. Then reload. |
| "The camera is being used by another app" | Another app/tab holds the camera | Close video calls and other camera apps/tabs, reload |
| Yellow **"AI detection server is offline"** | Terminal 1 stopped or crashed | Restart Terminal 1; check http://localhost:8000/health |
| **"Your session has expired"** | Logged out, or new tunnel link | Log in again |
| Tunnel link shows an **error page / doesn't load** | Terminal 2 or 3 stopped, laptop slept, or the link is from an old tunnel | Check Terminals 2 and 3 are running; use the **current** link |
| Phone page loads but is **very slow** | Weak Wi-Fi/mobile signal (photos go to the laptop and back) | Move closer to Wi-Fi; use **Capture & Analyze** instead of continuous scanning |
| A new model **isn't detecting** anything | Not loaded | Is it in `src/api/weights/` and `models.json`? Restart Terminal 1, then check `/health` |
| Boxes on real MVCA furniture look wrong | Models were trained on public datasets, not MVCA photos | Expected for now; note it in the results (Table 21 domain gap) |

---

## Test log (copy for each session)

**Date:** ______ **Tester:** ______ **Models loaded (`/health`):** ______________________

| Device (model + browser) | Upload | Live camera | Boxes on live feed | Capture & Analyze | Save | Notes |
|---|---|---|---|---|---|---|
| Laptop – Chrome | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |
| Android – ________ | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |
| iPhone – ________ | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |
| Tablet – ________ | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |

These map to the paper's **Table 16 (YOLO Object Detection Module)**: *"marks detected defects on the live camera feed"*
and *"images are captured and processed without system lag."*
