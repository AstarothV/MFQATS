"""YOLO12n wood-defect inference server for /staff/quality-scan.

Runs EVERY model in src/api/weights/*.pt on each image and merges the results, so new defect types can be added by
dropping in another trained model. Each model's confidence threshold is set in src/api/weights/models.json.

Small defects: the models look at 640 px, so a whole phone photo is shrunk about 3x and thin scratches vanish. A
photo is therefore checked twice: whole (for big defects) and in overlapping 640 px tiles at full detail (for small
ones), and the two sets of boxes are merged. Live camera frames skip the tiles to stay fast.

Also serves /api/model3d (3D model of a whole piece, via TRELLIS / Hunyuan3D).

Run from the project root (--env-file passes the optional HF_TOKEN from .env, used by /api/model3d):
    uvicorn src.api.yolo_server:app --reload --port 8000 --env-file .env
"""
import base64
import binascii
import io
import json
import math
import os
import re
import tempfile
import threading
import urllib.error
import urllib.request
import uuid
from contextlib import asynccontextmanager
from functools import cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

WEIGHTS_DIR = Path(__file__).parent / "weights"
MODELS_CONFIG = WEIGHTS_DIR / "models.json"   # {"<file>.pt": <confidence threshold>}
FALLBACK_WEIGHTS = "yolo12n.pt"  # COCO base model: runs, but knows no wood defects
DEFAULT_CONF = 0.25              # for a model missing from models.json
DUPLICATE_IOU = 0.5              # same defect name + boxes overlapping this much = one defect
CONTAINED = 0.6                  # ...or this much of the smaller box lies inside the other (a tile's piece of a big defect)
TILE = 640                       # the models' training size: a tile is shown to them at full detail
TILE_OVERLAP = 0.25              # neighbouring tiles share this much, so a defect on a seam is whole in one of them
# ponytail: bigger photos are scaled down to this first; time per photo grows with the number of tiles.
MAX_TILED_SIDE = 2048

# class (lowercased, spaces/hyphens -> "_") -> (severity, rework recommendation)
DEFECT_INFO = {
    "crack": ("high", "Fill the crack with wood filler or epoxy, clamp, and re-sand. Replace the part if the crack runs through a joint."),
    "live_knot": ("low", "Sound knot; acceptable. Seal with shellac before staining to prevent bleed-through."),
    "dead_knot": ("medium", "Drill out the loose knot and plug or fill with epoxy, then sand flush."),
    "knot_with_crack": ("high", "Stabilize with epoxy fill and re-sand; reject the part if it is load-bearing."),
    "knot_missing": ("high", "Plug the knot hole with a matching dowel or epoxy fill, then sand flush."),
    "marrow": ("medium", "Pith is prone to splitting; reposition the cut to avoid it or stabilize with epoxy."),
    "resin": ("low", "Wipe the resin pocket with mineral spirits and seal before finishing."),
    "quartzity": ("low", "Mineral streak; cosmetic only. Accept, or orient the piece to a hidden face."),
    "blue_stain": ("low", "Cosmetic fungal stain; apply wood bleach or use a darker stain."),
    "overgrown": ("medium", "Plane or sand the irregular grain area and re-inspect."),
    "scratch": ("medium", "Re-sand the area with 180–220 grit and refinish."),
    "dent": ("medium", "Steam the dent with a damp cloth and iron, then re-sand."),
    "hole": ("medium", "Fill the hole with matching wood filler, let it cure, sand flush, and touch up the coating."),
    "chip": ("medium", "Fill the chipped spot with wood filler or touch-up putty, sand flush, and touch up the finish."),
    "blister": ("medium", "Sand the blistered coating flush, clean the dust, and recoat in thin layers at controlled humidity."),
    "unfinished_sanding": ("low", "Complete sanding through 220 grit before applying finish."),
    "joint_misalignment": ("high", "Disassemble and re-align the joint, re-glue, and clamp square."),
}
DEFAULT_INFO = ("medium", "Inspect this area manually before proceeding to the next stage.")


CLASS_ALIASES = {"holes": "hole"}  # the same defect named differently by different datasets


