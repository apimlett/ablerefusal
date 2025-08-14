#!/usr/bin/env python
"""
Download a small Stable Diffusion model for testing
"""

from diffusers import StableDiffusionPipeline
import torch

print("Downloading test model (CompVis/stable-diffusion-v1-4)...")
print("This may take a few minutes...")

# Download a smaller SD 1.4 model for testing
model_id = "CompVis/stable-diffusion-v1-4"
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
print("You can now use this model for image generation!")