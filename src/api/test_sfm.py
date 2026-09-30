"""Run: python src/api/test_sfm.py   (takes a few minutes)
Sample photos for the 3D Reconstruction panel: python src/api/test_sfm.py photos

Renders photos of a textured board with the marker on it, from cameras at known positions, reconstructs the board
from those photos, and checks the 3D points against the board's true shape.
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from measure import MARKER_DICT, MARKER_ID  # noqa: E402
from sfm import ReconstructionError, reconstruct  # noqa: E402
from surface import analyze  # noqa: E402

MARKER_MM = 150.0
BOARD_MM = (900, 700)
PX_PER_MM = 2
W, H, FOCAL = 1600, 1200, 1350.0  # a focal length reconstruct() is never told
DENT = (250.0, -120.0, 4.0, 22.0)  # x, y (mm from the marker's centre), depth, spread


def flat(x, y):
    return np.zeros_like(x)


def dented(x, y):
    dx, dy, depth, spread = DENT
    return -depth * np.exp(-((x - dx) ** 2 + (y - dy) ** 2) / (2 * spread ** 2))


def board_texture(seed=0):
    """Blotchy, grain-like surface (so there is detail to match) with the marker on white paper at the centre."""
    rng = np.random.default_rng(seed)
    w, h = BOARD_MM[0] * PX_PER_MM, BOARD_MM[1] * PX_PER_MM
    texture = sum(cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), sigma) * sigma for sigma in (2, 5, 12))
    texture = np.clip(128 + 40 * texture / texture.std(), 0, 255).astype(np.uint8)
    side = int(MARKER_MM * PX_PER_MM)
    pad = side // 5
    y0, x0 = (h - side) // 2, (w - side) // 2
    texture[y0 - pad:y0 + side + pad, x0 - pad:x0 + side + pad] = 255
    texture[y0:y0 + side, x0:x0 + side] = cv2.aruco.generateImageMarker(cv2.aruco.getPredefinedDictionary(MARKER_DICT), MARKER_ID, side)
    return texture


def render(texture, height_at, camera, seed):
    """The photo a camera at `camera` (mm, marker coordinates), aimed at the marker, takes of the board."""
    forward = -camera / np.linalg.norm(camera)
    right = np.cross(forward, [0.0, 0.0, 1.0])
    right /= np.linalg.norm(right)
    down = np.cross(forward, right)
    u, v = np.meshgrid(np.arange(W, dtype=np.float64), np.arange(H, dtype=np.float64))
    rays = ((u - W / 2) / FOCAL)[..., None] * right + ((v - H / 2) / FOCAL)[..., None] * down + forward
    z = np.zeros((H, W))
    for _ in range(4):  # where each pixel's ray meets the surface z = height_at(x, y)
        reach = (z - camera[2]) / rays[..., 2]
        x, y = camera[0] + reach * rays[..., 0], camera[1] + reach * rays[..., 1]
        z = height_at(x, y)
    cols = ((x + BOARD_MM[0] / 2) * PX_PER_MM - 0.5).astype(np.float32)
    rows = ((BOARD_MM[1] / 2 - y) * PX_PER_MM - 0.5).astype(np.float32)
    photo = cv2.remap(texture, cols, rows, cv2.INTER_LINEAR, borderValue=70)
    photo = cv2.GaussianBlur(photo, (0, 0), 0.7).astype(np.float32) + np.random.default_rng(seed).normal(0, 2, (H, W))
    return cv2.cvtColor(np.clip(photo, 0, 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)


def photo_set(height_at, count=10):
    """`count` photos from a ring of cameras around the board, looking down at it."""
    texture = board_texture()
    cameras = []
    for i in range(count):
        around = 2 * np.pi * i / count
        tilt = np.radians(35 + 10 * (i % 2))  # from straight down
        cameras.append(1150 * np.array([np.sin(tilt) * np.cos(around), np.sin(tilt) * np.sin(around), np.cos(tilt)]))
    return [render(texture, height_at, c, seed=i) for i, c in enumerate(cameras)], cameras


def test_reconstructs_a_flat_and_a_dented_board():
    log = []
    photos, cameras = photo_set(dented)
    model = reconstruct(photos, MARKER_MM, progress=lambda message, fraction: log.append(fraction))
    points = model["points"]
    assert log == sorted(log) and 0 <= log[0] and log[-1] <= 1, "progress must only move forward"
    assert model["photos_used"] == len(photos) and model["photos_skipped"] == []
    assert abs(model["focal"] * W - FOCAL) / FOCAL < 0.05, model["focal"] * W

    # cameras end up where the photos were really taken from
    drift = max(np.linalg.norm(np.array(found) - true) for found, true in zip(model["cameras"], cameras))
    assert drift < 15, drift

    # every point lies on the board's true surface, in millimetres
    on_board = (np.abs(points[:, 0]) < BOARD_MM[0] / 2) & (np.abs(points[:, 1]) < BOARD_MM[1] / 2)
    assert on_board.mean() > 0.99 and len(points) > 2000, (on_board.mean(), len(points))
    height_error = points[:, 2] - dented(points[:, 0], points[:, 1])
    assert np.median(np.abs(height_error)) < 0.5, np.median(np.abs(height_error))
    assert np.percentile(np.abs(height_error), 95) < 2.0, np.percentile(np.abs(height_error), 95)

    # and the surface check finds the dent where it was put
    verdict = analyze(points, up=(0, 0, 1))
    assert verdict["status"] == "dent", (verdict["message"], verdict["regions"], verdict["warnings"])
    region = verdict["regions"][0]
    assert region["side"] == "below" and 2.5 <= region["depth_mm"] <= 5.0, region

    photos, _ = photo_set(flat)
    flat_verdict = analyze(reconstruct(photos, MARKER_MM)["points"], up=(0, 0, 1))
    assert flat_verdict["status"] == "flat", (flat_verdict["message"], flat_verdict["regions"])


def test_rejects_unusable_photo_sets():
    blank = np.full((H, W, 3), 128, np.uint8)
    for photos in ([blank], [blank] * 4):
        try:
            reconstruct(photos, MARKER_MM)
            raise AssertionError("reconstructed nothing")
        except ReconstructionError:
            pass


if __name__ == "__main__":
    if sys.argv[1:2] == ["photos"]:  # write the rendered photos of the dented board, to try the panel without a real one
        folder = Path(__file__).parent / "samples" / "sfm_photos"
        folder.mkdir(parents=True, exist_ok=True)
        for i, photo in enumerate(photo_set(dented)[0]):
            cv2.imwrite(str(folder / f"board_{i + 1:02d}.jpg"), photo, [cv2.IMWRITE_JPEG_QUALITY, 92])
        print(f"wrote 10 photos to {folder}")
        sys.exit()
    test_rejects_unusable_photo_sets()
    test_reconstructs_a_flat_and_a_dented_board()
    print("ok")
