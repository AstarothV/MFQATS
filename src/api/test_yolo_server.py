"""Run: python -m pytest src/api  (or: python src/api/test_yolo_server.py)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from yolo_server import build_response  # noqa: E402

NAMES = {0: "Live_Knot", 1: "Crack", 2: "person", 3: "Unfinished Sanding", 4: "joint-misalignment"}


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


if __name__ == "__main__":
    test_build_response()
    print("ok")
