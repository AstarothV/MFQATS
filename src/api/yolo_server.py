"""YOLO12n wood-defect inference server for /staff/quality-scan.

Run from the project root:
    uvicorn src.api.yolo_server:app --reload --port 8000
"""
import base64
import binascii
import io
import re
import uuid
from contextlib import asynccontextmanager
from functools import cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

WEIGHTS = Path(__file__).parent / "weights" / "best.pt"
FALLBACK_WEIGHTS = "yolo12n.pt"  # COCO base model: runs, but knows no wood defects
CONF_THRESHOLD = 0.29  # highest-F1 cutoff on the test set (notebook section 7, F1 0.601)

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
    "unfinished_sanding": ("low", "Complete sanding through 220 grit before applying finish."),
    "joint_misalignment": ("high", "Disassemble and re-align the joint, re-glue, and clamp square."),
}
DEFAULT_INFO = ("medium", "Inspect this area manually before proceeding to the next stage.")

@asynccontextmanager
async def lifespan(_app):
    get_model()  # load + warm up at startup so the first inspection isn't slow
    yield


app = FastAPI(title="MVCA YOLO12 Defect Detection", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4028"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@cache
def get_model():
    from ultralytics import YOLO  # imported lazily so build_response is testable without torch

    weights = WEIGHTS if WEIGHTS.exists() else FALLBACK_WEIGHTS
    print(f"[yolo_server] loading weights: {weights}")
    model = YOLO(str(weights))
    model.predict(Image.new("RGB", (640, 640)), verbose=False)  # warm-up pass
    return model


def build_response(names, boxes_xyxyn, confs, classes):
    """Turn raw YOLO output (normalized xyxy boxes, 0–1 confs) into the page's JSON shape."""
    detections = []
    for (x1, y1, x2, y2), conf, cls in zip(boxes_xyxyn, confs, classes):
        name = names[int(cls)]
        severity, recommendation = DEFECT_INFO.get(re.sub(r"[\s-]+", "_", name.strip().lower()), DEFAULT_INFO)
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
        })
    confs_pct = [d["confidence_score"] for d in detections]
    return {
        "detections": detections,
        # low-severity findings (live knots, resin, mineral streaks) are natural wood features, not rejects
        "overall_result": "fail" if any(d["severity"] != "low" for d in detections) else "pass",
        "confidence_avg": round(sum(confs_pct) / len(confs_pct), 1) if confs_pct else 0,
        "defect_count": len(detections),
    }


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
    return {"status": "ok", "weights": str(WEIGHTS if WEIGHTS.exists() else FALLBACK_WEIGHTS)}


@app.post("/api/detect")
async def detect(request: Request):
    image = await read_image(request)
    model = get_model()
    r = model.predict(image, conf=CONF_THRESHOLD, verbose=False)[0]
    return build_response(
        r.names,
        r.boxes.xyxyn.tolist(),
        r.boxes.conf.tolist(),
        r.boxes.cls.tolist(),
    )
