# Running the YOLOv12n Defect Detection Server

This guide shows how to run MFQATS's AI defect detection on your own computer, step by step.
You don't need any machine-learning experience.

---

## How it works

MFQATS runs as **two programs at the same time**:

```
 Browser (Quality Scan page)          AI server (Python)
 http://localhost:4028    ── photo ──▶ http://localhost:8000/api/detect
 Next.js website          ◀─ boxes ──  FastAPI + Ultralytics YOLOv12n (every model in src/api/weights/)
```

| Program | What it does | Folder |
|---|---|---|
| **Website** (Next.js) | The MFQATS app you see in the browser | `src/app/` |
| **AI server** (Python, FastAPI) | Receives a photo, runs the YOLOv12n model, and sends back the defects it found | `src/api/` |

If the AI server isn't running, the Quality Scan page shows a yellow **"AI detection server is offline"** alert.
Everything else in the app still works.

---

## Part 1: One-time setup

Do this **once** per computer.

### 1. Install the tools

| Tool | Version | Download | How to check it's installed |
|---|---|---|---|
| **Git** | any | https://git-scm.com | `git --version` |
| **Node.js** | 18 or newer (LTS) | https://nodejs.org | `node --version` |
| **Python** | 3.12 or newer (tested on 3.14) | https://www.python.org/downloads/ | `python --version` |

> **Windows, when installing Python:** tick **"Add python.exe to PATH"** on the first screen of the installer.

### 2. Get the code

```powershell
git clone https://github.com/AstarothV/MFQATS.git
cd MFQATS
```

Already cloned it? Get the latest version instead:

```powershell
git checkout main
git pull
```

### 3. Get the private files from the group

These are **not on GitHub** on purpose, so ask the group leader for them:

| File | Where to put it | Why it's not on GitHub |
|---|---|---|
| `.env` | Project root, next to `package.json` | Contains Supabase keys (secret) |
| The trained models (`.pt` files) | `src/api/weights/` | Binary model files (about 5 MB each). Currently `kaggle4000_yolo12n_2026-09-25.pt` and `coatedwood_yolo12n_2026-09-26.pt`, also on Google Drive in `MyDrive/MFQATS_YOLO/` |

