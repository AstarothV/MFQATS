"""3D surface check: RANSAC plane fit + point-to-plane distance.

Takes a 3D point cloud of one furniture surface (a table top, a panel), finds the flat plane the surface should be
(RANSAC), then measures how far every part of the surface is from that plane. Anything further than the tolerance
(2 mm by default) is a dent, or a bend/warp when it covers a large part of the surface.

Sample point clouds:  python src/api/surface.py samples      (writes src/api/samples/*.ply)
Self-check:           python src/api/test_surface.py
"""
import io
import sys
from pathlib import Path

import cv2
import numpy as np

DEFAULT_TOLERANCE_MM = 2.0
UNITS_TO_MM = {"mm": 1.0, "cm": 10.0, "m": 1000.0}
MAX_POINTS = 300_000      # larger clouds are thinned to this many points
RANSAC_POINTS = 20_000    # points the plane search itself looks at
RANSAC_ITERATIONS = 300
GRID_CELLS = 64           # cells along the surface's longer side
MIN_CELL_POINTS = 3       # a cell with fewer points is left blank

# ponytail: rule-of-thumb limits; tune them against real scans.
# Points this far from the plane belong to something else (floor, wall), not the surface.
# ponytail: other objects that cross the plane are still counted; crop the cloud to the surface if that shows up.
IGNORE_BEYOND_MM = 30.0
WARP_FRACTION = 0.25      # out-of-tolerance area above this share of the surface is a bend/warp, not a dent

PLY_TYPES = {"char": "i1", "uchar": "u1", "short": "i2", "ushort": "u2", "int": "i4", "uint": "u4", "float": "f4", "double": "f8",
             "int8": "i1", "uint8": "u1", "int16": "i2", "uint16": "u2", "int32": "i4", "uint32": "u4", "float32": "f4", "float64": "f8"}


class SurfaceError(ValueError):
    """The file or the request cannot be analysed (shown to the user as-is)."""


def read_ply(data):
    """x, y, z of a PLY file's vertices (ascii or binary), as an Nx3 array."""
    end = data.find(b"end_header")
    if end < 0:
        raise SurfaceError("That PLY file has no header.")
    body = data[data.find(b"\n", end) + 1:]
    fmt, count, props, in_vertex, vertex_first = None, None, [], False, True
    for line in data[:end].decode("ascii", "replace").splitlines():
        parts = line.split()
        if parts[:1] == ["format"]:
            fmt = parts[1]
        elif parts[:1] == ["element"]:
            in_vertex = parts[1] == "vertex"
            if in_vertex:
                count = int(parts[2])
            elif count is None:
                vertex_first = False
        elif parts[:1] == ["property"] and in_vertex:
            if parts[1] == "list" or parts[1] not in PLY_TYPES:
                raise SurfaceError("That PLY file stores its points in a way this check cannot read.")
            props.append((parts[2], parts[1]))
    names = [name for name, _ in props]
    if fmt is None or not count or not vertex_first or not {"x", "y", "z"} <= set(names):
        raise SurfaceError("That PLY file has no x, y, z points this check can read.")
    if fmt == "ascii":
        return np.loadtxt(io.BytesIO(body), max_rows=count, usecols=[names.index(a) for a in "xyz"], ndmin=2)
    endian = "<" if fmt == "binary_little_endian" else ">"
    vertices = np.frombuffer(body, np.dtype([(name, endian + PLY_TYPES[t]) for name, t in props]), count)
    return np.stack([vertices["x"], vertices["y"], vertices["z"]], axis=1).astype(np.float64)


def read_points(data):
    """Point cloud file (.ply, or text with x y z per line) -> Nx3 array in the file's own unit."""
    try:
        if data[:3] == b"ply":
            return read_ply(data)
        return np.loadtxt(io.BytesIO(data.replace(b",", b" ").replace(b";", b" ")), usecols=(0, 1, 2), comments=("#", "//"), ndmin=2)
    except SurfaceError:
        raise
    except Exception as e:  # numpy raises several kinds of error for a malformed file
        raise SurfaceError(f"Could not read that point cloud file. Use a .ply file, or text with x y z on each line. ({e})")


