# Running the YOLOv12n Defect Detection Server

This guide shows how to run MFQATS's AI defect detection on your own computer, step by step.
You don't need any machine-learning experience.

---

## How it works

MFQATS runs as **two programs at the same time**:

```
 Browser (Quality Scan page)          AI server (Python)
 http://localhost:4028    ── photo ──▶ http://localhost:8000/api/detect
 Next.js website          ◀─ boxes ──  FastAPI + Ultralytics YOLOv12n (best.pt)
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

### 3. Get the two private files from the group

These are **not on GitHub** on purpose, so ask the group leader for them:

| File | Where to put it | Why it's not on GitHub |
|---|---|---|
| `.env` | Project root, next to `package.json` | Contains Supabase keys (secret) |
| `best.pt` | `src/api/weights/best.pt` | The trained model (a 5 MB binary file). Also on Google Drive: `MyDrive/MFQATS_YOLO/best.pt` |

> ⚠️ **Never commit `.env` or share its contents publicly.** Both files are already listed in `.gitignore`.
> The file must be named exactly `best.pt`. If your browser saved it as `best (1).pt`, rename it.

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
[yolo_server] loading weights: ...\src\api\weights\best.pt
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

---

## Checking the AI server

Open **http://localhost:8000/health** in your browser:

```json
{"status": "ok", "weights": "...\\src\\api\\weights\\best.pt"}
```

- `weights` ends in **`best.pt`**: ✅ the trained MFQATS model is loaded.
- `weights` says **`yolo12n.pt`**: ❌ `best.pt` is missing or misnamed. The server is running a generic model that knows nothing about wood (see Troubleshooting).

> Opening `http://localhost:8000/` (no path) shows `{"detail":"Not Found"}`. **That's normal.** The server only has `/health` and `/api/detect`.

---

## What the model detects

The model is **YOLOv12n** (Ultralytics), trained on the Kaggle *Large Scale Image Dataset of Wood Surface Defects* (Kodytek et al.).
It knows 8 defect classes. The server adds a severity and a rework recommendation to each one:

| Class | Severity |
|---|---|
| Live_Knot | low |
| Resin | low |
| Quartzity | low |
| Dead_Knot | medium |
| Marrow | medium |
| Crack | high |
| Knot_with_crack | high |
| Knot_missing | high |

- **PASS** means every detection is low severity (natural wood features). **FAIL** means at least one is medium or higher.
- Detections below **29% confidence** are ignored. That cutoff gave the best F1-score (0.601) on the test set. It's set by `CONF_THRESHOLD` in `src/api/yolo_server.py`.
- Speed: about **0.1 s per image** on a laptop CPU (the paper requires 3–5 s). The first ~5 s after startup is the model loading.

> **Known limitation:** the training photos are raw lumber from an industrial scanner. On real MVCA workshop photos, confidence is lower and some defects are mislabeled.
> Scratches, uneven finish and joint misalignment aren't detected yet, because they need MVCA's own labeled photos.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **"AI detection server is offline"** on the Quality Scan page | Terminal 1 isn't running, or it crashed. Start it again (Part 2). |
| `py -3.12` / `python` **is not recognized** | Python isn't installed or isn't on PATH. Reinstall it and tick **"Add python.exe to PATH"**, then close and reopen VS Code. |
| `.venv\Scripts\activate` **cannot be loaded because running scripts is disabled** | Run this once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer **Y**, then try again. |
| `uvicorn` **is not recognized** | The venv isn't active (no `(.venv)` in the prompt). Run `.venv\Scripts\activate` first. |
| `ModuleNotFoundError: No module named 'fastapi'` (or `ultralytics`) | Activate the venv, then run `pip install -r src/api/requirements.txt` again. |
| `/health` shows `yolo12n.pt` instead of `best.pt` | Put the file at exactly `src/api/weights/best.pt`, then restart Terminal 1. |
| `[Errno 10048] ... address already in use` (port 8000) | The server is already running in another terminal. Close that one, or use `--port 8001`. The website expects **8000**, though. |
| The camera doesn't start | Allow camera access in the browser (the lock icon in the address bar). The camera only works on `localhost` or `https`. |
| **Save Detection** fails | Check that `.env` has the Supabase keys and that you're logged in. |
| Boxes look wrong on real photos | Expected for now; see *Known limitation* above. |

---

## Retraining the model (optional)

The model is trained on **Google Colab** (free GPU) with `train_yolov12n_wood.ipynb` in the project root:

1. Colab → **File → Upload notebook** → `train_yolov12n_wood.ipynb`.
2. **Runtime → Change runtime type → T4 GPU**.
3. 🔑 **Secrets** → add `KAGGLE_API_TOKEN` (your own Kaggle token) and turn on *Notebook access*. **Never paste the token into a cell.**
4. **Runtime → Run all** and allow Google Drive access. It takes about 2 hours in total.
5. Results go to Google Drive → `MFQATS_YOLO/`: `best.pt` plus the tables and figures for the paper (`paper_results/`).
6. Replace `src/api/weights/best.pt`, and set `CONF_THRESHOLD` in `src/api/yolo_server.py` to the value the notebook prints in section 7.

`train_yolov12n_wood_w_results.ipynb` is the finished run with all its outputs, kept for reference.

---

## Files

| Path | Purpose |
|---|---|
| `src/api/yolo_server.py` | The AI server: endpoints, confidence threshold, severity and recommendation per class |
| `src/api/requirements.txt` | Python packages for the server |
| `src/api/test_yolo_server.py` | Quick self-test: `python src/api/test_yolo_server.py` should print `ok` |
| `src/api/weights/best.pt` | Trained model (not in git; get it from the group) |
| `src/app/staff/quality-scan/page.tsx` | The Quality Scan page that calls the server |
| `train_yolov12n_wood.ipynb` | Colab notebook for training and evaluation |
