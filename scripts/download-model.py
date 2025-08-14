#!/usr/bin/env python3
"""
Download and prepare Stable Diffusion ONNX model for the platform
"""

import os
import sys
import json
import hashlib
from pathlib import Path
import urllib.request
import zipfile

# Model configurations
MODELS = {
    "sd15": {
        "name": "Stable Diffusion v1.5",
        "description": "Base Stable Diffusion v1.5 model in ONNX format",
        "size": "~4GB",
        "url": "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/",
        "files": [
            "unet/model.onnx",
            "text_encoder/model.onnx",
            "vae_decoder/model.onnx",
            "vae_encoder/model.onnx",
            "tokenizer/tokenizer_config.json",
            "tokenizer/vocab.json",
            "tokenizer/merges.txt",
            "scheduler/scheduler_config.json"
        ]
    }
}

def download_file(url, dest_path, chunk_size=8192):
    """Download a file with progress indicator"""
    print(f"Downloading: {os.path.basename(dest_path)}")
    
    try:
        with urllib.request.urlopen(url) as response:
            total_size = int(response.headers.get('Content-Length', 0))
            downloaded = 0
            
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            with open(dest_path, 'wb') as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    if total_size > 0:
                        progress = downloaded / total_size * 100
                        print(f"  Progress: {progress:.1f}%", end='\r')
            
            print(f"  ✅ Downloaded: {os.path.basename(dest_path)}")
            return True
    except Exception as e:
        print(f"  ❌ Failed to download: {e}")
        return False

def setup_mock_model(model_id="sd15"):
    """Create a mock model structure for testing"""
    model_path = Path("models") / model_id
    
    print(f"\n🔧 Setting up mock model for testing: {model_id}")
    
    # Create model directories
    dirs = ["unet", "text_encoder", "vae_decoder", "vae_encoder", "tokenizer", "scheduler"]
    for dir_name in dirs:
        (model_path / dir_name).mkdir(parents=True, exist_ok=True)
    
    # Create mock config files
    configs = {
        "model_config.json": {
            "model_type": "stable-diffusion",
            "version": "1.5",
            "format": "onnx",
            "components": {
                "unet": "unet/model.onnx",
                "text_encoder": "text_encoder/model.onnx",
                "vae_decoder": "vae_decoder/model.onnx",
                "vae_encoder": "vae_encoder/model.onnx"
            }
        },
        "tokenizer/tokenizer_config.json": {
            "tokenizer_class": "CLIPTokenizer",
            "model_max_length": 77
        },
        "scheduler/scheduler_config.json": {
            "scheduler_type": "PNDM",
            "num_train_timesteps": 1000,
            "beta_start": 0.00085,
            "beta_end": 0.012
        }
    }
    
    for file_path, content in configs.items():
        full_path = model_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, 'w') as f:
            json.dump(content, f, indent=2)
    
    # Create placeholder files for testing
    placeholder_files = [
        "unet/model.onnx.placeholder",
        "text_encoder/model.onnx.placeholder",
        "vae_decoder/model.onnx.placeholder",
        "vae_encoder/model.onnx.placeholder",
        "tokenizer/vocab.json",
        "tokenizer/merges.txt"
    ]
    
    for file_path in placeholder_files:
        full_path = model_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, 'w') as f:
            f.write(f"# Placeholder for {file_path}\n")
            f.write("# Replace with actual model files for production use\n")
    
    print(f"✅ Mock model structure created at: {model_path}")
    print("\n⚠️  Note: This is a mock model for testing the API.")
    print("    To use actual image generation, download the real ONNX model.")
    
    return True

def download_model(model_id="sd15"):
    """Download a Stable Diffusion ONNX model"""
    if model_id not in MODELS:
        print(f"❌ Unknown model: {model_id}")
        print(f"Available models: {', '.join(MODELS.keys())}")
        return False
    
    model_info = MODELS[model_id]
    model_path = Path("models") / model_id
    
    print(f"\n📦 Model: {model_info['name']}")
    print(f"📝 Description: {model_info['description']}")
    print(f"💾 Size: {model_info['size']}")
    print(f"📂 Destination: {model_path}")
    
    # Check if model already exists
    if model_path.exists() and (model_path / "model_config.json").exists():
        print("\n✅ Model already exists!")
        return True
    
    print("\n⚠️  Note: Downloading the full ONNX model requires ~4GB of disk space")
    print("    and may take some time depending on your internet connection.")
    
    response = input("\nDo you want to:\n1. Download the full model (recommended)\n2. Set up a mock model for testing\n3. Cancel\n\nChoice (1/2/3): ")
    
    if response == "1":
        print("\n🚀 Starting download...")
        print("⚠️  Full model download not yet implemented in this script.")
        print("    Please download the ONNX model manually from:")
        print("    https://huggingface.co/runwayml/stable-diffusion-v1-5-onnx")
        print("\n    Or use the mock model for testing (option 2)")
        return False
    elif response == "2":
        return setup_mock_model(model_id)
    else:
        print("❌ Download cancelled")
        return False

def main():
    print("========================================")
    print("Stable Diffusion Model Downloader")
    print("========================================")
    
    # Change to project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)
    
    # Download default model
    if download_model("sd15"):
        print("\n✅ Model setup complete!")
        print("\nYou can now start the backend server:")
        print("  cd backend && ./sd-backend")
    else:
        print("\n❌ Model setup failed")
        sys.exit(1)

if __name__ == "__main__":
    main()