> ⚠️ **Never commit `.env` or share its contents publicly.** Both `.env` and `*.pt` are already listed in `.gitignore`.
> `src/api/weights/models.json` (each model's confidence threshold) **is** in git, so you already have it.

### 4. Install the website packages

Open a terminal **in the project folder** (in VS Code: **Terminal → New Terminal**):

```powershell
npm install
```

### 5. Install the AI server packages

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r src/api/requirements.txt
```

- The first line creates a private Python folder (`.venv`) just for this project.
- The second line switches your terminal to use it. You'll see **`(.venv)`** at the start of the prompt.
- The third line installs FastAPI, Ultralytics YOLO and PyTorch. It downloads a few hundred MB, so it takes **5–10 minutes**.

> **macOS / Linux:** use `python3 -m venv .venv` and `source .venv/bin/activate` instead.

---

## Part 2: Running it (every time)

You need **two terminals** open at the same time. In VS Code, click the **+** in the terminal panel to open a second one.

### Terminal 1: AI server

```powershell
.venv\Scripts\activate
uvicorn src.api.yolo_server:app --reload --port 8000
```

Wait until you see:

```
[yolo_server] loaded coatedwood_yolo12n_2026-09-26.pt (conf 0.22): ['hole', 'blister', 'crack', 'scratch']
[yolo_server] loaded kaggle4000_yolo12n_2026-09-25.pt (conf 0.29): ['Quartzity', 'Live_Knot', ...]
INFO:     Application startup complete.
```

### Terminal 2: Website

```powershell
npm run dev
```

Wait for `Ready`, then open **http://localhost:4028** and log in.

### Try it

1. Go to **Quality Scan (AI)** (`/staff/quality-scan`).
2. **Upload Image:** pick a photo of wood. Red boxes with labels such as `Dead Knot (52.7%)` appear, plus a **PASS/FAIL** badge.
3. **Live Camera → Start Camera → Start Scan:** the camera is scanned once per second. **Capture & Analyze** freezes a frame.
4. Add **Inspection Notes** and click **Save Detection** to store the result in Supabase.
5. **Clear & Retry** resets the scan.

### Stopping

Press **Ctrl + C** in each terminal.

### Using a phone or tablet (Live Camera on Android / iPhone)

> For the full step-by-step test flow on every device (laptop, Android, iPhone, tablet), with expected results and a
> test log, see **[DEVICE_TESTING.md](DEVICE_TESTING.md)**.

Browsers only allow the camera on **`https://`** pages (or `localhost`). Opening the site on a phone through the laptop's
address (`http://192.168.x.x:4028`) is plain `http`, so **the camera prompt never appears**. Use a free Cloudflare
tunnel to get a secure `https://` link to your laptop:

1. **Install once** (in any terminal):
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
   Close and reopen the terminal afterwards.
2. Start **Terminal 1** (AI server) and **Terminal 2** (website) as usual.
3. Open **Terminal 3** and run:
   ```powershell
   cloudflared tunnel --url http://localhost:4028
   ```
   After a few seconds it prints a link like `https://random-words-here.trycloudflare.com`.
4. Open **that link** on the phone, log in as staff, go to **Quality Scan (AI) → Live Camera → Start Camera**.
   The browser now asks for camera permission. Tap **Allow**.

- The phone doesn't need to be on the same Wi-Fi; the link works over mobile data too.
- The link **changes every time** you restart `cloudflared`, and it stops working when you close Terminal 3 or the laptop sleeps.
- Anyone with the link can reach the login page while it's running, so only share it with the team and close it when you're done.
- Photos go phone → website → Python server on the laptop (through `/staff/yolo`, which only logged-in staff can use).
  You don't need to open port 8000 to the phone.

---

## Checking the AI server

Open **http://localhost:8000/health** in your browser:

```json
{"status": "ok", "models": [
  {"file": "coatedwood_yolo12n_2026-09-26.pt", "conf": 0.22, "classes": ["hole", "blister", "crack", "scratch"]},
  {"file": "kaggle4000_yolo12n_2026-09-25.pt", "conf": 0.29, "classes": ["Quartzity", "Live_Knot", "..."]}
]}
```

- Every trained model is listed: ✅ they're all active.
- Only **`yolo12n.pt`** is listed: ❌ `src/api/weights/` has no `.pt` files. The server is running a generic model that knows nothing about wood (see Troubleshooting).

> Opening `http://localhost:8000/` (no path) shows `{"detail":"Not Found"}`. **That's normal.** The server only has `/health` and `/api/detect`.

---

## What the models detect

The server runs **every model in `src/api/weights/`** on each photo and combines the results. All models are
**YOLOv12n** (Ultralytics):

| Model file | Trained on | Classes | Threshold | Test mAP@0.5 |
|---|---|---|---|---|
| `kaggle4000_yolo12n_2026-09-25.pt` | Kaggle *Large Scale Image Dataset of Wood Surface Defects* (Kodytek et al.), 4,000 images of **raw lumber** | Live_Knot, Dead_Knot, Knot_with_crack, Knot_missing, Resin, Marrow, Quartzity, Crack | 0.29 | see its `paper_results` |
| `coatedwood_yolo12n_2026-09-26.pt` | *Surface Defect Detection of Water-Based Coated Wood Products* (Zenodo 15679291), 335 images of **coated / finished wood** | hole, blister, crack, scratch | 0.22 | 0.731 |

Severity and rework recommendation per class (set in `DEFECT_INFO` in `src/api/yolo_server.py`):

| Severity | Classes |
|---|---|
| low | Live_Knot, Resin, Quartzity |
| medium | Dead_Knot, Marrow, scratch, hole, blister |
| high | Crack, Knot_with_crack, Knot_missing |

- **PASS** means every detection is low severity (natural wood features). **FAIL** means at least one is medium or higher.
- **Thresholds:** each model ignores detections below its own confidence threshold (the best-F1 cutoff from section 7
  of its notebook run). They're set in **`src/api/weights/models.json`**.
- **Duplicates:** when two models box the same spot with the same defect name (both detect *crack*), only the more
  confident box is kept. Different names on the same spot (e.g. crack vs scratch) are both shown for the inspector to judge.
- Each detection records which model found it (`model` field), and that's saved with the inspection in Supabase.
- Speed: about **0.3 s per image** with two models on a laptop CPU (the paper requires 3–5 s). Each extra model adds
  about 0.1–0.15 s. The first few seconds after startup are the models loading.

> **Known limitation:** no model has been trained on MVCA's own photos yet, so confidence on real workshop photos is
> lower than on the test sets. Uneven finish, unfinished sanding and joint misalignment aren't detected yet, because
> they need MVCA's own labeled photos.

### Adding another trained model

1. Copy the `.pt` file into `src/api/weights/`, named `<dataset>_yolo12n_<date>.pt` (e.g. `mvca_yolo12n_2026-10-05.pt`).
2. Add its threshold (printed in section 7 of its notebook run) to `src/api/weights/models.json`:
   ```json
   {
     "kaggle4000_yolo12n_2026-09-25.pt": 0.29,
     "coatedwood_yolo12n_2026-09-26.pt": 0.22,
     "mvca_yolo12n_2026-10-05.pt": 0.25
   }
   ```
3. If it has new class names, add a severity and recommendation for each to `DEFECT_INFO` in `src/api/yolo_server.py`
   (the notebook's section 3.1 tells you which ones are missing).
4. Restart Terminal 1 and check `/health` lists it.

To **turn a model off**, move its `.pt` file out of `src/api/weights/` and restart the server.
Only add models with good results in their own notebook run: a weak model adds false alarms to every inspection.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **"AI detection server is offline"** on the Quality Scan page | Terminal 1 isn't running, or it crashed. Start it again (Part 2). |
| `py -3.12` / `python` **is not recognized** | Python isn't installed or isn't on PATH. Reinstall it and tick **"Add python.exe to PATH"**, then close and reopen VS Code. |
| `.venv\Scripts\activate` **cannot be loaded because running scripts is disabled** | Run this once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer **Y**, then try again. |
| `uvicorn` **is not recognized** | The venv isn't active (no `(.venv)` in the prompt). Run `.venv\Scripts\activate` first. |
| `ModuleNotFoundError: No module named 'fastapi'` (or `ultralytics`) | Activate the venv, then run `pip install -r src/api/requirements.txt` again. |
| `/health` shows only `yolo12n.pt` | `src/api/weights/` has no `.pt` files. Copy the trained models there, then restart Terminal 1. |
| Startup warning: `... has no threshold in models.json` | Add that file name and its threshold to `src/api/weights/models.json` (it uses 0.25 until you do). |
| A new model isn't used | The server loads models only at startup. Restart Terminal 1. |
| `[Errno 10048] ... address already in use` (port 8000) | The server is already running in another terminal. Close that one, or use `--port 8001`. The website expects **8000**, though. |
| The camera doesn't start / no permission prompt on a phone | The page must be `https://` (or `localhost`). Use the Cloudflare tunnel link (see *Using a phone or tablet*). If you blocked it before: Android Chrome → ⋮ → Settings → Site settings → Camera; iPhone → Settings → Safari → Camera. |
| "Your session has expired" when analyzing | Log in again. The AI server is only reachable while you're logged in as staff. |
| **Save Detection** fails | Check that `.env` has the Supabase keys and that you're logged in. |
| Boxes look wrong on real photos | Expected for now; see *Known limitation* above. |

---

## Retraining the model (optional)

The model is trained on **Google Colab** (free GPU) with `train_yolov12n_wood.ipynb` in the project root:

1. Colab → **File → Upload notebook** → `train_yolov12n_wood.ipynb`.
2. **Runtime → Change runtime type → T4 GPU**.
3. In **section 0 (Settings)**, paste the dataset link into `DATASET_URL` and choose a new `RUN_NAME`.
   Supported sources: **Kaggle** page URL, **Roboflow** version page (`.../dataset/1`) or "Raw URL" (ends in `?key=...`),
   **Google Drive** share link (zip or folder), a path in your own Drive (`/content/drive/MyDrive/...`), a **GitHub** repo
   URL, or any direct `.zip` link. If the dataset has no `data.yaml`/`classes.txt`, also fill in `CLASS_NAMES`.
4. **Kaggle / Roboflow page links:** 🔑 **Secrets** → add `KAGGLE_API_TOKEN` (Kaggle) or `ROBOFLOW_API_KEY` (roboflow.com →
   Settings → API Keys → *Private API Key*) and turn on *Notebook access*. **Never paste a token or key into a cell.**
5. **Runtime → Run all** and allow Google Drive access. It takes about 2 hours for a dataset the size of the Kaggle one.
6. Results go to Google Drive → `MFQATS_YOLO/`: `<RUN_NAME>_<date>.pt` (the same file is downloaded to your computer), plus the paper tables and figures in
   `paper_results/<RUN_NAME>/`. Each run name gets its own files, so datasets never overwrite each other.
7. Add the model to the server as described in *Adding another trained model* above. To **replace** an older model
   trained on the same data, move the old `.pt` out of `src/api/weights/` and remove its line from `models.json`.

`train_yolov12n_wood_w_results.ipynb` is the finished run with all its outputs, kept for reference.

---

## Files

| Path | Purpose |
|---|---|
| `src/api/yolo_server.py` | The AI server: endpoints, running and merging all models, severity and recommendation per class |
| `src/api/requirements.txt` | Python packages for the server |
| `src/api/test_yolo_server.py` | Quick self-test: `python src/api/test_yolo_server.py` should print `ok` |
| `src/api/weights/*.pt` | Trained models (not in git; get them from the group) |
| `src/api/weights/models.json` | Confidence threshold for each model (in git) |
| `src/app/staff/quality-scan/page.tsx` | The Quality Scan page that calls the server |
| `train_yolov12n_wood.ipynb` | Colab notebook for training and evaluation |
