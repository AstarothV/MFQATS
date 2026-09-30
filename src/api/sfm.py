"""3D reconstruction from photos: Structure from Motion (SfM).

Several photos of one surface, taken from different angles with the printed marker in view, become a 3D point
cloud in millimetres:

1. camera positions   the marker's corners give each photo's camera pose (PnP, see measure.py)
2. matching           SIFT features are matched between every pair of photos and chained into tracks
3. structure          each track is triangulated into one 3D point
4. refinement         camera poses and 3D points are re-estimated from each other until they agree

The marker makes the cloud true to scale, and its face is the z = 0 plane with +z pointing up off the surface.

Self-check:  python src/api/test_sfm.py
"""
import cv2
import numpy as np

try:  # run as part of the server package, or directly from this folder (tests)
    from .measure import DEFAULT_MARKER_MM, MeasureError, find_marker, solve_pose
    from .surface import DEFAULT_TOLERANCE_MM, analyze
except ImportError:
    from measure import DEFAULT_MARKER_MM, MeasureError, find_marker, solve_pose
    from surface import DEFAULT_TOLERANCE_MM, analyze

MIN_PHOTOS, MAX_PHOTOS = 3, 24
MAX_FEATURES = 8000        # SIFT features kept per photo
RATIO_TEST = 0.75          # a match must be clearly better than the second-best candidate
MIN_PAIR_MATCHES = 25      # fewer verified matches than this and the pair of photos is ignored
REFINE_ROUNDS = 6
MARKER_WEIGHT = 40         # how many ordinary points one marker corner counts as when re-estimating a camera
# ponytail: rule-of-thumb limits for keeping a 3D point; tune against real photo sets.
MAX_REPROJECTION_PX = 2.0  # a kept point must land this close to where each photo saw it
MIN_ANGLE_DEG = 4.0        # rays from two cameras must cross at least this wide, or depth is a guess
MIN_POINTS = 200
MAX_VIEWER_POINTS = 20_000  # points sent to the browser's 3D view


class ReconstructionError(ValueError):
    """The photo set cannot be reconstructed (shown to the user as-is)."""


def shared_focal(corner_sets, sizes, marker_mm):
    """One focal length (as a fraction of the photo's longer side) that fits the marker in every photo best.
    All photos must come from the same camera without zooming."""
    best = None
    for f in np.geomspace(0.4, 4.0, 120):
        total = sum(solve_pose(c, marker_mm, w, h, focal_px=f * max(w, h))[3] ** 2 for c, (w, h) in zip(corner_sets, sizes))
        if best is None or total < best[1]:
            best = (float(f), total)
    return best[0]


def match_pair(a, b):
    """Verified feature matches between two views: list of (keypoint index in a, keypoint index in b)."""
    pairs = cv2.BFMatcher(cv2.NORM_L2).knnMatch(a["des"], b["des"], k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < RATIO_TEST * n.distance]
    if len(good) < MIN_PAIR_MATCHES:
        return []
    pa = np.array([a["norm"][m.queryIdx] for m in good])
    pb = np.array([b["norm"][m.trainIdx] for m in good])
    # both cameras looked at one rigid scene: keep only the matches that fit a single relative camera motion
    _, mask = cv2.findEssentialMat(pa, pb, np.eye(3), method=cv2.RANSAC, prob=0.999, threshold=1.5 / a["K"][0, 0])
    if mask is None or int(mask.sum()) < MIN_PAIR_MATCHES:
        return []
    return [(m.queryIdx, m.trainIdx) for m, keep in zip(good, mask.ravel()) if keep]


def build_tracks(views, progress):
    """Chain pairwise matches into tracks: each track is one physical point, as {view index: keypoint index}."""
    parent = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    pairs = [(i, j) for i in range(len(views)) for j in range(i + 1, len(views))]
    for n, (i, j) in enumerate(pairs):
        progress(f"Matching photos {i + 1} and {j + 1}", 0.15 + 0.55 * n / len(pairs))
        for qa, qb in match_pair(views[i], views[j]):
            parent[find((i, qa))] = find((j, qb))
    groups = {}
    for node in list(parent):
        groups.setdefault(find(node), []).append(node)
    tracks = []
    for nodes in groups.values():
        track = dict(nodes)
        if len(track) == len(nodes) and len(track) >= 2:  # the same photo twice in a track means a wrong match
            tracks.append(track)
    return tracks


