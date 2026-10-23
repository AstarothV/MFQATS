"""Hunyuan3D-2mv on this computer's own GPU: the fallback for /api/model3d when the free Hugging Face time runs out.

Same model as the online demo (Turbo version: 5 steps instead of 50), so it builds the same kind of 3D shape, just on
local hardware with no daily limit. It runs in its own environment (.venv-hunyuan: Python 3.12 + CUDA PyTorch) so its
packages cannot break the main server's.

Setup: see requirements-hunyuan.txt. Run from the project root, next to the main server:
    .venv-hunyuan\\Scripts\\python.exe -m uvicorn src.api.hunyuan_local:app --port 8001
The first build downloads the model (about 5 GB) into the Hugging Face cache.
"""
import base64
import binascii
import io
import tempfile
import threading
from functools import cache
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException, Response
from PIL import Image, UnidentifiedImageError

MODEL = "tencent/Hunyuan3D-2mv"
SUBFOLDER = "hunyuan3d-dit-v2-mv-turbo"
VIEWS = ("front", "left", "back", "right")
# ponytail: settings sized for the minimum 4 GB GPU. On a bigger GPU raise OCTREE to 380 and CHUNKS to 200_000 for detail.
STEPS = 5
OCTREE = 256
CHUNKS = 8000
MAX_FACES = 40_000  # keeps the .glb small enough to load quickly in the browser

app = FastAPI()
GPU = threading.Lock()  # one GPU: one model at a time


@cache
def workers():
    from hy3dgen.rembg import BackgroundRemover
    from hy3dgen.shapegen import DegenerateFaceRemover, FaceReducer, FloaterRemover, Hunyuan3DDiTFlowMatchingPipeline

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(MODEL, subfolder=SUBFOLDER, use_safetensors=True, device=device)
    pipeline.enable_flashvdm(mc_algo="mc")  # faster, lower-memory decoding of the shape
    return pipeline, BackgroundRemover(), FloaterRemover(), DegenerateFaceRemover(), FaceReducer()


@app.get("/health")
def health():
    return {"status": "ok", "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}


@app.post("/generate")
def generate(body: dict):
    """JSON {"images": [front, left, back, right]} (image data URLs or null) -> the 3D shape as a .glb file."""
    images = body.get("images")
    if not isinstance(images, list) or len(images) != len(VIEWS) or not any(images):
        raise HTTPException(400, "Send the photos as [front, left, back, right], with at least one photo.")
    try:
        photos = {view: Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1])))
                  for view, data in zip(VIEWS, images) if data}
    except (AttributeError, IndexError, binascii.Error, UnidentifiedImageError):
        raise HTTPException(400, "A photo could not be read.")

    with GPU:
        pipeline, rembg, floaters, degenerate, reduce = workers()
        photos = {view: rembg(image.convert("RGB")) for view, image in photos.items()}  # the model wants the piece alone
        try:
            mesh = pipeline(image=photos, num_inference_steps=STEPS, octree_resolution=OCTREE, num_chunks=CHUNKS,
                            generator=torch.manual_seed(1234), output_type="trimesh")[0]
        except torch.cuda.OutOfMemoryError:
            raise HTTPException(507, "This computer's GPU ran out of memory. Close other programs and try again.")
        finally:
            torch.cuda.empty_cache()
        mesh = reduce(degenerate(floaters(mesh)), MAX_FACES)

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "model.glb"
        mesh.export(path)
        return Response(path.read_bytes(), media_type="model/gltf-binary")
