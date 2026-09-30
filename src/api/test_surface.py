"""Run: python src/api/test_surface.py

Builds point clouds of a board with a known shape (flat, dented, warped) and checks the verdict and the numbers.
"""
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from surface import SurfaceError, analyze, fit_plane_ransac, read_points, sample_board, write_ply  # noqa: E402


def test_plane_fit():
    # points exactly on 2x - y + 2z = 30, plus clutter far away: RANSAC must find that plane anyway
    rng = np.random.default_rng(3)
    xy = rng.uniform(-200, 200, (3000, 2))
    on_plane = np.column_stack([xy, (30 - 2 * xy[:, 0] + xy[:, 1]) / 2])
    clutter = rng.uniform(-400, 400, (1200, 3))
    normal, d, share = fit_plane_ransac(np.vstack([on_plane, clutter]), inlier_mm=1.0)
    expected = np.array([2, -1, 2]) / 3
    assert abs(abs(normal @ expected) - 1) < 1e-6, normal
    assert abs(abs(d) - 10) < 1e-3, d  # 30 / |(2, -1, 2)|
    assert 0.65 < share < 0.8, share


def test_verdicts():
    flat = analyze(sample_board("flat"))
    assert flat["status"] == "flat" and flat["regions"] == [] and not flat["low_confidence"], flat["message"]
    assert flat["max_deviation_mm"] < 1.0, flat["max_deviation_mm"]
    assert abs(flat["size_mm"][0] - 600) < 5 and abs(flat["size_mm"][1] - 400) < 5, flat["size_mm"]

    dent = analyze(sample_board("dent"))
    assert dent["status"] == "dent" and dent["message"] == "DENT DETECTED", dent["message"]
    assert len(dent["regions"]) == 1, dent["regions"]
    region = dent["regions"][0]
    assert 3.0 <= region["depth_mm"] <= 4.5, region  # true depth 4 mm
    assert 25 <= region["width_mm"] <= 80 and 25 <= region["height_mm"] <= 80, region
    # the dent is 180 mm from one short edge and 150 mm from one long edge (which edge depends on how the board is laid out)
    assert min(abs(region["x_mm"] - 420), abs(region["x_mm"] - 180)) < 15, region
    assert min(abs(region["y_mm"] - 150), abs(region["y_mm"] - 250)) < 15, region

    warp = analyze(sample_board("warp"))
    assert warp["status"] == "warp", (warp["message"], warp["out_of_tolerance_percent"])

    # a looser tolerance accepts the same dent
    assert analyze(sample_board("dent"), tolerance_mm=5.0)["status"] == "flat"

    # the floor 700 mm under the board is not part of the surface
    board = sample_board("flat")
    drop = np.cross(board[1] - board[0], board[2] - board[0])
    floor = board[:4000] + 700 * drop / np.linalg.norm(drop)
    with_floor = analyze(np.vstack([board, floor]))
    assert with_floor["status"] == "flat", with_floor["message"]

    # a rough scan is flagged instead of trusted
    rough = sample_board("flat") + np.random.default_rng(7).normal(0, 1.5, (12000, 3))
    assert analyze(rough)["low_confidence"]

    # same input, same answer
    assert analyze(sample_board("dent")) == dent


def test_files_and_bad_input():
    board = sample_board("dent", n=2000)
    with tempfile.TemporaryDirectory() as folder:
        binary = Path(folder) / "b.ply"
        write_ply(binary, board)
        assert np.allclose(read_points(binary.read_bytes()), board, atol=1e-3)
    ascii_ply = ("ply\nformat ascii 1.0\ncomment test\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\n"
                 "property uchar red\nelement face 0\nproperty list uchar int vertex_indices\nend_header\n1 2 3 9\n4 5 6 9\n7 8 9.5 9\n")
    assert read_points(ascii_ply.encode()).tolist() == [[1, 2, 3], [4, 5, 6], [7, 8, 9.5]]
    assert read_points(b"# x y z\n1,2,3\n4 5 6\n").tolist() == [[1, 2, 3], [4, 5, 6]]

    for bad_file in (b"ply\nformat ascii 1.0\nend_header\n", b"not a point cloud", b"1 2\n3 4\n"):
        try:
            read_points(bad_file)
            raise AssertionError(f"read {bad_file!r}")
        except SurfaceError:
            pass
    for bad_points, tolerance in ((np.zeros((10, 3)), 2.0), (sample_board("flat") / 1000, 2.0), (sample_board("flat") * 1000, 2.0), (sample_board("flat"), 0.0), (np.zeros((500, 2)), 2.0)):
        try:
            analyze(bad_points, tolerance)
            raise AssertionError("analysed bad input")
        except SurfaceError:
            pass


if __name__ == "__main__":
    test_plane_fit()
    test_verdicts()
    test_files_and_bad_input()
    print("ok")
