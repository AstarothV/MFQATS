"""Run: python -m pytest src/api  (or: python src/api/test_measure.py)

Renders the marker on a flat surface as a camera at a known position would see it, then checks that the measured
distance between two known points on that surface comes back right.
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from measure import MARKER_DICT, MARKER_ID, MeasureError, measure  # noqa: E402

MARKER_MM = 150.0
W, H, FOCAL = 2000, 1500, 1700.0  # the photo, and a focal length measure() is never told


def render(tilt_deg, distance_mm, px_per_mm=2, span_mm=1200):
    """(photo, project) where project((x, y) in mm on the surface) -> (u, v) as fractions of the photo."""
    # the surface: a light board with the marker at its centre
    size = span_mm * px_per_mm
    board = np.full((size, size), 200, np.uint8)
    side = int(MARKER_MM * px_per_mm)
    pad = side // 4  # white paper around the marker
    a = (size - side) // 2
    board[a - pad:a + side + pad, a - pad:a + side + pad] = 255
    board[a:a + side, a:a + side] = cv2.aruco.generateImageMarker(cv2.aruco.getPredefinedDictionary(MARKER_DICT), MARKER_ID, side)

    # camera: looks at the marker from `distance_mm`, tilted about the x axis and turned a little
    K = np.array([[FOCAL, 0, W / 2], [0, FOCAL, H / 2], [0, 0, 1]])
    R = cv2.Rodrigues(np.array([np.radians(180 - tilt_deg), 0.0, 0.0]))[0] @ cv2.Rodrigues(np.array([0.0, 0.0, np.radians(20)]))[0]
    t = np.array([40.0, -30.0, distance_mm])
    plane_to_photo = K @ np.column_stack([R[:, 0], R[:, 1], t])  # surface mm (z = 0) -> photo pixels
    board_to_plane = np.array([[1 / px_per_mm, 0, -span_mm / 2], [0, -1 / px_per_mm, span_mm / 2], [0, 0, 1]])
    photo = cv2.warpPerspective(board, plane_to_photo @ board_to_plane, (W, H), borderValue=90)

    def project(xy):
        u, v, w = plane_to_photo @ np.array([xy[0], xy[1], 1.0])
        return [u / w / W, v / w / H]

    return cv2.cvtColor(photo, cv2.COLOR_GRAY2BGR), project


def test_measures_known_distances():
    for tilt, distance in [(0, 1400), (25, 1500), (45, 1600)]:
        photo, project = render(tilt, distance)
        for p1, p2 in [((-300, -100), (350, -100)), ((-250, 200), (300, -280)), ((0, 0), (0, 400))]:
            truth = float(np.hypot(p2[0] - p1[0], p2[1] - p1[1]))
            got = measure(photo, MARKER_MM, [project(p1), project(p2)])
            error = abs(got["distance_mm"] - truth)
            assert error <= 0.01 * truth, (tilt, p1, p2, truth, got)
            assert not got["low_confidence"], got


def test_marker_only_and_bad_input():
    photo, project = render(30, 1500)
    found = measure(photo, MARKER_MM)
    assert "distance_mm" not in found and len(found["marker"]) == 4

    # a marker printed at the wrong size scales the answer, so the size must be passed correctly
    half = measure(photo, MARKER_MM / 2, [project((-300, 0)), project((300, 0))])
    assert abs(half["distance_mm"] - 300) <= 3, half

    tiny_photo, tiny_project = render(30, 4500)  # marker only a few dozen pixels wide
    tiny = measure(tiny_photo, MARKER_MM, [tiny_project((-300, 0)), tiny_project((300, 0))])
    assert tiny["low_confidence"] and tiny["warnings"], tiny

    for bad in ([[0.1, 0.1]], [[0.1, 0.1], [2, 0.5]], "nope", [[0.1, 0.1], [0.2, None]]):
        try:
            measure(photo, MARKER_MM, bad)
            raise AssertionError(f"accepted {bad!r}")
        except MeasureError:
            pass
    try:
        measure(np.full((300, 400, 3), 128, np.uint8), MARKER_MM)
        raise AssertionError("found a marker in a blank photo")
    except MeasureError:
        pass


if __name__ == "__main__":
    test_measures_known_distances()
    test_marker_only_and_bad_input()
    print("ok")
