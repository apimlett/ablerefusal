#!/usr/bin/env python
"""
Download a smaller Stable Diffusion model for testing
"""

from diffusers import DiffusionPipeline
import torch

print("Downloading smaller test model (hf-internal-testing/tiny-stable-diffusion-pipe)...")
print("This is a tiny model for testing purposes only...")

# Use a tiny test model for quick setup
model_id = "hf-internal-testing/tiny-stable-diffusion-pipe"
cache_dir = "./models"

# Use MPS if available (Mac), otherwise CPU
if torch.backends.mps.is_available():
    device = "mps"
    dtype = torch.float32  # MPS works better with float32
else:
    device = "cpu"
    dtype = torch.float32

print(f"Using device: {device}")

try:
    # Download and cache the tiny model
    pipeline = DiffusionPipeline.from_pretrained(
        model_id,
        cache_dir=cache_dir,
        torch_dtype=dtype,
        local_files_only=False
    )
    print(f"Tiny model downloaded and cached in {cache_dir}")
    print("Note: This is a test model that will produce low-quality images.")
    print("For real usage, download a full model like 'runwayml/stable-diffusion-v1-5'")
except Exception as e:
    print(f"Error downloading model: {e}")
    print("\nAlternatively, you can use the UI to enter a Hugging Face model ID")
    print("like 'runwayml/stable-diffusion-v1-5' to download a full model.")