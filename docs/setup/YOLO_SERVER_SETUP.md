# Setup: run MFQATS on your computer

This guide gets the whole system running on your laptop, step by step. You don't need any machine-learning experience.

- **Part 1** is done **once** per computer.
- **Part 2** is what you do **every time** you work on or demo the system.

---

## How it fits together

MFQATS is **two programs running at the same time**, plus two optional helpers for the 3D Model:

```
Browser  ──▶  Website (Next.js, port 4028)  ──▶  Detection server (Python, port 8000)
                       │                                  │
                       ▼                                  ├──▶ Hugging Face (online, free): 3D Model
                Supabase (database, logins)                └──▶ Local 3D server (optional, port 8001)
```

| Program | What it does | Folder |
|---|---|---|
| **Website** | Every screen for admin, staff and customers | `src/app/` |
| **Detection server** | Finds defects in photos (YOLOv12), measures with the marker, builds 3D models, checks for dents and warping | `src/api/` |

If the detection server isn't running, the Quality Scan page shows a yellow **"Detection server is offline"** alert.
Everything else still works.

---

## Part 1: One-time setup

### 1. Install the tools

| Tool | Version | Download | Check it's installed |
|---|---|---|---|
| **Git** | any | https://git-scm.com | `git --version` |
| **Node.js** | 18 or newer (LTS) | https://nodejs.org | `node --version` |
| **Python** | 3.12 or newer | https://www.python.org/downloads/ | `python --version` |

> **Windows:** on the first screen of the Python installer, tick **"Add python.exe to PATH"**.

### 2. Get the code

```powershell
git clone https://github.com/AstarothV/MFQATS.git
cd MFQATS
```

Already have it? Get the latest version instead:

```powershell
git switch main
git pull
```

### 3. Get the private files from the group

These are **not on GitHub** on purpose. Ask the group leader for them:

| File | Put it in | What's in it |
|---|---|---|
| `.env` | The project folder, next to `package.json` | Supabase keys and `HF_TOKEN` (the Hugging Face token for the 3D Model) |
| The trained models (`.pt` files) | `src/api/weights/` | The defect-detection models, about 5 MB each. Also on Google Drive in `MyDrive/MFQATS_YOLO/` |

