# AbleRefusal Architecture Documentation

## System Overview

AbleRefusal is a local Stable Diffusion image generation platform with a distributed architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js UI    │────▶│   Go Backend    │────▶│  Python Service │
│   (Port 3000)   │     │   (Port 8080)   │     │   (Port 8001)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        ▼                        ▼
        │                 ┌─────────────┐         ┌─────────────┐
        └────────────────▶│   Queue     │         │   Models    │
                         │   System    │         │   Cache     │
                         └─────────────┘         └─────────────┘
```

## Component Architecture

### 1. Frontend (Next.js + React)
- **Port**: 3000
- **Key Files**:
  - `frontend/web/src/app/page.tsx` - Main UI
  - `frontend/web/src/components/Settings.tsx` - Settings management
  - `frontend/web/src/contexts/SettingsContext.tsx` - Global settings state
- **Features**:
  - Real-time generation progress
  - Settings UI for server configuration
  - Model management interface
  - Image gallery with results

### 2. Backend (Go + Gin)
- **Port**: 8080
- **Key Components**:
  - `backend/cmd/server/main.go` - Entry point, auto-starts Python service
  - `backend/internal/inference/python_manager.go` - Manages Python service lifecycle
  - `backend/internal/inference/python_engine.go` - Client for Python inference API
  - `backend/internal/queue/manager.go` - Queue system for generation requests
- **Responsibilities**:
  - Request queuing and management
  - Python service lifecycle (auto-start/stop)
  - API gateway between frontend and inference
  - Storage management for generated images

### 3. Python Inference Service (FastAPI + Diffusers)
- **Port**: 8001
- **Key Files**:
  - `inference-service/main.py` - FastAPI server
  - `inference-service/inference_engine.py` - Core inference logic
- **Features**:
  - Model loading and caching
  - Image generation with diffusers
  - Support for various samplers
  - LoRA and LCM support

## Critical Model Loading Differences

### SD 1.5 vs SDXL Pipeline Differences

This is a **CRITICAL** distinction that caused our tokenizer issue:

#### SD 1.5 (Stable Diffusion 1.x)
```python
# Uses StableDiffusionPipeline
from diffusers import StableDiffusionPipeline

# Single tokenizer
pipeline.tokenizer  # CLIPTokenizer
pipeline.text_encoder  # CLIPTextModel
pipeline.unet  # UNet2DConditionModel
pipeline.vae  # AutoencoderKL

# Resolution: typically 512x512
```

#### SDXL (Stable Diffusion XL)
```python
# Uses StableDiffusionXLPipeline
from diffusers import StableDiffusionXLPipeline

# DUAL tokenizers and text encoders!
pipeline.tokenizer  # First tokenizer
pipeline.tokenizer_2  # Second tokenizer (IMPORTANT!)
pipeline.text_encoder  # First CLIP model
pipeline.text_encoder_2  # Second CLIP model
pipeline.unet  # Larger UNet model
pipeline.vae  # AutoencoderKL

# Resolution: typically 1024x1024
```

### The Tokenizer Bug We Fixed

**Problem**: SD 1.5 models were being incorrectly loaded as SDXL pipelines, causing tokenizer access issues.

**Root Cause**: The loading strategy tried SDXL first for all models.

**Solution**: Detect SD 1.5 models by name pattern and load with correct pipeline:

```python
# inference_engine.py - Fixed loading strategy
if "stable-diffusion-v1" in model_id or "sd-v1" in model_id.lower():
    # Load as SD 1.5
    strategies = [
        (StableDiffusionPipeline, True, "SD 1.5 with safetensors"),
        ...
    ]
else:
    # Try SDXL first for newer models
    strategies = [
        (StableDiffusionXLPipeline, True, "SDXL with safetensors"),
        ...
    ]
```

## Device Compatibility

### MPS (Mac Metal Performance Shaders)
- **Critical**: MPS requires `torch.float32`, not `float16`
- Automatically detected and configured in our code
- Provides GPU acceleration on Apple Silicon

### CUDA (NVIDIA GPUs)
- Supports both `float16` and `float32`
- Better performance with `float16`

### CPU Fallback
- Works with any precision
- Significantly slower than GPU options

## Configuration Flow

1. **Frontend Settings** (localStorage)
   - Server URLs
   - Default generation parameters
   - UI preferences

2. **Backend Configuration** (`config.yaml`)
   - Server ports and timeouts
   - Storage paths
   - Queue settings
   - Python service URL

3. **Python Service Environment**
   - Model cache directory
   - Output directory
   - Device selection (auto-detected)

## Request Flow for Image Generation

1. **User submits request** → Frontend
2. **Frontend sends to backend** → `/api/v1/generate`
3. **Backend queues request** → Queue Manager
4. **Queue worker picks up job** → Python Engine
5. **Python Engine calls Python service** → `/generate`
6. **Python service**:
   - Loads model if needed
   - Generates image
   - Saves to disk
   - Returns file path
7. **Backend updates job status** → Database/Memory
8. **Frontend polls for status** → Gets completed image

## Timeout Configuration

- **Frontend → Backend**: No explicit timeout (uses browser default)
- **Backend → Python**: 5 minutes (increased from 30s for generation)
- **Python generation**: No timeout (runs to completion)

## Model Storage

Models are cached in:
- `inference-service/models/` - Local cache
- `~/.cache/huggingface/` - System cache

Format: `models--{org}--{model}/snapshots/{hash}/`

### Model Naming Convention

When loading models, use the full HuggingFace model ID:
- ✅ Correct: `runwayml/stable-diffusion-v1-5`
- ❌ Incorrect: `sd15`, `sd1.5`, etc.

The model name must match exactly between:
1. Model loading: `/load-model?model_path=runwayml/stable-diffusion-v1-5`
2. Generation request: `{"model": "runwayml/stable-diffusion-v1-5"}`
3. Frontend default: `model: 'runwayml/stable-diffusion-v1-5'`

## Debugging Tips

### Common Issues and Solutions

1. **"NoneType has no attribute 'tokenize'"**
   - Check if model is loading as correct pipeline type
   - SD 1.5 should NOT load as SDXL

2. **Timeout errors**
   - Increase timeout in `python_engine.go`
   - Check if Python service is actually processing

3. **Model loading failures**
   - Check if using safetensors vs .bin format
   - Verify model exists in cache or can be downloaded

4. **MPS errors on Mac**
   - Ensure using `float32` not `float16`
   - Check PyTorch MPS support

### Log Locations

- Backend logs: Console output or redirect to file
- Python logs: Console output, visible in backend logs
- Frontend logs: Browser console

### Health Checks

- Backend: `GET http://localhost:8080/api/v1/health`
- Python: `GET http://localhost:8001/health`
- Model status: `GET http://localhost:8001/models`

## Future Improvements

1. **Database Integration**: Replace in-memory queue with persistent storage
2. **Model Management UI**: Download models directly from UI
3. **Batch Processing**: Generate multiple images in parallel
4. **LoRA Management**: UI for LoRA selection and weighting
5. **SDXL Support**: Proper dual-encoder support for SDXL models
6. **Performance**: Implement model quantization for faster inference