def fit_plane_ransac(points, inlier_mm, iterations=RANSAC_ITERATIONS, seed=0):
    """RANSAC: the plane a*x + b*y + c*z + d = 0 that most points lie on. Returns (unit normal [a, b, c], d, inlier share).

    Repeatedly picks 3 random points, makes the plane through them, and counts the points within `inlier_mm` of it;
    the plane with the most support wins and is then refitted to all of its supporters. The seed is fixed so the same
    scan always gives the same verdict.
    """
    rng = np.random.default_rng(seed)
    sample = points if len(points) <= RANSAC_POINTS else points[rng.choice(len(points), RANSAC_POINTS, replace=False)]
    picks = rng.integers(0, len(sample), (iterations, 3))
    p0, p1, p2 = sample[picks[:, 0]], sample[picks[:, 1]], sample[picks[:, 2]]
    normals = np.cross(p1 - p0, p2 - p0)
    lengths = np.linalg.norm(normals, axis=1)
    usable = lengths > 1e-9  # 3 points on one line do not make a plane
    if not usable.any():
        raise SurfaceError("Could not find a flat surface in that point cloud.")
    normals = normals[usable] / lengths[usable, None]
    offsets = -np.einsum("ij,ij->i", normals, p0[usable])
    support = (np.abs(sample @ normals.T + offsets) < inlier_mm).sum(axis=0)
    best = int(np.argmax(support))
    inliers = sample[np.abs(sample @ normals[best] + offsets[best]) < inlier_mm]
    if len(inliers) < 3:
        raise SurfaceError("Could not find a flat surface in that point cloud.")
    centre = inliers.mean(axis=0)
    normal = np.linalg.svd(inliers - centre, full_matrices=False)[2][2]  # least-squares plane of the supporters
    return normal, float(-normal @ centre), len(inliers) / len(sample)


