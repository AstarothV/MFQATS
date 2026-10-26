# Device Testing Checklist: YOLO Quality Scan

Follow this **every time** you test the Quality Scan, on a laptop, Android phone, iPhone or tablet.
Do the steps **in order**; most problems come from skipping a step or doing them out of order.

> First time on this computer? Do the one-time setup in [YOLO_SERVER_SETUP.md](YOLO_SERVER_SETUP.md) first
> (Node, Python, `.venv`, `.env`, and the `.pt` model files in `src/api/weights/`).
> Want the **3D Model** to keep working after the free online time runs out? Also do
> [One-time setup: local 3D model server](#one-time-setup-local-3d-model-server) (NVIDIA GPU only).

---

## How the pieces connect

```
Laptop / phone browser
        │  https://….trycloudflare.com   (phones)   or   http://localhost:4028   (the laptop itself)
        ▼
Terminal 3: Cloudflare tunnel  (phones/tablets only)
        ▼
Terminal 2: Website (Next.js, port 4028) ──/staff/yolo──▶ Terminal 1: Detection server (Python, port 8000, all models)
                                                                  │  3D Model only
                                                                  ├──▶ Hugging Face (online, free daily limit)  ← tried first
                                                                  └──▶ Terminal 4: Local 3D model server (port 8001, NVIDIA GPU)  ← when online fails
```

- The **laptop runs everything**. Phones only open a link; nothing gets installed on them.
- If **any** of Terminals 1 to 3 stops, or the laptop sleeps, the flow breaks.
- **Terminal 4 is optional.** Without it, everything works except that the 3D Model stops once the free online time
  (about 15 to 18 models a day) is used up.

---

## Step 0: Before you start (every session)

- [ ] Laptop **plugged in**.
- [ ] Laptop **won't sleep**: Windows Settings → System → Power → *Screen and sleep* → "When plugged in, put my device to sleep after" = **Never**.
- [ ] Any new model is in `src/api/weights/` **and** listed in `src/api/weights/models.json`.
- [ ] Code is up to date: `git checkout main` then `git pull` (if teammates changed something).

## Step 1: Start the terminals (in this order)

In VS Code, open the project folder, then **Terminal → New Terminal**. Use **+** for each extra terminal.

**Terminal 1: Detection server**
```powershell
.venv\Scripts\activate
uvicorn src.api.yolo_server:app --reload --port 8000 --env-file .env
```
✅ Wait for one `loaded ...` line **per model**, then `Application startup complete`.
Always include `--env-file .env`: it passes `HF_TOKEN` (the free Hugging Face token) that the 3D Model uses online.

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

**Terminal 4: Local 3D model server** (optional; only on a laptop with an NVIDIA GPU, after the one-time setup)
```powershell
.\.venv-hunyuan\Scripts\python.exe -m uvicorn src.api.hunyuan_local:app --port 8001
```
✅ Wait for `Application startup complete`. It loads the model on the **first** build, so that one takes about
9 minutes; after that about **4 minutes** per model on a minimum-spec GPU (faster on bigger ones). Close games and
video tabs while it runs: on a 4 GB graphics card it uses almost all the video memory.

## Step 2: Quick health check (laptop)

- [ ] Open **http://localhost:8000/health**: every model is listed with its `conf` and `classes`.
- [ ] Open **http://localhost:4028**: log in as a **staff** account.
- [ ] Go to **Quality Scan**: the page loads with **no** yellow "Detection server is offline" alert.
- [ ] Only if Terminal 4 is running: open **http://localhost:8001/health**: it shows your GPU's name.

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
| A7 | Stop Terminal 1 (Ctrl+C) → **Upload Image** | Yellow "Detection server is offline" alert. Then **restart Terminal 1** before continuing. |

### B. Android phone (Chrome)

Open the **`https://….trycloudflare.com`** link from Terminal 3.

| # | Test | Expected result |
|---|---|---|
| B1 | Log in as staff → **Quality Scan** | Page loads, no offline alert |
| B2 | **Upload Image** → *Camera* or *Files* | Same result as A1 |
| B3 | **Live Camera → Start Camera** | Permission prompt → **Allow** → **back camera** video |
| B4 | **Start Scan**, point at wood from 15–30 cm | Boxes appear and update about once per second |
| B5 | **Capture & Analyze** → **Save Detection** | Result + "Detection saved successfully" |

### C. iPhone / iPad (Safari, or Chrome on iOS)

Open the **same `https://` link**.

| # | Test | Expected result |
|---|---|---|
| C1 | Log in as staff → **Quality Scan** | Page loads, no offline alert |
| C2 | **Upload Image** → *Take Photo* or *Photo Library* | Same result as A1 |
| C3 | **Live Camera → Start Camera** | Permission prompt → **Allow** → back camera video (plays inside the page, not full screen) |
| C4 | **Start Scan** → **Capture & Analyze** → **Save Detection** | Same results as B4–B5 |

> iPhones may ask for camera permission **every visit**. That's normal. To stop it: Settings → Safari → Camera → *Allow*.

### D. Android tablet

Same steps as **B**, using the same `https://` link.

### E. 3D Model panel (any device)

On **Quality Scan**, scroll to **3D Model**. Select an **order** at the top first so the real measurements show.

| # | Test | Expected result |
|---|---|---|
| E1 | In the **Front** slot tap **Camera**, take a photo of the whole piece | Photo fills the slot, with an ✕ to remove it |
| E2 | In another slot tap **Photos**, pick a saved photo | Photo fills the slot |
| E2b | Add **Top** and **Bottom** photos too | All six photos are used for the model |
| E3 | **Build 3D model** | Progress bar, then a **colored** 3D model you can drag to turn and pinch to zoom (about 1 minute) |
| E3b | Tap **Colors** / **Shape** (bottom left of the model) | Switches between the colored and grey model instantly, without building again. If the free time ran out, a yellow note says the model is the shape only |
| E4 | Tap **⤢** (top right of the model) | Model fills the screen; ✕ or Esc goes back |
| E5 | Look at the **Real size** box (top left) | Length / Width / Height in cm, marked *(measured)* or *(ordered)* |
| E6 | **Download .glb** | File `mfqats-3d-model.glb` saves to the device |
| E7 | Only with Terminal 4: build again after the free online time is used up | Message "this computer is building it (1 to 5 minutes)", then the model appears |

---

## One-time setup: local 3D model server

**Minimum requirements**

| | Minimum | Recommended |
|---|---|---|
| Graphics card | **NVIDIA** GPU with **4 GB** video memory | NVIDIA GPU with 6 GB+ video memory |
| System memory (RAM) | 12 GB | 16 GB |
| Free disk space | 10 GB | 15 GB |
| Operating system | Windows 10/11 64-bit, latest NVIDIA driver | same |
| Software | [uv](https://docs.astral.sh/uv/) (installs Python 3.12 for this server) | same |

AMD/Intel graphics and laptops without a graphics card can't run it; they still get the online 3D Model.
NVIDIA RTX 50-series cards need a newer PyTorch than the one below.

From the project root:
```powershell
uv venv .venv-hunyuan --python 3.12
uv pip install --python .venv-hunyuan\Scripts\python.exe torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu126
uv pip install --python .venv-hunyuan\Scripts\python.exe -r src\api\requirements-hunyuan.txt
```
Check it sees the GPU (should print `True` and the GPU's name):
```powershell
.\.venv-hunyuan\Scripts\python.exe -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```
The first build downloads the model (about 5 GB, can take 20 minutes) and a background remover (1 GB) into your user
folder, so do one test build before a demo.

---

## Rules that keep the flow from breaking

| Rule | Why |
|---|---|
| **Phones always use the `https://` tunnel link**, never `http://192.168…` | Phones only allow the camera on `https://` pages. On `http` the permission prompt never appears. |
| **New tunnel link = log in again** on the phone | Each link is a new website address, and logins are stored per address |
| **Keep the terminals open**, and don't let the laptop sleep | Closing any of them, or sleep, stops the site, the detection server, the tunnel or the local 3D model server |
| **Restart Terminal 1** after changing models or `models.json` | Models are only loaded when the detection server starts |
| **Restart Terminal 2** after changing `next.config.mjs` | That file is only read when the website starts |
| Log in as a **staff** account | The Quality Scan page and the detection server path (`/staff/yolo`) are staff-only |
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
| Yellow **"Detection server is offline"** | Terminal 1 stopped or crashed | Restart Terminal 1; check http://localhost:8000/health |
| **"Your session has expired"** | Logged out, or new tunnel link | Log in again |
| Tunnel link shows an **error page / doesn't load** | Terminal 2 or 3 stopped, laptop slept, or the link is from an old tunnel | Check Terminals 2 and 3 are running; use the **current** link |
| Phone page loads but is **very slow** | Weak Wi-Fi/mobile signal (photos go to the laptop and back) | Move closer to Wi-Fi; use **Capture & Analyze** instead of continuous scanning |
| A new model **isn't detecting** anything | Not loaded | Is it in `src/api/weights/` and `models.json`? Restart Terminal 1, then check `/health` |
| 3D Model: "Today's free 3D model time is used up… Start the local 3D server…" | Free online time used up and Terminal 4 is not running | Start Terminal 4, or wait: the free time comes back 24 h after the first build of the day |
| 3D Model: "The online 3D model service is unavailable right now" | The free Hugging Face demo is down or busy | Start Terminal 4, or try again later |
| 3D Model: "This computer's GPU ran out of memory" | Another program is using the graphics card | Close games, video tabs and other GPU programs, then build again |
| 3D Model never finishes on the local server | The first build is still downloading or loading the model | Watch Terminal 4: the first build takes about 9 minutes, later ones about 4 |
| 3D Model stops working online even with time left | `HF_TOKEN` not loaded | Restart Terminal 1 **with** `--env-file .env` |
| Boxes on real MVCA furniture look wrong | Models were trained on public datasets, not MVCA photos | Expected for now; note it in the results (Table 21 domain gap) |

---

## Test log (copy for each session)

**Date:** ______ **Tester:** ______ **Models loaded (`/health`):** ______________________

| Device (model + browser) | Upload | Live camera | Boxes on live feed | Capture & Analyze | Save | 3D Model | Notes |
|---|---|---|---|---|---|---|---|
| Laptop – Chrome | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |
| Android – ________ | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |
| iPhone – ________ | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |
| Tablet – ________ | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | Pass / Fail | |

These map to the paper's **Table 16 (YOLO Object Detection Module)**: *"marks detected defects on the live camera feed"*
and *"images are captured and processed without system lag."*