def triangulate(track, views):
    """3D point where the viewing rays of one track cross (least squares over all its photos)."""
    rows = []
    for v, k in track.items():
        x, y = views[v]["norm"][k]
        P = views[v]["P"]
        rows += [x * P[2] - P[0], y * P[2] - P[1]]
    X = np.linalg.svd(np.array(rows))[2][-1]
    return X[:3] / X[3] if abs(X[3]) > 1e-12 else np.full(3, np.nan)


def reprojection_errors(track, X, views):
    """Pixel distance between where X projects and where each photo saw it; inf if X is behind a camera."""
    errors = {}
    for v, k in track.items():
        view = views[v]
        cam = view["R"] @ X + view["t"]
        errors[v] = float(np.linalg.norm(cam[:2] / cam[2] - view["norm"][k]) * view["K"][0, 0]) if cam[2] > 0 else np.inf
    return errors


def widest_angle(track, X, views):
    rays = [X - views[v]["centre"] for v in track]
    rays = [r / np.linalg.norm(r) for r in rays]
    return max(np.degrees(np.arccos(np.clip(a @ b, -1, 1))) for i, a in enumerate(rays) for b in rays[i + 1:])


def set_pose(view, R, t):
    view["R"], view["t"] = R, t
    view["P"] = np.column_stack([R, t])
    view["centre"] = -R.T @ t


def reconstruct(images_bgr, marker_mm=DEFAULT_MARKER_MM, progress=lambda message, fraction: None):
    """Photos (BGR arrays) -> {"points": Nx3 mm, "colors": Nx3 RGB, ...}. Photos without the marker are skipped."""
    if not MIN_PHOTOS <= len(images_bgr) <= MAX_PHOTOS:
        raise ReconstructionError(f"Use between {MIN_PHOTOS} and {MAX_PHOTOS} photos.")
    s = marker_mm / 2
    marker_3d = np.array([[-s, s, 0], [s, s, 0], [s, -s, 0], [-s, -s, 0]], dtype=np.float64)

    # 1. camera positions from the marker
    views, skipped = [], []
    for i, image in enumerate(images_bgr):
        progress(f"Finding the marker in photo {i + 1}", 0.05 * i / len(images_bgr))
        try:
            views.append({"index": i, "image": image, "corners": find_marker(image)})
        except MeasureError:
            skipped.append(i)
    if len(views) < MIN_PHOTOS:
        raise ReconstructionError(f"The marker was found in only {len(views)} photo(s). It must be fully visible in at least {MIN_PHOTOS}.")
    sizes = [(v["image"].shape[1], v["image"].shape[0]) for v in views]
    focal = shared_focal([v["corners"] for v in views], sizes, marker_mm)
    sift = cv2.SIFT_create(nfeatures=MAX_FEATURES)
    for n, (view, (w, h)) in enumerate(zip(views, sizes)):
        progress(f"Reading detail in photo {view['index'] + 1}", 0.05 + 0.10 * n / len(views))
        K, R, t, _ = solve_pose(view["corners"], marker_mm, w, h, focal_px=focal * max(w, h))
        view["K"] = K
        set_pose(view, R, t)
        # 2. features, stored in "normalised" coordinates (pixels with the camera matrix removed)
        keypoints, view["des"] = sift.detectAndCompute(cv2.cvtColor(view["image"], cv2.COLOR_BGR2GRAY), None)
        if view["des"] is None or len(keypoints) < MIN_PAIR_MATCHES:
            raise ReconstructionError(f"Photo {view['index'] + 1} has too little visible detail to match. Check focus and lighting.")
        view["px"] = np.array([k.pt for k in keypoints])
        view["norm"] = (view["px"] - K[:2, 2]) / K[0, 0]
        view["marker_norm"] = (view["corners"] - K[:2, 2]) / K[0, 0]

    tracks = build_tracks(views, progress)
    if len(tracks) < MIN_POINTS:
        raise ReconstructionError("The photos do not overlap enough to build a 3D model. Take them closer together in angle, with the same area in view.")

    # 3 + 4. triangulate, then alternately re-estimate every camera from the points and every point from the cameras
    points = [triangulate(t, views) for t in tracks]
    for round_no in range(REFINE_ROUNDS):
        progress(f"Refining the 3D model ({round_no + 1}/{REFINE_ROUNDS})", 0.72 + 0.25 * round_no / REFINE_ROUNDS)
        limit = max(MAX_REPROJECTION_PX, 8.0 / 2 ** round_no)  # loose at first (poses are rough), strict at the end
        seen = [([], []) for _ in views]
        for track, X in zip(tracks, points):
            if not np.isfinite(X).all():
                continue
            for v, err in reprojection_errors(track, X, views).items():
                if err <= limit:
                    seen[v][0].append(X)
                    seen[v][1].append(views[v]["norm"][track[v]])
        for view, (obj, img) in zip(views, seen):
            if len(obj) < 12:
                continue  # too few points agree with this photo; keep its marker pose
            obj = np.vstack([obj, np.repeat(marker_3d, MARKER_WEIGHT, axis=0)])  # the marker pins scale and position
            img = np.vstack([img, np.repeat(view["marker_norm"], MARKER_WEIGHT, axis=0)])
            ok, rvec, tvec = cv2.solvePnP(obj, img, np.eye(3), None, cv2.Rodrigues(view["R"])[0], view["t"].reshape(3, 1).copy(),
                                          useExtrinsicGuess=True, flags=cv2.SOLVEPNP_ITERATIVE)
            if ok:
                set_pose(view, cv2.Rodrigues(rvec)[0], tvec.reshape(3))
        points = [triangulate(t, views) for t in tracks]

    # keep only well-determined points
    progress("Finishing", 0.98)
    kept, colors, errors = [], [], []
    for track, X in zip(tracks, points):
        if not np.isfinite(X).all():
            continue
        err = max(reprojection_errors(track, X, views).values())
        if err > MAX_REPROJECTION_PX or widest_angle(track, X, views) < MIN_ANGLE_DEG:
            continue
        v, k = next(iter(track.items()))
        x, y = views[v]["px"][k].astype(int)
        kept.append(X)
        colors.append(views[v]["image"][y, x, ::-1])
        errors.append(err)
    if len(kept) < MIN_POINTS:
        raise ReconstructionError("Too few reliable 3D points. Take more photos, from angles 15 to 30 degrees apart, with good lighting.")
    return {
        "points": np.array(kept),
        "colors": np.array(colors, dtype=np.uint8),
        "photos_used": len(views),
        "photos_skipped": [i + 1 for i in skipped],  # photo numbers where the marker was not found
        "focal": round(focal, 4),
        "mean_error_px": round(float(np.mean(errors)), 2),
        "cameras": [[round(float(c), 1) for c in v["centre"]] for v in views],
    }