def cell_medians(cells, values, n_cells):
    """Median of `values` per cell index, NaN where a cell has fewer than MIN_CELL_POINTS points."""
    order = np.lexsort((values, cells))
    cells, values = cells[order], values[order]
    ids, starts, counts = np.unique(cells, return_index=True, return_counts=True)
    out = np.full(n_cells, np.nan)
    enough = counts >= MIN_CELL_POINTS
    out[ids[enough]] = values[starts[enough] + counts[enough] // 2]
    return out


def analyze(points_mm, tolerance_mm=DEFAULT_TOLERANCE_MM, inlier_mm=None):
    """points_mm: Nx3 array in millimetres. Returns the verdict, a deviation map and the out-of-tolerance regions."""
    if not 0.1 <= tolerance_mm <= 100:
        raise SurfaceError("Tolerance must be between 0.1 and 100 mm.")
    points = np.asarray(points_mm, dtype=np.float64)
    if points.ndim != 2 or points.shape[1] != 3:
        raise SurfaceError("A point cloud needs x, y and z for every point.")
    points = points[np.isfinite(points).all(axis=1)]
    if len(points) < 100:
        raise SurfaceError("That point cloud has too few points (at least 100 are needed).")
    if len(points) > MAX_POINTS:
        points = points[np.random.default_rng(0).choice(len(points), MAX_POINTS, replace=False)]
    points = points - points.mean(axis=0)  # keeps the numbers small; distances do not change
    across = np.ptp(points, axis=0).max()
    if not 20 <= across <= 20_000:
        raise SurfaceError(f"That point cloud is {across:,.0f} mm across. Check that the right unit is selected.")

    normal, d, inlier_ratio = fit_plane_ransac(points, inlier_mm or tolerance_mm / 2)
    # point-to-plane distance D = |a*x + b*y + c*z + d| / sqrt(a^2 + b^2 + c^2); the normal is unit length, so the divisor is 1
    signed = points @ normal + d
    on_surface = np.abs(signed) <= max(IGNORE_BEYOND_MM, 5 * tolerance_mm)
    surface, signed = points[on_surface], signed[on_surface]

    # lay the surface out flat: u along its longer side, v across
    u_axis = np.linalg.svd(surface - surface.mean(axis=0), full_matrices=False)[2][0]
    u_axis = u_axis - (u_axis @ normal) * normal
    u_axis /= np.linalg.norm(u_axis)
    uv = np.stack([surface @ u_axis, surface @ np.cross(normal, u_axis)], axis=1)
    uv -= uv.min(axis=0)
    width, height = uv.max(axis=0)
    # square cells: at most GRID_CELLS along the long side, and coarse enough to hold several points each
    cell = float(max(width / GRID_CELLS, np.sqrt(width * max(height, 1e-9) * 8 / len(surface))))
    cols, rows = int(width // cell) + 1, int(height // cell) + 1
    index = (uv[:, 1] // cell).astype(int) * cols + (uv[:, 0] // cell).astype(int)
    grid = cell_medians(index, signed, rows * cols).reshape(rows, cols)  # median per cell: one stray point is not a dent

    valid = ~np.isnan(grid)
    over = valid & (np.abs(np.nan_to_num(grid)) > tolerance_mm)
    regions = []
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(over.astype(np.uint8), connectivity=8)
    for i in range(1, count):
        x, y, w, h, _ = stats[i]
        regions.append({
            "x_mm": round(float(centroids[i][0] + 0.5) * cell, 1),
            "y_mm": round(float(centroids[i][1] + 0.5) * cell, 1),
            "width_mm": round(float(w * cell), 1),
            "height_mm": round(float(h * cell), 1),
            "depth_mm": round(float(np.abs(grid[labels == i]).max()), 1),
        })
    regions.sort(key=lambda r: -r["depth_mm"])

    over_fraction = float(over.sum() / max(valid.sum(), 1))
    status = "flat" if not regions else "warp" if over_fraction > WARP_FRACTION else "dent"
    # the scan's own roughness: how much points scatter around their cell's median (the surface's shape does not count)
    noise = float(1.4826 * np.nanmedian(np.abs(signed - grid.ravel()[index])))
    warnings = []
    if noise > tolerance_mm / 2:
        warnings.append(f"The scan is rough (about {noise:.1f} mm of noise), so deviations near {tolerance_mm:g} mm cannot be trusted.")
    if inlier_ratio < 0.5 and status != "warp":
        warnings.append("Less than half of the points lie on one flat surface. Scan one surface at a time.")
    return {
        "status": status,
        "message": {"flat": "Surface is flat within tolerance", "dent": "DENT DETECTED", "warp": "BEND / WARP DETECTED"}[status],
        "tolerance_mm": tolerance_mm,
        "max_deviation_mm": round(float(np.nanmax(np.abs(grid))), 1),
        "out_of_tolerance_percent": round(over_fraction * 100, 1),
        "regions": regions,
        "points": int(len(points)),
        "inlier_percent": round(inlier_ratio * 100, 1),
        "noise_mm": round(noise, 2),
        "plane": [round(float(v), 6) for v in (*normal, d)],
        "size_mm": [round(float(width), 1), round(float(height), 1)],
        "cell_mm": round(float(cell), 2),
        "grid": [[None if np.isnan(v) else round(float(v), 2) for v in row] for row in grid],  # signed mm, row 0 = top
        "warnings": warnings,
        "low_confidence": bool(warnings),
    }


def sample_board(kind="dent", n=12000, seed=1):
    """A 600 x 400 mm board scanned with 0.3 mm of noise, tilted in space. kind: flat | dent | warp."""
    rng = np.random.default_rng(seed)
    x, y = rng.uniform(0, 600, n), rng.uniform(0, 400, n)
    z = rng.normal(0, 0.3, n)
    if kind == "dent":
        z -= 4.0 * np.exp(-((x - 420) ** 2 + (y - 150) ** 2) / (2 * 22.0 ** 2))  # 4 mm deep, about 50 mm wide
    elif kind == "warp":
        z += 7.0 * ((x - 300) / 300) ** 2  # ends lifted 7 mm
    rotation = cv2.Rodrigues(np.array([0.5, -0.3, 0.8]))[0]
    return np.stack([x, y, z], axis=1) @ rotation.T + [120.0, -40.0, 900.0]


def write_ply(path, points):
    header = f"ply\nformat binary_little_endian 1.0\nelement vertex {len(points)}\nproperty float x\nproperty float y\nproperty float z\nend_header\n"
    Path(path).write_bytes(header.encode("ascii") + np.asarray(points, dtype="<f4").tobytes())


if __name__ == "__main__":
    if sys.argv[1:2] == ["samples"]:
        folder = Path(__file__).parent / "samples"
        folder.mkdir(exist_ok=True)
        for kind in ("flat", "dent", "warp"):
            write_ply(folder / f"board_{kind}.ply", sample_board(kind))
            print(f"wrote {folder / f'board_{kind}.ply'}")
    else:
        print(__doc__)
