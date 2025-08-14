#!/usr/bin/env python
"""
Download a real Stable Diffusion 1.5 model for testing
"""

from diffusers import StableDiffusionPipeline
import torch

print("Downloading Stable Diffusion 1.5 model (runwayml/stable-diffusion-v1-5)...")
print("This will take a few minutes to download ~5GB...")

# Use a real SD 1.5 model
model_id = "runwayml/stable-diffusion-v1-5"
cache_dir = "./models"

# Use MPS if available (Mac), otherwise CPU
if torch.backends.mps.is_available():
    device = "mps"
    dtype = torch.float32  # MPS works better with float32
else:
    device = "cpu"
    dtype = torch.float32

print(f"Using device: {device}")

# Download and cache the model
pipeline = StableDiffusionPipeline.from_pretrained(
    model_id,
    cache_dir=cache_dir,
    torch_dtype=dtype,
    safety_checker=None,
    requires_safety_checker=False,
    local_files_only=False
)

print(f"Model downloaded and cached in {cache_dir}")
print("Model is ready for image generation!")