def reconstruct_and_check(images_bgr, marker_mm=DEFAULT_MARKER_MM, tolerance_mm=DEFAULT_TOLERANCE_MM, progress=lambda message, fraction: None):
    """Photos -> 3D model + surface verdict (RANSAC plane, see surface.py), as plain JSON-ready values."""
    model = reconstruct(images_bgr, marker_mm, progress)
    points, colors = model["points"], model["colors"]
    surface = analyze(points, tolerance_mm, up=(0, 0, 1))  # +z is up off the marker's face, so dents are "below"
    a, b, c, d = surface["plane"]
    deviation = points @ np.array([a, b, c]) + d  # each point's distance from the fitted plane, for colouring the model
    if len(points) > MAX_VIEWER_POINTS:
        pick = np.random.default_rng(0).choice(len(points), MAX_VIEWER_POINTS, replace=False)
        points, colors, deviation = points[pick], colors[pick], deviation[pick]
    return {
        "model": {
            "count": int(len(points)),
            "positions": np.round(points, 1).ravel().tolist(),  # x, y, z, x, y, z, ... in mm
            "colors": colors.ravel().tolist(),                  # r, g, b, ... 0-255
            "deviations": np.round(deviation, 2).tolist(),      # mm from the plane, negative = below
        },
        "surface": surface,
        "total_points": int(len(model["points"])),
        "photos_used": model["photos_used"],
        "photos_skipped": model["photos_skipped"],
        "mean_error_px": model["mean_error_px"],
    }
