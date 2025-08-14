# AbleRefusal

A high-performance, local Stable Diffusion image generation platform with a beautiful Palenight-themed interface. Generate stunning AI images on your machine with an easy-to-use interface.

## Features

### MVP Features (Current)
- 🎨 Text-to-image generation using Stable Diffusion
- 🚀 Fast ONNX Runtime inference (no Python required)
- 🖥️ Clean web interface with real-time progress
- 📦 Single binary deployment
- 🔧 Simple configuration system
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
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space for models
- NVIDIA GPU with 4GB+ VRAM (recommended) or CPU
- ONNX Runtime library (optional, for real inference)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ablerefusal.git
cd ablerefusal
```

#### 2. Install ONNX Runtime (Optional, for Real Inference)

For now, AbleRefusal runs with mock generation. To enable real Stable Diffusion inference:

**macOS:**
```bash
# Using Homebrew
brew install onnxruntime

# Or download directly
curl -L -o onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-osx-arm64-1.16.3.tgz
tar -xzf onnxruntime.tgz
# Follow instructions to install the library
```

**Linux:**
```bash
# Ubuntu/Debian
wget https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-linux-x64-1.16.3.tgz
tar -xzf onnxruntime-linux-x64-1.16.3.tgz
sudo cp onnxruntime-linux-x64-1.16.3/lib/* /usr/local/lib/
sudo ldconfig
```

**Windows:**
Download from [ONNX Runtime Releases](https://github.com/microsoft/onnxruntime/releases) and add to PATH.

#### 3. Download a Stable Diffusion Model (For Real Inference)

**Note:** This step is only needed if you have ONNX Runtime installed and want real image generation.

```bash
# Create models directory
mkdir -p backend/models/sd15

# Download a pre-converted ONNX model
# You'll need to convert a model or find a pre-converted one
# See the Model Conversion section below for details
```

### Model Conversion (For Real Inference)

To convert a Stable Diffusion model to ONNX format:

```bash
# Install Python dependencies
pip install torch transformers diffusers onnx onnxruntime optimum

# Convert using Optimum
python -c "
from optimum.onnxruntime import ORTStableDiffusionPipeline

# Export model to ONNX
model_id = 'runwayml/stable-diffusion-v1-5'
export_dir = './backend/models/sd15'

pipeline = ORTStableDiffusionPipeline.from_pretrained(model_id, export=True)
pipeline.save_pretrained(export_dir)
print(f'Model exported to {export_dir}')
"
```

#### 3. Build and Start the Backend

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

#### 5. Generate Your First Image

1. Open your browser and navigate to http://localhost:3000
2. You'll see the beautiful Palenight-themed interface
3. Enter a prompt, for example: "a beautiful sunset over mountains, highly detailed, digital art"
4. Adjust settings (optional):
   - Steps: 20-50 (higher = better quality, slower)
   - Width/Height: 512x512 (default)
   - CFG Scale: 7.5 (how closely to follow the prompt)
5. Click "Generate"
6. Watch the real-time progress bar
7. Your generated image will appear below!

**Note:** Without ONNX Runtime installed, the app generates colorful gradient placeholder images based on your prompt. Install ONNX Runtime and download models to enable real AI image generation.

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
  device: gpu  # or "cpu"
  max_batch_size: 1
  max_resolution: 1024

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
├── backend/               # Go backend server
│   ├── cmd/              # Application entrypoints
│   ├── internal/         # Internal packages
│   ├── models/           # Model storage
│   ├── outputs/          # Generated images
│   └── config.yaml       # Configuration
├── frontend/             # Frontend applications
│   └── web/             # Next.js web app with Palenight theme
├── docs/                # Documentation
│   ├── spec.md          # Original specification
│   ├── CLAUDE.md        # Development guidelines
│   └── MVP_ROADMAP.md   # Roadmap
└── scripts/             # Utility scripts
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

#### "ONNX Runtime not available" warning
- This is expected if ONNX Runtime is not installed
- The app will use mock generation (gradient images)
- Install ONNX Runtime to enable real AI image generation

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