def class_key(name):
    key = re.sub(r"[\s-]+", "_", name.strip().lower())
    return CLASS_ALIASES.get(key, key)


@asynccontextmanager
async def lifespan(_app):
    get_models()  # load + warm up at startup so the first inspection isn't slow
    yield


app = FastAPI(title="MVCA YOLO12 Defect Detection", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4028"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@cache
def get_models():
    """[(file name, YOLO model, confidence threshold)] for every .pt in weights/ (or the COCO fallback)."""
    from ultralytics import YOLO  # imported lazily so the helpers below are testable without torch

    thresholds = json.loads(MODELS_CONFIG.read_text()) if MODELS_CONFIG.exists() else {}
    files = sorted(WEIGHTS_DIR.glob("*.pt"))
    if not files:
        print(f"[yolo_server] WARNING: no .pt files in {WEIGHTS_DIR}; using {FALLBACK_WEIGHTS} (knows no wood defects)")
    models = []
    for path in files or [Path(FALLBACK_WEIGHTS)]:
        conf = thresholds.get(path.name, DEFAULT_CONF)
        if path.name not in thresholds and files:
            print(f"[yolo_server] WARNING: {path.name} has no threshold in models.json; using {DEFAULT_CONF}")
        model = YOLO(str(path))
        model.predict(Image.new("RGB", (640, 640)), verbose=False)  # warm-up pass
        print(f"[yolo_server] loaded {path.name} (conf {conf}): {list(model.names.values())}")
        models.append((path.name, model, conf))
    return models


def to_detections(names, boxes_xyxyn, confs, classes, source=None):
    """Raw YOLO output of one model (normalized xyxy boxes, 0–1 confs) -> detection dicts."""
    detections = []
    for (x1, y1, x2, y2), conf, cls in zip(boxes_xyxyn, confs, classes):
        name = names[int(cls)]
        severity, recommendation = DEFECT_INFO.get(class_key(name), DEFAULT_INFO)
        detections.append({
            "id": uuid.uuid4().hex,
            "class_name": name,
            "confidence_score": round(float(conf) * 100, 1),
            "severity": severity,
            "recommendation": recommendation,
            "bounding_box": {  # normalized 0–1, top-left origin
                "x": round(float(x1), 4),
                "y": round(float(y1), 4),
                "width": round(float(x2 - x1), 4),
                "height": round(float(y2 - y1), 4),
            },
            "model": source,  # which weights file found it (traceability in saved inspections)
        })
    return detections


def iou(a, b):
    """Intersection-over-union of two {x, y, width, height} boxes."""
    ix = max(0.0, min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"]))
    iy = max(0.0, min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"]))
    inter = ix * iy
    union = a["width"] * a["height"] + b["width"] * b["height"] - inter
    return inter / union if union > 0 else 0.0


def contained(a, b):
    """Share of the smaller box that lies inside the other."""
    ix = max(0.0, min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"]))
    iy = max(0.0, min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"]))
    smaller = min(a["width"] * a["height"], b["width"] * b["height"])
    return ix * iy / smaller if smaller > 0 else 0.0


def merge_duplicates(detections):
    """The same defect found twice (by two models, or by the whole photo and a tile) -> one detection: the most
    confident one, with its box grown to cover both. Different names on the same spot (e.g. crack vs scratch) are
    both kept for the inspector to judge."""
    kept = []
    for d in sorted(detections, key=lambda d: -d["confidence_score"]):
        for k in kept:
            a, b = k["bounding_box"], d["bounding_box"]
            if class_key(k["class_name"]) == class_key(d["class_name"]) and (iou(a, b) >= DUPLICATE_IOU or contained(a, b) >= CONTAINED):
                x, y = min(a["x"], b["x"]), min(a["y"], b["y"])
                k["bounding_box"] = {
                    "x": x, "y": y,
                    "width": round(max(a["x"] + a["width"], b["x"] + b["width"]) - x, 4),
                    "height": round(max(a["y"] + a["height"], b["y"] + b["height"]) - y, 4),
                }
                break
        else:
            kept.append(d)
    return kept


def tile_windows(width, height, tile=TILE, overlap=TILE_OVERLAP):
    """(x, y, w, h) windows of at most tile x tile pixels that cover the image, neighbours overlapping by `overlap`."""
    def starts(size):
        if size <= tile:
            return [0]
        n = math.ceil((size - tile) / (tile * (1 - overlap))) + 1
        return [round(i * (size - tile) / (n - 1)) for i in range(n)]  # evenly spread; the last one ends at the edge
    return [(x, y, min(tile, width), min(tile, height)) for y in starts(height) for x in starts(width)]


def detect_image(image, tiled=True, models=None):
    """Run every model on the whole photo and, when `tiled`, on overlapping full-detail tiles; merge the results."""
    if tiled and max(image.size) > MAX_TILED_SIDE:
        image = image.copy()
        image.thumbnail((MAX_TILED_SIDE, MAX_TILED_SIDE))
    width, height = image.size
    windows = [(0, 0, width, height)]
    if tiled and max(width, height) > TILE * 1.25:  # a photo near the models' own size gains nothing from tiles
        windows += tile_windows(width, height)
    crops = [image if i == 0 else image.crop((x, y, x + w, y + h)) for i, (x, y, w, h) in enumerate(windows)]
    detections = []
    for name, model, conf in models or get_models():
        for (x, y, w, h), r in zip(windows, model.predict(crops, conf=conf, verbose=False)):
            # tile-relative boxes -> whole-photo fractions
            boxes = [[(x + x1 * w) / width, (y + y1 * h) / height, (x + x2 * w) / width, (y + y2 * h) / height]
                     for x1, y1, x2, y2 in r.boxes.xyxyn.tolist()]
            detections += to_detections(r.names, boxes, r.boxes.conf.tolist(), r.boxes.cls.tolist(), name)
    return summarize(merge_duplicates(detections))


def summarize(detections):
    confs_pct = [d["confidence_score"] for d in detections]
    return {
        "detections": detections,
        # low-severity findings (live knots, resin, mineral streaks) are natural wood features, not rejects
        "overall_result": "fail" if any(d["severity"] != "low" for d in detections) else "pass",
        "confidence_avg": round(sum(confs_pct) / len(confs_pct), 1) if confs_pct else 0,
        "defect_count": len(detections),
    }


def build_response(names, boxes_xyxyn, confs, classes, source=None):
    """Single-model shortcut (used by the tests)."""
    return summarize(to_detections(names, boxes_xyxyn, confs, classes, source))


async def read_image(request: Request) -> Image.Image:
    """Accept multipart `file` upload or JSON `{"image": "<base64 or data URL>"}`."""
    try:
        if request.headers.get("content-type", "").startswith("multipart/"):
            form = await request.form()
            data = await form["file"].read()
        else:
            body = await request.json()
            data = base64.b64decode(str(body["image"]).split(",", 1)[-1])
        return Image.open(io.BytesIO(data)).convert("RGB")
    except (KeyError, ValueError, binascii.Error, UnidentifiedImageError) as e:
        raise HTTPException(400, f"Invalid image payload: {e}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": [{"file": name, "conf": conf, "classes": list(model.names.values())}
                   for name, model, conf in get_models()],
    }


@app.post("/api/detect")
async def detect(request: Request):
    """Multipart `file`, or JSON {"image": ..., "tiled": true}. "tiled": false (live camera frames) skips the tiles."""
    image = await read_image(request)
    tiled = True
    if not request.headers.get("content-type", "").startswith("multipart/"):
        tiled = (await request.json()).get("tiled", True) is not False
    return detect_image(image, tiled)


# ---- 3D model of the whole piece from photos (free Hugging Face Spaces) ----
# A generative model: it looks right but has no real-world scale, so it is for viewing, not for measuring. Free GPU time is limited per day; HF_TOKEN (a free Hugging Face account token) raises the limit.
#   with colors: TRELLIS (shape + photo texture, ~45 s, uses more of the daily time)
#   shape only:  Tencent Hunyuan3D-2mv (untextured, slightly sharper shape); also the fallback when colors fail
# When the online demos fail (time used up, or down), the shape is built by the same Hunyuan model on this computer's
# GPU (hunyuan_local.py, its own server on LOCAL_3D_URL), which has no daily limit. Colors need a 16 GB+ GPU, so the
# local fallback is shape only.
# ponytail: Hunyuan's own texture step ("/generation_all") is broken on its Space as of 2026-10; TRELLIS covers colors.
HF_SPACE = "tencent/Hunyuan3D-2mv"
COLOR_SPACE = "trellis-community/TRELLIS"
VIEWS = ("front", "left", "back", "right")  # Hunyuan3D-2mv was trained on these four side views only
ALL_VIEWS = VIEWS + ("top", "bottom")       # TRELLIS takes any number of views, so top and bottom help the colored model
LOCAL_3D_URL = os.environ.get("LOCAL_3D_URL", "http://localhost:8001")
AI_JOBS = {}
MAX_AI_JOBS = 8


def build_online(job, photos):
    """-> .glb bytes from the free Hugging Face demo. Raises on any failure."""
    from gradio_client import Client, handle_file  # lazy: only this feature needs it

    with tempfile.TemporaryDirectory() as tmp:
        files = {}
        for view, data in zip(VIEWS, photos):
            if data is not None:
                path = Path(tmp) / f"{view}.jpg"
                path.write_bytes(data)
                files[view] = handle_file(str(path))
        job["message"] = "Building the 3D model"
        result = Client(HF_SPACE, token=os.environ.get("HF_TOKEN") or None, verbose=False).predict(
            caption="", image=None,
            mv_image_front=files.get("front"), mv_image_back=files.get("back"),
            mv_image_left=files.get("left"), mv_image_right=files.get("right"),
            steps=30, guidance_scale=5, seed=1234, octree_resolution=256, check_box_rembg=True, num_chunks=8000,
            api_name="/shape_generation")
        model = result[0]["value"] if isinstance(result[0], dict) else result[0]  # a gradio update or a plain path
        return Path(model).read_bytes()


def build_online_color(job, photos):
    """-> textured .glb bytes from the free TRELLIS demo. Raises on any failure."""
    from gradio_client import Client, handle_file

    with tempfile.TemporaryDirectory() as tmp:
        files = []
        for view, data in zip(ALL_VIEWS, photos):
            if data is not None:
                path = Path(tmp) / f"{view}.jpg"
                path.write_bytes(data)
                files.append(handle_file(str(path)))
        client = Client(COLOR_SPACE, token=os.environ.get("HF_TOKEN") or None, verbose=False)
        client.predict(api_name="/start_session")
        # The demo's web page cuts out the background when a photo is uploaded; generation alone does not, so without
        # this step the room (floor, other furniture) is built into the model.
        job["message"] = "Removing the backgrounds"
        files = [handle_file(client.predict(image=f, api_name="/preprocess_image")) for f in files]
        job["message"] = "Building the 3D model with colors"
        if len(files) > 1:
            client.predict(api_name="/lambda_1")  # the demo's "multiple images" tab; without it only one photo is used
        result = client.predict(
            image=files[0] if len(files) == 1 else None,
            multiimages=[{"image": f, "caption": None} for f in files] if len(files) > 1 else [],
            seed=0, ss_guidance_strength=7.5, ss_sampling_steps=12, slat_guidance_strength=3, slat_sampling_steps=12,
            multiimage_algo="stochastic", mesh_simplify=0.95, texture_size=1024, api_name="/generate_and_extract_glb")
        return Path(result[1]).read_bytes()  # [preview video, textured .glb, same .glb for download]


def build_local(photos):
    """-> .glb bytes from hunyuan_local.py. Raises urllib errors if it is not running or fails."""
    images = [None if p is None else "data:image/jpeg;base64," + base64.b64encode(p).decode() for p in photos[:len(VIEWS)]]
    request = urllib.request.Request(f"{LOCAL_3D_URL}/generate", data=json.dumps({"images": images}).encode(),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=900) as r:  # the first build also loads the model
        return r.read()


def run_ai_job(job, photos, color=False):
    if not color and any(p is not None for p in photos[len(VIEWS):]):
        job["note"] = "Top and bottom photos are used for colored models only; this shape was built from the side photos."
    if color:
        try:
            job["model"] = build_online_color(job, photos)
            job["colored"], job["status"], job["message"] = True, "done", "Done"
            return
        except Exception as e:
            print(f"[model3d] colors failed, building the shape only: {str(e)[:200]}")
            sides_only = (" It was built from the four side photos: the backup model has no top or bottom input."
                          if any(p is not None for p in photos[len(VIEWS):]) else "")
            job["note"] = ("Colors were not available this time (the free online time may be running low), "
                           "so this model is the shape only." + sides_only)
    try:
        job["model"] = build_online(job, photos)
        job["status"], job["message"] = "done", "Done"
        return
    except Exception as e:
        online_error = str(e)
        print(f"[model3d] online demo failed, trying this computer's GPU: {online_error[:200]}")
    job["message"] = "The free online time is used up or unavailable, so this computer is building it (1 to 5 minutes)"
    try:
        job["model"] = build_local(photos)
        job["status"], job["message"] = "done", "Done"
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get("detail")
        except ValueError:
            detail = None
        job["status"], job["error"] = "failed", f"This computer could not build the model: {detail or f'HTTP {e.code}'}"
    except (urllib.error.URLError, OSError):
        if "quota" in online_error.lower():
            text = "Today's free 3D model time is used up."
        else:
            text = "The online 3D model service is unavailable right now."
        job["status"], job["error"] = "failed", (
            f"{text} Start the local 3D server to build on this computer instead "
            r"(.venv-hunyuan\Scripts\python.exe -m uvicorn src.api.hunyuan_local:app --port 8001), or try again later.")


def get_ai_job(task_id):
    job = AI_JOBS.get(task_id)
    if job is None:
        raise HTTPException(404, "That 3D model was not found. Build it again.")
    return job


@app.post("/api/model3d")
def model3d_start(body: dict):
    """JSON {"images": [front, left, back, right, top, bottom], "color": true}: JPEG data URLs or null (top and bottom
    may be left out). One photo, or a front photo plus at least one more -> {"task": id}. The model is built in the
    background; poll GET /api/model3d/{task}."""
    images = body.get("images")
    if not isinstance(images, list) or len(images) not in (len(VIEWS), len(ALL_VIEWS)):
        raise HTTPException(400, "Send the photos as [front, left, back, right, top, bottom].")
    images = images + [None] * (len(ALL_VIEWS) - len(images))
    if not all(i is None or (isinstance(i, str) and i.startswith("data:image/")) for i in images):
        raise HTTPException(400, "Each photo must be an image data URL.")
    count = sum(i is not None for i in images)
    if count == 0:
        raise HTTPException(422, "Add at least one photo.")
    if count > 1 and images[0] is None:
        raise HTTPException(422, "With more than one photo, one of them must be the front.")
    try:
        photos = [None if i is None else base64.b64decode(i.split(",", 1)[1]) for i in images]
    except (IndexError, binascii.Error):
        raise HTTPException(400, "A photo could not be read.")
    if count == 1:
        photos = [next(p for p in photos if p is not None)] + [None] * (len(ALL_VIEWS) - 1)  # a single photo is used as the front
    while len(AI_JOBS) >= MAX_AI_JOBS:
        del AI_JOBS[next(iter(AI_JOBS))]  # oldest first
    task_id = uuid.uuid4().hex
    AI_JOBS[task_id] = job = {"status": "running", "message": "Sending the photos", "error": None, "model": None,
                              "colored": False, "note": None}
    threading.Thread(target=run_ai_job, args=(job, photos, body.get("color") is True), daemon=True).start()
    return {"task": task_id}


@app.get("/api/model3d/{task_id}")
def model3d_status(task_id: str):
    job = get_ai_job(task_id)
    return {"status": job["status"], "message": job["message"], "error": job["error"], "ready": job["model"] is not None,
            "colored": job["colored"], "note": job["note"]}


@app.get("/api/model3d/{task_id}/model.glb")
def model3d_file(task_id: str):
    job = get_ai_job(task_id)
    if job["model"] is None:
        raise HTTPException(404, "The 3D model is not ready yet.")
    return Response(job["model"], media_type="model/gltf-binary",
                    headers={"Content-Disposition": f'attachment; filename="mfqats-{task_id[:8]}.glb"'})
