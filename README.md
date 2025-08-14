# AbleRefusal

A high-performance, local Stable Diffusion image generation platform with full support for Hugging Face models, LoRAs, and advanced samplers. Features a beautiful Palenight-themed interface and supports models from Hugging Face (UK-accessible alternative to Civitai).

## Features

### MVP Features (Current)
- 🎨 Text-to-image generation using Stable Diffusion
- 🚀 Full diffusers support with Python inference service
- 📦 Support for safetensors/ckpt models from Hugging Face
- 🎭 Dynamic LoRA loading and blending
- ⚡ LCM (Latent Consistency Models) support
- 🎯 DPM++ 2M and advanced samplers
- 🖥️ Clean web interface with real-time progress
- 💾 Automatic output management

### Coming Soon
- 🖼️ Image-to-image generation
- 🎭 LoRA and textual inversion support
- 🎯 ControlNet integration
- 🔄 Multiple model support
- 🖥️ Desktop application (Tauri)
- 🔌 Plugin system

## Quick Start

### Prerequisites

- Go 1.21 or higher
- Node.js 18 or higher
- Python 3.10 or higher
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space for models
- NVIDIA GPU with 4GB+ VRAM (recommended) or CPU with MPS (Mac) support

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ablerefusal.git
cd ablerefusal
```

#### 2. Set up Python Inference Service

```bash
# Navigate to inference service directory
cd inference-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

#### 3. Download Models from Hugging Face

Since Civitai is not accessible from the UK, we provide easy access to models from Hugging Face:

```bash
# List available models
python download_models.py --list

# Download Stable Diffusion 1.5
python download_models.py --model sd15

# Download DreamShaper (popular community model)
python download_models.py --model dreamshaper

# Download LCM model for fast generation
python download_models.py --model lcm

# Download multiple basic models
python download_models.py --all-basic
```

**Popular Models Available:**
- `sd15` - Stable Diffusion 1.5 (base model)
- `dreamshaper` - High quality artistic model
- `realistic-vision` - Photorealistic model
- `openjourney` - Midjourney-style model
- `sdxl` - Stable Diffusion XL (higher quality, needs more VRAM)
- `lcm` - Latent Consistency Model (4-8 steps generation)
- `anything-v5` - Anime/manga style

#### 4. Start the Python Inference Service

```bash
# In the inference-service directory with venv activated
python main.py

# The inference service will start on http://localhost:8001
```

#### 5. Build and Start the Go Backend

```bash
# Navigate to backend directory
cd backend

# Install Go dependencies
go mod download

# Build the server
go build -o ablerefusal-backend cmd/server/main.go

# Run the server
./ablerefusal-backend

# The server will start on http://localhost:8080
```

#### 4. Start the Frontend

Open a new terminal window:

```bash
# Navigate to frontend directory
cd frontend/web

# Install dependencies
npm install

# Start development server
npm run dev

# The UI will be available at http://localhost:3000
```

#### 7. Generate Your First Image

1. Open your browser and navigate to http://localhost:3000
2. You'll see the beautiful Palenight-themed interface
3. Enter a prompt, for example: "a beautiful sunset over mountains, highly detailed, digital art"
4. Adjust settings:
   - **Sampler**: DPM++ 2M Karras (recommended) or LCM for fast generation
   - **Steps**: 20-50 for normal, 4-8 for LCM
   - **Width/Height**: 512x512 (SD1.5) or 1024x1024 (SDXL)
   - **CFG Scale**: 7.5 (how closely to follow the prompt)
5. Click "Generate"
6. Watch the real-time progress bar
7. Your AI-generated image will appear below!

**Using LoRAs:**
Place LoRA files in `inference-service/models/loras/` and they'll be available for selection in the UI.

## Configuration

### Backend Configuration

Edit `backend/config.yaml`:

```yaml
server:
  host: localhost
  port: 8080
  enable_cors: true

storage:
  output_dir: ./outputs
  models_dir: ./models
  temp_dir: ./temp

models:
  default: sd15
  available:
    - name: sd15
      path: ./models/sd15
      type: onnx
      version: 1.5

inference:
  device: gpu  # or "cpu" or "mps" for Mac
  max_batch_size: 1
  max_resolution: 1024
  python_service_url: http://localhost:8001

queue:
  max_concurrent: 1
  timeout: 300
```

### Frontend Configuration

Edit `frontend/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

## API Documentation

### Generate Image

```bash
POST /api/v1/generate
Content-Type: application/json

{
  "prompt": "a beautiful landscape",
  "negative_prompt": "ugly, blurry",
  "width": 512,
  "height": 512,
  "steps": 30,
  "cfg_scale": 7.5,
  "seed": -1,
  "sampler": "euler_a"
}

Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

### Check Generation Status

