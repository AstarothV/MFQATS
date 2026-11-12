"""Run: python -m pytest src/api  (or: python src/api/test_yolo_server.py)"""
import io
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fastapi import HTTPException  # noqa: E402
from PIL import Image  # noqa: E402
from yolo_server import (  # noqa: E402
    build_response, detect_image, merge_duplicates, model3d_start, model3d_status, summarize, tile_windows, to_detections,
)

TRIANGLE = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)  # the binary part of a one-triangle .glb
NAMES = {0:"Live_Knot", 1: "Crack", 2: "person", 3: "Unfinished Sanding", 4: "joint-misalignment"}


def test_build_response():
    empty = build_response(NAMES, [], [], [])
    assert empty == {"detections": [], "overall_result": "pass", "confidence_avg": 0, "defect_count": 0}

    only_live_knot = build_response(NAMES, [[0.1, 0.2, 0.3, 0.5]], [0.853], [0])
    d = only_live_knot["detections"][0]
    assert only_live_knot["overall_result"] == "pass"
    assert d["confidence_score"] == 85.3 and d["severity"] == "low"
    assert d["bounding_box"] == {"x": 0.1, "y": 0.2, "width": 0.2, "height": 0.3}

    mixed = build_response(NAMES, [[0, 0, 1, 1], [0, 0, 0.5, 0.5], [0, 0, 0.1, 0.1]], [0.9, 0.7, 0.5], [0, 1, 2])
    assert mixed["overall_result"] == "fail"
    assert mixed["confidence_avg"] == 70.0 and mixed["defect_count"] == 3
    assert mixed["detections"][2]["severity"] == "medium"  # unknown class -> default
    assert mixed["detections"][2]["recommendation"].startswith("Inspect this area manually")

    # spaces / hyphens / underscores in class names all map to the same entry
    spelled = build_response(NAMES, [[0, 0, 1, 1]] * 2, [0.9, 0.9], [3, 4])
    assert [d["severity"] for d in spelled["detections"]] == ["low", "high"]


def test_merge_across_models():
    wood = to_detections({0: "Crack", 1: "Live_Knot"}, [[0.10, 0.10, 0.30, 0.50], [0.6, 0.6, 0.7, 0.7]], [0.60, 0.80], [0, 1], "wood.pt")
    coated = to_detections({0: "crack", 1: "scratch"}, [[0.11, 0.10, 0.31, 0.50], [0.10, 0.10, 0.30, 0.50]], [0.90, 0.70], [0, 1], "coated.pt")
    merged = merge_duplicates(wood + coated)
    got = sorted((d["class_name"], d["model"]) for d in merged)
    # same crack found by both models -> one box, from the more confident model; scratch on the same spot is kept
    assert got == [("Live_Knot", "wood.pt"), ("crack", "coated.pt"), ("scratch", "coated.pt")], got
    assert summarize(merged)["defect_count"] == 3

    # "Holes" (one dataset) and "hole" (another) are the same defect, with the same severity
    holes = to_detections({0: "Holes", 1: "hole"}, [[0.4, 0.4, 0.5, 0.5], [0.41, 0.4, 0.5, 0.5]], [0.6, 0.5], [0, 1])
    assert len(merge_duplicates(holes)) == 1 and holes[0]["severity"] == "medium"

    # same name but far apart -> two separate cracks
    far = to_detections({0: "Crack"}, [[0, 0, 0.1, 0.1], [0.8, 0.8, 0.9, 0.9]], [0.9, 0.8], [0, 0], "wood.pt")
    assert len(merge_duplicates(far)) == 2


