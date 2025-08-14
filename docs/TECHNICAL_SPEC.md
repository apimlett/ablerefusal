# AbleRefusal Technical Specification

## Overview

AbleRefusal is a decoupled, cross-platform Stable Diffusion platform that separates backend inference from frontend interfaces. The system uses a Go backend for API management and queue handling, with a Python FastAPI service for actual model inference using the diffusers library.

## Architecture

### System Components

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (React/Next.js)              │
│  - Web UI with generation interface                       │
│  - Settings management                                    │
│  - Real-time updates via polling                          │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP/REST API
┌────────────────────────▼─────────────────────────────────┐
│                  Backend (Go with Gin)                    │
│  - REST API endpoints                                     │
│  - Queue management                                       │
│  - Static file serving                                    │
│  - Python service lifecycle management                    │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼─────────────────────────────────┐
│           Python Inference Service (FastAPI)              │
│  - Model loading (Hugging Face diffusers)                 │
│  - Image generation pipeline                              │
│  - SD 1.5 and SDXL support                               │
│  - GPU acceleration (CUDA/MPS)                           │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Backend**: Go 1.21+ with Gin framework
- **Inference**: Python 3.10+ with FastAPI and diffusers
- **Frontend**: React 18 with TypeScript, Next.js 14
- **Model Format**: PyTorch Safetensors (native Hugging Face format)
- **API**: RESTful with JSON payloads

## Core Features

### Model Management
- Direct loading of Stable Diffusion checkpoints from Hugging Face
- Support for both SD 1.5 and SDXL models
- Automatic model detection and appropriate pipeline selection
- Model caching for faster subsequent loads

### Generation Capabilities
- Text-to-image generation with customizable parameters
- Batch generation support
- Multiple sampling methods (Euler A, DPM++, DDIM, etc.)
- Negative prompt support
- Seed control for reproducibility

### API Endpoints

#### Health & Status
- `GET /api/v1/health` - Service health check
- `GET /api/v1/ready` - Readiness probe

#### Generation
- `POST /api/v1/generate` - Submit generation request
- `GET /api/v1/generate/:id` - Get generation status
- `POST /api/v1/generate/:id/cancel` - Cancel generation
- `GET /api/v1/queue` - Get queue status

#### Models
- `GET /api/v1/models` - List available models

#### Static Files
- `GET /outputs/*` - Serve generated images

## Generation Parameters

### Required Parameters
- `prompt` (string): Text description of desired image
- `width` (int): Image width (64-2048, multiples of 8)
- `height` (int): Image height (64-2048, multiples of 8)

### Optional Parameters
- `negative_prompt` (string): What to avoid in generation
- `steps` (int): Number of denoising steps (1-150, default: 20)
- `cfg_scale` (float): Classifier-free guidance scale (1.0-30.0, default: 7.5)
- `sampler` (string): Sampling method (default: "euler_a")
- `seed` (int): Random seed (-1 for random, default: -1)
- `batch_size` (int): Number of images to generate (1-4, default: 1)
- `model` (string): Model ID to use

## Data Flow

1. **Request Submission**
   - User submits generation request via frontend
   - Frontend sends POST to `/api/v1/generate`
   - Backend validates and queues request

2. **Processing**
   - Backend forwards request to Python service
   - Python service loads model if needed
   - Inference pipeline generates images
   - Progress updates sent during generation

3. **Result Delivery**
   - Generated images saved to `backend/outputs/`
   - Backend returns image URLs
   - Frontend displays results

## Configuration

### Backend Configuration (config.yaml)
```yaml
server:
  host: localhost
  port: 8080
  enable_cors: true

inference:
  python_service_url: http://localhost:8001
  device: cpu  # or gpu
  max_batch_size: 4

storage:
  output_dir: ./outputs
  models_dir: ./models
```

### Python Service Configuration
- Auto-detects GPU availability (CUDA/MPS)
- Falls back to CPU if GPU unavailable
- Configurable model cache directory
- Memory optimization settings

## Performance Considerations

### GPU Acceleration
- CUDA support for NVIDIA GPUs
- MPS support for Apple Silicon
- Automatic dtype optimization (float16 for CUDA, float32 for MPS)

### Memory Management
- Model offloading when not in use
- Attention slicing for large images
- VAE tiling for memory-constrained systems

### Queue Management
- FIFO processing with priority support
- Concurrent request limiting
- Timeout handling
- Graceful cancellation

## Security

### Input Validation
- Prompt length limits
- Parameter range validation
- File type restrictions
- Path traversal prevention

### CORS Configuration
- Configurable allowed origins
- Credential support
- Method and header restrictions

## Error Handling

### Common Errors
- Model not found: Returns 404 with model list
- Invalid parameters: Returns 400 with validation details
- Generation failure: Returns 500 with error message
- Timeout: Returns 408 with partial results if available

### Recovery Mechanisms
- Automatic Python service restart on crash
- Request retry with exponential backoff
- Fallback to CPU on GPU failure
- Queue persistence across restarts

## Future Enhancements

### Planned Features
- LoRA support for model customization
- ControlNet integration
- Inpainting and outpainting
- Image-to-image generation
- Real-time progress via WebSocket
- Multi-GPU support
- Distributed inference

### Optimization Opportunities
- Model quantization (int8/int4)
- Compilation with torch.compile()
- Dynamic batching
- Request coalescing
- CDN integration for outputs

## Development Guidelines

### Code Organization
```
ablerefusal/
├── backend/           # Go API server
├── inference-service/ # Python inference
├── frontend/web/      # React web UI
└── docs/             # Documentation
```

### Testing Strategy
- Unit tests for API handlers
- Integration tests for generation pipeline
- Performance benchmarks
- Load testing for queue management

### Deployment
- Docker containers for each service
- Kubernetes manifests for orchestration
- Environment-based configuration
- Health checks and monitoring

## API Examples

### Submit Generation Request
```bash
curl -X POST http://localhost:8080/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful sunset over mountains",
    "width": 512,
    "height": 512,
    "steps": 20,
    "cfg_scale": 7.5
  }'
```

### Check Generation Status
```bash
curl http://localhost:8080/api/v1/generate/{job_id}
```

### Response Format
```json
{
  "id": "uuid",
  "status": "completed",
  "progress": 100,
  "results": [
    {
      "image_url": "/outputs/image.png",
      "seed": 12345,
      "metadata": {...}
    }
  ]
}
```