"""Furniture measurement from one photo: Perspective-n-Point (PnP) + Euclidean distance.

A printed ArUco marker of known size lies on the surface being measured. Its four corners give the camera pose
(PnP); each tapped pixel is then projected onto the marker's plane, and the distance between two such points is the
real length in millimetres.

Print the marker:   python src/api/measure.py marker            (writes public/assets/mfqats-marker-150mm.pdf)
Self-check:         python src/api/test_measure.py
"""
import sys
from pathlib import Path

import cv2
import numpy as np

MARKER_DICT = cv2.aruco.DICT_4X4_50
MARKER_ID = 0
DEFAULT_MARKER_MM = 150.0

# ponytail: rule-of-thumb limits for the "check this result" warning; tune them against tape-measure readings.
MIN_MARKER_PX = 80        # marker side in the photo; smaller than this and its corners are too coarse
MAX_REPROJECTION_PX = 1.5  # marker corners should fit a flat square; more means a bent or blurred marker
MAX_REACH = 8.0           # how many marker-widths away from the marker a point may be


class MeasureError(ValueError):
    """The photo or the request cannot be measured (shown to the user as-is)."""


def find_marker(image_bgr):
    """Pixel corners of the marker, clockwise from its top-left: 4x2 float array."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    params = cv2.aruco.DetectorParameters()
    params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
    detector = cv2.aruco.ArucoDetector(cv2.aruco.getPredefinedDictionary(MARKER_DICT), params)
    corners, ids, _ = detector.detectMarkers(gray)
    for c, i in zip(corners, [] if ids is None else ids.flatten()):
        if i == MARKER_ID:
            return c.reshape(4, 2).astype(np.float64)
    raise MeasureError("Marker not found. Put the printed marker flat on the surface, fully visible, and retake the photo.")


def solve_pose(corners, marker_mm, width, height, focal_px=None):
    """PnP: camera matrix K, rotation R, translation t (marker -> camera, mm) and the reprojection error in pixels.

    The phone's focal length is unknown, so every candidate is tried and the one whose pose reprojects the marker
    corners best is kept. ponytail: lens distortion is not corrected (about 1% near the photo's edges); pass a
    calibrated focal_px, and add distortion coefficients here, if that ever matters.
    """
    s = marker_mm / 2
    obj = np.array([[-s, s, 0], [s, s, 0], [s, -s, 0], [-s, -s, 0]], dtype=np.float64)  # order IPPE_SQUARE expects
    best = None
    for f in [focal_px] if focal_px else np.geomspace(0.4, 4.0, 120) * max(width, height):
        K = np.array([[f, 0, width / 2], [0, f, height / 2], [0, 0, 1]], dtype=np.float64)
        ok, rvec, tvec = cv2.solvePnP(obj, corners, K, None, flags=cv2.SOLVEPNP_IPPE_SQUARE)
        if not ok:
            continue
        projected, _ = cv2.projectPoints(obj, rvec, tvec, K, None)
        err = float(np.sqrt(np.mean(np.sum((projected.reshape(4, 2) - corners) ** 2, axis=1))))
        if best is None or err < best[3]:
            best = (K, cv2.Rodrigues(rvec)[0], tvec.reshape(3), err)
    if best is None:
        raise MeasureError("Could not work out the camera position from the marker. Retake the photo.")
    return best


def to_plane(pixels, K, R, t):
    """Pixels -> 3D points (mm, marker coordinates) where each pixel's viewing ray meets the marker's plane."""
    normal = R[:, 2]
    points = []
    for u, v in pixels:
        ray = np.linalg.solve(K, np.array([u, v, 1.0]))
        facing = normal @ ray
        depth = (normal @ t) / facing if abs(facing) > 1e-9 else -1
        if depth <= 0:
            raise MeasureError("That point is not on the marker's surface. Tap a point on the same flat surface as the marker.")
        points.append(R.T @ (depth * ray - t))
    return np.array(points)


def measure(image_bgr, marker_mm=DEFAULT_MARKER_MM, points=None):
    """points: two [x, y] positions as fractions (0-1) of the image width and height, or None to only find the marker."""
    if not 10 <= marker_mm <= 2000:
        raise MeasureError("Marker size must be between 10 and 2000 mm.")
    height, width = image_bgr.shape[:2]
    corners = find_marker(image_bgr)
    K, R, t, err = solve_pose(corners, marker_mm, width, height)
    marker_px = float(np.mean(np.linalg.norm(corners - np.roll(corners, -1, axis=0), axis=1)))

    warnings = []
    if marker_px < MIN_MARKER_PX:
        warnings.append("The marker is small in the photo. Move closer or use a larger marker.")
    if err > MAX_REPROJECTION_PX:
        warnings.append("The marker looks bent or blurred. Keep it flat and hold the camera steady.")
    result = {
        "marker": [[round(float(x) / width, 5), round(float(y) / height, 5)] for x, y in corners],
        "marker_px": round(marker_px, 1),
        "reprojection_error_px": round(err, 2),
    }

    if points is not None:
        try:
            pts = np.array(points, dtype=np.float64)
        except (TypeError, ValueError):
            pts = np.empty(0)
        if pts.shape != (2, 2) or not np.all(np.isfinite(pts)) or pts.min() < 0 or pts.max() > 1:
            raise MeasureError("Send exactly two points, each as [x, y] between 0 and 1.")
        p1, p2 = to_plane(pts * [width, height], K, R, t)
        # Euclidean distance between the two 3D points
        result["distance_mm"] = round(float(np.sqrt(np.sum((p2 - p1) ** 2))), 1)
        if max(np.linalg.norm(p1), np.linalg.norm(p2)) > MAX_REACH * marker_mm:
            warnings.append("A point is far from the marker. Place the marker closer to what you are measuring.")

    result["warnings"] = warnings
    result["low_confidence"] = bool(warnings)
    return result


def write_marker_pdf(path, marker_mm=DEFAULT_MARKER_MM):
    """A4 page with the marker at its exact size (10 px per mm, so print at 100% / 'Actual size')."""
    from PIL import Image, ImageDraw, ImageFont

    px_per_mm = 10
    page = Image.new("L", (210 * px_per_mm, 297 * px_per_mm), 255)
    side = round(marker_mm * px_per_mm)
    marker = cv2.aruco.generateImageMarker(cv2.aruco.getPredefinedDictionary(MARKER_DICT), MARKER_ID, side)
    left, top = (page.width - side) // 2, 450
    page.paste(Image.fromarray(marker), (left, top))

    draw = ImageDraw.Draw(page)
    draw.text((left, 150), "MFQATS measurement marker", fill=0, font=ImageFont.load_default(80))
    draw.text((left, 260), f"Print at 100% (Actual size). Do not use Fit to page.\nThe black square must measure {marker_mm:g} mm on each side.",
              fill=0, font=ImageFont.load_default(44), spacing=16)
    ruler_top = top + side + 250
    draw.rectangle([left, ruler_top, left + 100 * px_per_mm, ruler_top + 6], fill=0)
    for mm in range(0, 101, 10):
        draw.rectangle([left + mm * px_per_mm - 2, ruler_top - 40, left + mm * px_per_mm + 2, ruler_top], fill=0)
    draw.text((left, ruler_top + 30), "Check with a ruler: this line must be 100 mm long.", fill=0, font=ImageFont.load_default(44))
    page.save(path, resolution=25.4 * px_per_mm)


if __name__ == "__main__":
    if sys.argv[1:2] == ["marker"]:
        mm = float(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_MARKER_MM
        out = Path(__file__).parents[2] / "public" / "assets" / f"mfqats-marker-{mm:g}mm.pdf"
        write_marker_pdf(out, mm)
        print(f"wrote {out}")
    else:
        print(__doc__)
