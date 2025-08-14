#!/usr/bin/env python3
"""
Model Downloader for AbleRefusal
Downloads Stable Diffusion models from Hugging Face (UK-accessible alternative to Civitai)
"""

import os
import sys
import argparse
from pathlib import Path
from huggingface_hub import snapshot_download, hf_hub_download
from diffusers import StableDiffusionPipeline, DiffusionPipeline

# Popular models available on Hugging Face (accessible from UK)
AVAILABLE_MODELS = {
    # Stable Diffusion 1.5 based
    "sd15": "runwayml/stable-diffusion-v1-5",
    "dreamshaper": "Lykon/DreamShaper",
    "deliberate": "XpucT/Deliberate",
    "realistic-vision": "SG161222/Realistic_Vision_V5.1_noVAE",
    "analog-diffusion": "wavymulder/Analog-Diffusion",
    "openjourney": "prompthero/openjourney-v4",
    
    # Stable Diffusion 2.1
    "sd21": "stabilityai/stable-diffusion-2-1",
    "sd21-768": "stabilityai/stable-diffusion-2-1-base",
    
    # SDXL models
    "sdxl": "stabilityai/stable-diffusion-xl-base-1.0",
    "sdxl-turbo": "stabilityai/sdxl-turbo",
    "playground": "playgroundai/playground-v2.5-1024px-aesthetic",
    "juggernaut": "RunDiffusion/Juggernaut-XL-v9",
    
    # Specialized models
    "lcm": "SimianLuo/LCM_Dreamshaper_v7",  # Latent Consistency Model
    "lcm-sdxl": "latent-consistency/lcm-sdxl",
    "turbo": "nota-ai/bk-sdm-small",  # Fast small model
    
    # Anime/Artistic
    "anything-v5": "stablediffusionapi/anything-v5",
    "counterfeit": "gsdf/Counterfeit-V3.0",
}

def download_model(model_key: str, output_dir: str, use_safetensors: bool = True):
    """Download a model from Hugging Face"""
    
    if model_key not in AVAILABLE_MODELS:
        print(f"Unknown model: {model_key}")
        print(f"Available models: {', '.join(AVAILABLE_MODELS.keys())}")
        return False
    
    model_id = AVAILABLE_MODELS[model_key]
    model_path = Path(output_dir) / model_key
    
    print(f"Downloading {model_key} ({model_id}) to {model_path}")
    
    try:
        # Create output directory
        model_path.mkdir(parents=True, exist_ok=True)
        
        # Try to download as diffusers format first
        try:
            print("Attempting to download in diffusers format...")
            snapshot_download(
                repo_id=model_id,
                local_dir=model_path,
                use_safetensors=use_safetensors,
                ignore_patterns=["*.bin"] if use_safetensors else None
            )
            print(f"✓ Downloaded {model_key} in diffusers format")
            return True
            
        except Exception as e:
            print(f"Diffusers format not available, trying single file...")
            
            # Try to download as single safetensors file
            files = ["model.safetensors", "diffusion_pytorch_model.safetensors"]
            for filename in files:
                try:
                    hf_hub_download(
                        repo_id=model_id,
                        filename=filename,
                        local_dir=model_path
                    )
                    print(f"✓ Downloaded {model_key} as {filename}")
                    return True
                except:
                    continue
            
            print(f"✗ Failed to download {model_key}: {e}")
            return False
            
    except Exception as e:
        print(f"✗ Error downloading {model_key}: {e}")
        return False

def convert_to_safetensors(model_path: str, output_path: str):
    """Convert a model to safetensors format"""
    
    print(f"Converting {model_path} to safetensors format...")
    
    try:
        # Load the pipeline
        pipe = DiffusionPipeline.from_pretrained(
            model_path,
            torch_dtype=torch.float16
        )
        
        # Save as safetensors
        pipe.save_pretrained(
            output_path,
            safe_serialization=True
        )
        
        print(f"✓ Converted to safetensors at {output_path}")
        return True
        
    except Exception as e:
        print(f"✗ Conversion failed: {e}")
        return False

def list_models():
    """List all available models"""
    
    print("\n=== Available Models from Hugging Face ===\n")
    print("These models are accessible from the UK and worldwide.\n")
    
    print("Stable Diffusion 1.5 based:")
    for key, model_id in AVAILABLE_MODELS.items():
        if "sd15" in key or key in ["dreamshaper", "deliberate", "realistic-vision", "analog-diffusion", "openjourney"]:
            print(f"  {key:20} - {model_id}")
    
    print("\nStable Diffusion 2.1:")
    for key, model_id in AVAILABLE_MODELS.items():
        if "sd21" in key:
            print(f"  {key:20} - {model_id}")
    
    print("\nSDXL models (larger, higher quality):")
    for key, model_id in AVAILABLE_MODELS.items():
        if "sdxl" in key or key in ["playground", "juggernaut"]:
            print(f"  {key:20} - {model_id}")
    
    print("\nSpecialized models:")
    for key, model_id in AVAILABLE_MODELS.items():
        if key in ["lcm", "lcm-sdxl", "turbo"]:
            print(f"  {key:20} - {model_id}")
    
    print("\nAnime/Artistic:")
    for key, model_id in AVAILABLE_MODELS.items():
        if key in ["anything-v5", "counterfeit"]:
            print(f"  {key:20} - {model_id}")
    
    print("\nUsage: python download_models.py --model <model_key>")
    print("Example: python download_models.py --model sd15")

def main():
    parser = argparse.ArgumentParser(description="Download Stable Diffusion models from Hugging Face")
    parser.add_argument("--model", type=str, help="Model key to download")
    parser.add_argument("--output", type=str, default="./models", help="Output directory")
    parser.add_argument("--list", action="store_true", help="List available models")
    parser.add_argument("--all-basic", action="store_true", help="Download all basic models")
    parser.add_argument("--format", choices=["safetensors", "bin"], default="safetensors", 
                       help="Model format to download")
    
    args = parser.parse_args()
    
    if args.list:
        list_models()
        return
    
    if args.all_basic:
        # Download a selection of basic models
        basic_models = ["sd15", "lcm", "dreamshaper"]
        for model in basic_models:
            print(f"\n{'='*50}")
            download_model(model, args.output, args.format == "safetensors")
        return
    
    if not args.model:
        print("Please specify a model with --model or use --list to see available models")
        sys.exit(1)
    
    success = download_model(args.model, args.output, args.format == "safetensors")
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    import torch  # Import here to check if available
    main()