> ⚠️ **Never put `.env` on GitHub or share what's in it.** Git already ignores `.env` and `.pt` files.
> `src/api/weights/models.json` (each model's confidence setting) **is** on GitHub, so you already have it.

### 4. Install the website packages

Open a terminal in the project folder (in VS Code: **Terminal → New Terminal**), then run:

```powershell
npm install
```

### 5. Install the detection server packages

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r src/api/requirements.txt
```

1. The first line makes a private Python folder (`.venv`) just for this project.
2. The second line switches the terminal to it. You'll see **`(.venv)`** at the start of the line.
3. The third line installs the server's packages. It downloads a few hundred MB, so it takes **5 to 10 minutes**.

> **macOS / Linux:** use `python3 -m venv .venv` and `source .venv/bin/activate` instead.

**Optional:** to build 3D models on your own NVIDIA graphics card when the free online time runs out, also do
[the local 3D server setup](DEVICE_TESTING.md#one-time-setup-local-3d-model-server).

---

## Part 2: Running it (every time)

Open **two terminals**. In VS Code, click **+** in the terminal panel for the second one.

### Terminal 1: detection server

```powershell
.venv\Scripts\activate
uvicorn src.api.yolo_server:app --reload --port 8000 --env-file .env
```

Always include **`--env-file .env`**: it gives the server the Hugging Face token the 3D Model needs.

Wait until you see one `loaded …` line per model, then `Application startup complete`:

```
[yolo_server] loaded coatedwood_yolo12n_2026-09-26.pt (conf 0.22): ['hole', 'blister', 'crack', 'scratch']
INFO:     Application startup complete.
```

### Terminal 2: website

```powershell
npm run dev
```

Wait for `Ready`, then open **http://localhost:4028** and log in.

### Try it

1. Log in as staff and open **Quality Scan**.
2. **Upload Image** and pick a photo of wood. Boxes with labels such as `Dead Knot (52.7%)` appear, with a **PASS** or
   **FAIL** badge.
3. **Live Camera → Start Camera → Start Scan** checks the camera about once a second. **Capture & Analyze** freezes a
   frame.
4. Choose an order at the top, add notes, and click **Save Detection** to store the result.
5. Scroll down for **Measure Dimensions**, **3D Model**, **3D Reconstruction** and **3D Surface Check**.

### Stopping

Press **Ctrl + C** in each terminal.

### Phones and tablets

Phones only allow the camera on `https://` pages, so they need a free Cloudflare tunnel (a third terminal). The full
steps are in **[DEVICE_TESTING.md](DEVICE_TESTING.md)**.

### The published website

The website is published on **Vercel**. Vercel does not run the Python detection server: that stays on the group's
laptop.
- Every Quality Scan tool sends its request to `/staff/yolo/…` on the website.
- The website forwards it to the address in the **`YOLO_SERVER_URL`** setting.
- The laptop is reached through **Tailscale Funnel**, which gives it a fixed https address.
- If the setting is empty or the laptop is off, the tools say they cannot reach the detection server.

**One-time setup** (done by the laptop owner and the Vercel project owner):
1. Make a free account at tailscale.com and install Tailscale on the laptop. Sign in.
2. Start the detection server (Terminal 1 above). In another terminal, run:
   ```
   tailscale funnel 8000
   ```
   The first time, it gives a link for turning on **HTTPS** and **Funnel** for your account; open it and allow both.
   Then it prints the laptop's address, e.g. `https://mvca-laptop.tail1234.ts.net`. **This address never changes.**
3. On vercel.com, open the MFQATS project → **Settings → Environment Variables**. Add `YOLO_SERVER_URL` with that
   address as the value (no `/` at the end), for **Production**. Save.
4. **Redeploy**: **Deployments** → **⋯** on the latest one → **Redeploy**. The address is read when the site is built,
   so saving the setting alone does nothing.
5. In Supabase → **Authentication → URL Configuration**, add the Vercel address as `https://<the-site>.vercel.app/**`
   under **Redirect URLs**, so password reset links work on the published site.

**Every time the tools should work on the published site**, run on the laptop:

| Terminal | Command |
|---|---|
| 1. Detection server | `.\.venv\Scripts\activate` then `uvicorn src.api.yolo_server:app --port 8000 --env-file .env` |
| 2. Local 3D server (only for the unlimited 3D model) | `.venv-hunyuan\Scripts\python.exe -m uvicorn src.api.hunyuan_local:app --port 8001` |
| 3. Funnel | `tailscale funnel 8000` (or `tailscale funnel --bg 8000` to keep it on in the background) |

`npm run dev` is **not** needed for the published site: Vercel runs the website.

Keep in mind:
- **The laptop must stay on.** The tools only work while the laptop, the detection server and the funnel are
  running, so turn off sleep. The rest of the site (logins, shop, orders, dashboards) works without it.
- **Publishing:** every merge into `main` on GitHub publishes the website automatically. Only the Vercel project owner
  can change settings.
- **Keep the funnel address private.** Anyone who has it can use the detection server, including the free daily 3D
  model time.

---

## Checking the detection server

Open **http://localhost:8000/health** in your browser. It lists every model that's running:

```json
{"status": "ok", "models": [
  {"file": "coatedwood_yolo12n_2026-09-26.pt", "conf": 0.22, "classes": ["hole", "blister", "crack", "scratch"]}
]}
```

- ✅ Your trained models are listed: they're all running.
- ❌ Only **`yolo12n.pt`** is listed: `src/api/weights/` has no `.pt` files, so the server is using a general model that
  knows nothing about wood. Copy the models in and restart Terminal 1.

Opening `http://localhost:8000/` with nothing after it shows `{"detail":"Not Found"}`. **That's normal.** The server
only answers these addresses:

| Address | Used by |
|---|---|
| `/health` | You, to check the server |
| `/api/detect` | Defect detection (camera and uploads) |
| `/api/measure` | Measure Dimensions (the printed marker) |
| `/api/reconstruct/…` | 3D Reconstruction (photos around a surface) |
| `/api/surface` | 3D Surface Check (a 3D scan file) |
| `/api/model3d/…` | 3D Model (photos of the whole piece) |

---

## The defect models

The server runs **every `.pt` file in `src/api/weights/`** on each photo and combines what they find. To see which
models are running, check `/health` (above). Files in `src/api/weights/old/` are not loaded.

### Pass or fail

Each defect type has a **severity** and a **repair recommendation**, set in `DEFECT_INFO` in `src/api/yolo_server.py`:

| Severity | Defect types |
|---|---|
| Low (natural wood) | live knot, resin, quartzity, blue stain, unfinished sanding |
| Medium | dead knot, marrow, overgrown, scratch, dent, hole, chip, blister |
| High | crack, knot with crack, missing knot, joint misalignment |

- **PASS:** every defect found is low severity.
- **FAIL:** at least one is medium or high.
- A defect type not in the list counts as medium, with the recommendation *"Inspect this area manually"*.

### How detections are filtered

- **Confidence setting:** each model ignores boxes below its own setting in `src/api/weights/models.json`. The training
  notebook prints the best setting for each model.
- **Small defects:** each photo is checked whole and also in overlapping 640 px tiles, so thin scratches aren't missed.
- **Duplicates:** when two models (or the whole photo and a tile) find the same defect in the same spot, only the most
  confident box is kept.

> **Known limitation:** the models were trained on public wood datasets, not on MVCA's own photos, so they're less sure
> on real workshop photos than on their test sets.

### Adding a trained model

1. Copy the `.pt` file into `src/api/weights/`, named `<dataset>_yolo12n_<date>.pt`, for example
   `mvca_yolo12n_2026-11-05.pt`.
2. Add its confidence setting to `src/api/weights/models.json`. Every line except the last ends with a comma:
   ```json
   {
     "coatedwood_yolo12n_2026-09-26.pt": 0.22,
     "mvca_yolo12n_2026-11-05.pt": 0.25
   }
   ```
3. If it finds new defect types, add a severity and recommendation for each to `DEFECT_INFO` in
   `src/api/yolo_server.py`. The notebook's section 3.1 lists the ones that are missing.
4. Restart Terminal 1 and check that `/health` lists it.

**To turn a model off,** move its `.pt` file into `src/api/weights/old/` and restart Terminal 1. Only add models with
good results in their own notebook run: a weak model adds false alarms to every inspection.

---

## Fixing common problems

| Problem | Fix |
|---|---|
| **"Detection server is offline"** on Quality Scan | Terminal 1 isn't running, or it stopped. Start it again (Part 2). |
| `python` **is not recognized** | Python isn't installed, or wasn't added to PATH. Reinstall it with **"Add python.exe to PATH"** ticked, then reopen VS Code. |
| `.venv\Scripts\activate` **cannot be loaded because running scripts is disabled** | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, answer **Y**, and try again. |
| `uvicorn` **is not recognized** | The `.venv` isn't active (no `(.venv)` at the start of the line). Run `.venv\Scripts\activate` first. |
| **`Fatal error in launcher`** when starting uvicorn | The `.venv` was made in a different folder. Delete the `.venv` folder and redo Part 1, step 5. |
| `ModuleNotFoundError: No module named 'fastapi'` (or `ultralytics`) | Activate the `.venv`, then run `pip install -r src/api/requirements.txt` again. |
| `/health` shows only `yolo12n.pt` | `src/api/weights/` has no `.pt` files. Copy the trained models there and restart Terminal 1. |
| Warning: `… has no threshold in models.json` | Add that file and its confidence setting to `models.json`. Until then it uses 0.25. |
| A new model isn't used | Models are only loaded when the server starts. Restart Terminal 1. |
| `[Errno 10048] … address already in use` (port 8000) | The server is already running in another terminal. Close that one. |
| The 3D Model says the free time is used up | The free online time resets 24 hours after the first build of the day. Or start the local 3D server ([DEVICE_TESTING.md](DEVICE_TESTING.md)). |
| The 3D Model never works, even with time left | Terminal 1 was started without `--env-file .env`. Restart it with it. |
| **"Your session has expired"** when analyzing | Log in again. |
| **Save Detection** fails | Check that `.env` has the Supabase keys and that you're logged in. |
| The camera doesn't start on a phone | The page must be `https://`. Use the Cloudflare tunnel link ([DEVICE_TESTING.md](DEVICE_TESTING.md)). |

---

## Retraining a model (optional)

Models are trained on **Google Colab** (free GPU) with `train_yolov12n_wood.ipynb` from the project folder:

1. In Colab: **File → Upload notebook** → `train_yolov12n_wood.ipynb`.
2. **Runtime → Change runtime type → T4 GPU**.
3. In **section 0 (Settings)**, put the dataset links in `DATASET_URLS` and choose a new `RUN_NAME`. It accepts Kaggle
   pages, Roboflow dataset pages, Google Drive links or paths, GitHub repositories and direct `.zip` links.
4. For Kaggle or Roboflow links, add your key under 🔑 **Secrets** (`KAGGLE_API_TOKEN` or `ROBOFLOW_API_KEY`) and turn on
   *Notebook access*. **Never paste a key into a cell.**
5. **Runtime → Run all**, and allow Google Drive access. A large dataset takes about 2 hours.
6. The model is saved to Google Drive in `MFQATS_YOLO/` and downloaded to your computer. The paper's tables and figures
   go to `MFQATS_YOLO/paper_results/<RUN_NAME>/`.
7. Add the model to the server as described in *Adding a trained model*. The notebook's last cell prints the exact
   line for `models.json`.

---

## Files

| Path | What it is |
|---|---|
| `src/api/yolo_server.py` | The detection server: every address above, merging the models, severity and recommendation per defect type |
| `src/api/measure.py` | Marker measurement (PnP) |
| `src/api/sfm.py` | 3D Reconstruction from photos (SfM) |
| `src/api/surface.py` | Dent and warp check (RANSAC plane fit) |
| `src/api/hunyuan_local.py` | The optional local 3D server |
| `src/api/requirements.txt` | Python packages for the detection server |
| `src/api/test_*.py` | Self-tests: `python src/api/test_yolo_server.py` should print `ok` |
| `src/api/weights/` | The trained models (`.pt`, not on GitHub) and `models.json` |
| `src/app/(staff)/staff/quality-scan/` | The Quality Scan page and its panels |
| `train_yolov12n_wood.ipynb` | The Colab notebook for training and testing models |