```bash
GET /api/v1/generate/{id}

Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "result": {
    "image_path": "/outputs/550e8400-e29b-41d4-a716-446655440000.png",
    "seed": 123456789,
    "metadata": {
      "prompt": "a beautiful landscape",
      "steps": 30,
      "cfg_scale": 7.5
    }
  }
}
```

## Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build backend
docker build -t ablerefusal-backend ./backend

# Build frontend
docker build -t ablerefusal-frontend ./frontend/web

# Run backend
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/backend/models:/app/models \
  -v $(pwd)/backend/outputs:/app/outputs \
  ablerefusal-backend

# Run frontend
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8080 \
  ablerefusal-frontend
```

## Development

### Project Structure

```
ablerefusal/
├── backend/               # Go backend server (API & queue management)
│   ├── cmd/              # Application entrypoints
│   ├── internal/         # Internal packages
│   ├── outputs/          # Generated images
│   └── config.yaml       # Configuration
├── inference-service/    # Python inference service
│   ├── main.py          # FastAPI server
│   ├── inference_engine.py # Diffusers implementation
│   ├── download_models.py # Model downloader
│   ├── models/          # Model storage
│   └── requirements.txt # Python dependencies
├── frontend/             # Frontend applications
│   └── web/             # Next.js web app with Palenight theme
└── docs/                # Documentation
```

### Running Tests

```bash
# Backend tests
cd backend
go test ./...

# Frontend tests
cd frontend/web
npm test

# E2E tests
npm run test:e2e
```

### Building for Production

```bash
# Build all platforms
./scripts/build-all.sh

# Build specific platform
./scripts/build.sh windows
./scripts/build.sh macos
./scripts/build.sh linux
```

## Model Management

### Supported Models

- Stable Diffusion 1.5
- Stable Diffusion 2.1 (coming soon)
- SDXL (coming soon)
- Custom fine-tuned models

### Adding New Models

1. Download or convert model to ONNX format
2. Place in `models/` directory
3. Add configuration to `config.yaml`
4. Restart the backend server

### Model Conversion

```bash
# Convert from Hugging Face
python scripts/convert_model.py \
  --model_id "stabilityai/stable-diffusion-2-1" \
  --output_path "./models/sd21"

# Convert from local checkpoint
python scripts/convert_model.py \
  --checkpoint_path "./path/to/model.ckpt" \
  --output_path "./models/custom"
```

## Troubleshooting

### Common Issues

#### "Python inference service not available" warning
- Ensure the Python service is running on port 8001
- Check that all Python dependencies are installed
- The app will use mock generation if Python service is down

#### "Model not found" error
- Ensure the model is downloaded and extracted to the correct directory
- Check the model path in `config.yaml`
- Verify file permissions

#### Slow generation on CPU
- This is normal; CPU inference is 10-50x slower than GPU
- Consider using smaller models or fewer steps
- Upgrade to a CUDA-capable GPU for better performance

#### Out of memory errors
- Reduce batch size to 1
- Lower the resolution (use 512x512 instead of larger)
- Close other applications to free RAM/VRAM

#### Frontend can't connect to backend
- Verify the backend is running on the correct port
- Check firewall settings
- Ensure CORS is enabled in backend config

### Getting Help

- 📖 [Documentation](https://github.com/ablerefusal/ablerefusal/wiki)
- 🐛 [Report Issues](https://github.com/ablerefusal/ablerefusal/issues)
- 💡 [Feature Requests](https://github.com/ablerefusal/ablerefusal/discussions)
- 🤗 [Hugging Face Models](https://huggingface.co/models?library=diffusers&sort=downloads)

## Performance Tips

### GPU Acceleration

- Install CUDA 11.8+ for NVIDIA GPUs
- Install ROCm for AMD GPUs
- Use `nvidia-smi` to monitor GPU usage

### Optimization Settings

```yaml
# For faster generation (lower quality)
steps: 20
cfg_scale: 7

# For higher quality (slower)
steps: 50
cfg_scale: 10

# For photorealism
sampler: "dpm++_2m"
steps: 30
cfg_scale: 8
```

### Memory Management

- Enable model caching for multiple generations
- Use lower precision (fp16) for reduced memory usage
- Implement batch processing for multiple prompts

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/yourusername/ablerefusal.git

# Create a feature branch
git checkout -b feature/your-feature

# Make changes and test
go test ./...
npm test

# Submit a pull request
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Stable Diffusion by Stability AI
- ONNX Runtime by Microsoft
- React and Next.js communities
- All our contributors and users

## Roadmap

See our [detailed roadmap](docs/MVP_ROADMAP.md) for upcoming features:

- ✅ MVP: Basic text-to-image generation
- 🚧 Image-to-image and inpainting
- 📅 LoRA and textual inversion support
- 📅 ControlNet integration
- 📅 Node-based workflow editor
- 📅 Plugin system
- 📅 Multi-user support

---

**Ready to generate amazing images?** Follow the Quick Start guide above and create your first AI image in minutes!