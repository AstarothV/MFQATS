"""YOLO12n wood-defect inference server for /staff/quality-scan.

Runs EVERY model in src/api/weights/*.pt on each image and merges the results, so new defect types can be added by
dropping in another trained model. Each model's confidence threshold is set in src/api/weights/models.json.

Also serves /api/measure (marker-based measurement, see measure.py).

Run from the project root:
    uvicorn src.api.yolo_server:app --reload --port 8000
"""
import base64
import binascii
import io
import json
import re
import uuid
from contextlib import asynccontextmanager
from functools import cache
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

WEIGHTS_DIR = Path(__file__).parent / "weights"
MODELS_CONFIG = WEIGHTS_DIR / "models.json"   # {"<file>.pt": <confidence threshold>}
FALLBACK_WEIGHTS = "yolo12n.pt"  # COCO base model: runs, but knows no wood defects
DEFAULT_CONF = 0.25              # for a model missing from models.json
DUPLICATE_IOU = 0.5              # same defect name + boxes overlapping this much = one defect

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
    "blister": ("medium", "Sand the blistered coating flush, clean the dust, and recoat in thin layers at controlled humidity."),
    "unfinished_sanding": ("low", "Complete sanding through 220 grit before applying finish."),
    "joint_misalignment": ("high", "Disassemble and re-align the joint, re-glue, and clamp square."),
}
DEFAULT_INFO = ("medium", "Inspect this area manually before proceeding to the next stage.")


def class_key(name):
    return re.sub(r"[\s-]+", "_", name.strip().lower())


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


def merge_duplicates(detections):
    """Two models boxing the same spot with the same defect name -> keep only the most confident one.
    Different names on the same spot (e.g. crack vs scratch) are both kept for the inspector to judge."""
    kept = []
    for d in sorted(detections, key=lambda d: -d["confidence_score"]):
        if not any(class_key(k["class_name"]) == class_key(d["class_name"])
                   and iou(k["bounding_box"], d["bounding_box"]) >= DUPLICATE_IOU for k in kept):
            kept.append(d)
    return kept


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
    image = await read_image(request)
    detections = []
    for name, model, conf in get_models():
        r = model.predict(image, conf=conf, verbose=False)[0]
        detections += to_detections(r.names, r.boxes.xyxyn.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist(), name)
    return summarize(merge_duplicates(detections))


@app.post("/api/measure")
async def measure_distance(request: Request):
    """JSON {"image": ..., "marker_mm": 150, "points": [[x, y], [x, y]]} -> real distance between the two points.
    Without "points" it only reports whether the marker was found."""
    from .measure import DEFAULT_MARKER_MM, MeasureError, measure  # lazy, like ultralytics above: keeps cv2 out of the unit tests

    image = await read_image(request)
    body = await request.json()
    try:
        marker_mm = float(body.get("marker_mm") or DEFAULT_MARKER_MM)
        return measure(np.asarray(image)[:, :, ::-1].copy(), marker_mm, body.get("points"))  # RGB -> BGR for OpenCV
    except MeasureError as e:
        raise HTTPException(422, str(e))
    except (TypeError, ValueError) as e:
        raise HTTPException(400, f"Invalid measure request: {e}")