class BlobModel:
    """Stand-in for a YOLO model: "detects" white blobs, but like YOLO it first shrinks each image to 640 px,
    so a blob that ends up under 4 px across is invisible to it."""
    names = {0: "scratch"}

    def predict(self, crops, conf, verbose):
        import cv2
        import numpy as np
        from types import SimpleNamespace as NS

        results = []
        for crop in crops:
            scale = min(1.0, 640 / max(crop.size))
            small = np.asarray(crop.convert("L").resize((round(crop.width * scale), round(crop.height * scale))))
            count, _, stats, _ = cv2.connectedComponentsWithStats((small > 128).astype(np.uint8))
            boxes = [[x / small.shape[1], y / small.shape[0], (x + w) / small.shape[1], (y + h) / small.shape[0]]
                     for x, y, w, h, _ in stats[1:] if min(w, h) >= 4]
            results.append(NS(names=self.names, boxes=NS(xyxyn=NS(tolist=lambda b=boxes: b),
                                                          conf=NS(tolist=lambda n=len(boxes): [0.9] * n),
                                                          cls=NS(tolist=lambda n=len(boxes): [0] * n))))
        return results


def test_tiles_find_small_defects():
    from PIL import Image, ImageDraw

    for w, h in [(2000, 1500), (1500, 2000), (641, 900), (5000, 3000)]:
        windows = tile_windows(w, h)
        covered = set()
        for x, y, tw, th in windows:
            assert tw <= 640 and th <= 640 and x + tw <= w and y + th <= h
            covered |= {(cx, cy) for cx in range(x // 10, (x + tw) // 10) for cy in range(y // 10, (y + th) // 10)}
        assert len(covered) == (w // 10) * (h // 10), (w, h)  # every part of the photo is in some tile

    photo = Image.new("RGB", (2000, 1500), (90, 70, 50))
    draw = ImageDraw.Draw(photo)
    draw.rectangle([1500, 900, 1507, 905], fill="white")  # a small scratch: 8 x 6 px
    draw.rectangle([200, 200, 899, 599], fill="white")    # a big defect, crossing several tile seams
    models = [("blob.pt", BlobModel(), 0.25)]

    whole_only = detect_image(photo, tiled=False, models=models)
    assert whole_only["defect_count"] == 1, whole_only  # shrunk to 640 px, the small scratch disappears

    tiled = detect_image(photo, tiled=True, models=models)
    boxes = sorted((d["bounding_box"] for d in tiled["detections"]), key=lambda b: b["width"])
    assert len(boxes) == 2, boxes  # the big one is not split into pieces, and the small one is found
    small, big = boxes
    assert abs(small["x"] * 2000 - 1500) <= 2 and abs(small["y"] * 1500 - 900) <= 2 and small["width"] * 2000 < 15, small
    assert abs(big["x"] * 2000 - 200) <= 4 and abs((big["x"] + big["width"]) * 2000 - 900) <= 4, big


def test_model3d_rejects_bad_requests():
    def status(call):
        try:
            call()
        except HTTPException as e:
            return e.status_code
        raise AssertionError("expected an HTTPException")

    photo = "data:image/jpeg;base64,AAAA"
    assert status(lambda: model3d_start({"images": [photo]})) == 400  # not the 4 or 6 slots
    assert status(lambda: model3d_start({"images": [None] * 4})) == 422
    assert status(lambda: model3d_start({"images": [None, photo, photo, None]})) == 422  # several photos but no front
    assert status(lambda: model3d_start({"images": ["https://example.com/a.jpg", None, None, None]})) == 400
    assert status(lambda: model3d_status("not-a-job")) == 404

def test_model3d_falls_back_to_this_computer():
    import yolo_server

    def quota(job, photos):
        raise RuntimeError("You have exceeded your ZeroGPU quota")

    online, local, url = yolo_server.build_online, yolo_server.build_local, yolo_server.LOCAL_3D_URL
    color = yolo_server.build_online_color
    yolo_server.build_online = quota
    try:
        yolo_server.LOCAL_3D_URL = "http://127.0.0.1:9"  # nothing listens here: the local server is "not running"
        job = {"status": "running", "message": "", "error": None, "model": None}
        yolo_server.run_ai_job(job, [b"jpg", None, None, None])
        assert job["status"] == "failed" and "used up" in job["error"] and "hunyuan_local" in job["error"], job

        yolo_server.build_local = lambda photos: b"glTF..."  # the local server answers
        # a minimal real .glb (one triangle, no material) for the painting check below
        gltf = json.dumps({"asset": {"version": "2.0"}, "buffers": [{"byteLength": 36}],
                           "bufferViews": [{"buffer": 0, "byteLength": 36}],
                           "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3",
                                          "min": [0, 0, 0], "max": [1, 1, 0]}],
                           "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}]}).encode()
        gltf += b" " * (-len(gltf) % 4)
        body = struct.pack("<II", len(gltf), 0x4E4F534A) + gltf + struct.pack("<II", 36, 0x004E4942) + TRIANGLE
        shape_glb = struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body
        job = {"status": "running", "message": "", "error": None, "model": None}
        yolo_server.run_ai_job(job, [b"jpg", None, None, None])
        assert job["status"] == "done" and job["model"] == b"glTF...", job

        # colors asked for but unavailable: the backup shape is painted in the photos' wood color, with a note
        yolo_server.build_online_color = quota
        yolo_server.build_local = lambda photos: shape_glb
        job = {"status": "running", "message": "", "error": None, "model": None, "colored": False, "note": None}
        brown = io.BytesIO()
        Image.new("RGB", (40, 40), (150, 90, 40)).save(brown, "JPEG")
        yolo_server.run_ai_job(job, [brown.getvalue(), None, None, None], color=True)
        assert job["status"] == "done" and job["colored"] and "wood color" in job["note"], job
        model = job["model"]
        painted = json.loads(model[20:20 + struct.unpack_from("<I", model, 12)[0]])
        r, g, b, _ = painted["materials"][0]["pbrMetallicRoughness"]["baseColorFactor"]
        assert r > g > b and painted["meshes"][0]["primitives"][0]["material"] == 0, painted
        assert struct.unpack_from("<I", model, 8)[0] == len(model) and model.endswith(TRIANGLE), "GLB layout"
        yolo_server.build_local = lambda photos: b"glTF..."

        yolo_server.build_online_color = lambda job, photos: b"glTF-colored"
        job = {"status": "running", "message": "", "error": None, "model": None, "colored": False, "note": None}
        yolo_server.run_ai_job(job, [b"jpg", None, None, None], color=True)
        assert job["colored"] and job["model"] == b"glTF-colored" and job["note"] is None, job

        # colors unavailable with top/bottom photos: the backup uses the sides only, and the panel is told so
        yolo_server.build_online_color = quota
        yolo_server.build_local = lambda photos: shape_glb
        job = {"status": "running", "message": "", "error": None, "model": None, "colored": False, "note": None}
        yolo_server.run_ai_job(job, [b"jpg", None, None, None, b"top", None], color=True)
        assert job["status"] == "done" and job["colored"] and "four side photos" in job["note"], job

        # a file that cannot be painted: the shape is kept, and the note says so
        yolo_server.build_local = lambda photos: b"glTF..."
        job = {"status": "running", "message": "", "error": None, "model": None, "colored": False, "note": None}
        yolo_server.run_ai_job(job, [b"jpg", None, None, None], color=True)
        assert job["status"] == "done" and not job["colored"] and "shape only" in job["note"], job

        # shape only with top/bottom photos: they cannot be used, and the panel is told so
        job = {"status": "running", "message": "", "error": None, "model": None, "colored": False, "note": None}
        yolo_server.run_ai_job(job, [b"jpg", None, None, None, b"top", None], color=False)
        assert job["status"] == "done" and "colored models only" in job["note"], job
    finally:
        yolo_server.build_online, yolo_server.build_local, yolo_server.LOCAL_3D_URL = online, local, url
        yolo_server.build_online_color = color


if __name__ == "__main__":
    test_build_response()
    test_merge_across_models()
    test_tiles_find_small_defects()
    test_model3d_rejects_bad_requests()
    test_model3d_falls_back_to_this_computer()
    print("ok")
