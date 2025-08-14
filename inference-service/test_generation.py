#!/usr/bin/env python
"""
Test generation with SD 1.5 model
"""

from diffusers import StableDiffusionPipeline
import torch

print("Loading model...")
model_id = "runwayml/stable-diffusion-v1-5"
cache_dir = "./models"

# Load pipeline
pipe = StableDiffusionPipeline.from_pretrained(
    model_id,
    cache_dir=cache_dir,
    torch_dtype=torch.float32,
    safety_checker=None,
    requires_safety_checker=False,
    local_files_only=True  # Use cached model
)

# Move to device
device = "mps" if torch.backends.mps.is_available() else "cpu"
pipe = pipe.to(device)

print(f"Model loaded on {device}")
print(f"Pipeline has tokenizer: {pipe.tokenizer is not None}")
print(f"Pipeline has text_encoder: {pipe.text_encoder is not None}")
print(f"Pipeline has vae: {pipe.vae is not None}")
print(f"Pipeline has unet: {pipe.unet is not None}")

# Test generation
print("\nGenerating test image...")
prompt = "a beautiful sunset"
with torch.no_grad():
    image = pipe(prompt, num_inference_steps=1, guidance_scale=1.0).images[0]

print(f"Image generated successfully: {image.size}")
image.save("test_output.png")
print("Saved to test_output.png")