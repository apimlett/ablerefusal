# Stable Diffusion Platform - Technical Specification

## Project Overview

A decoupled, cross-platform Stable Diffusion platform designed for easy deployment, extensibility, and portability. The architecture separates the backend inference engine from frontend interfaces, enabling multiple UI implementations and deployment scenarios.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│ Frontend Layer (Interchangeable)        │
├─────────────────────────────────────────┤
│ • Tauri Desktop App (React)            │
│ • Web Interface (Next.js)              │
│ • CLI Interface                        │
│ • API Documentation (OpenAPI)          │
└─────────────────────────────────────────┘
                    │
                    │ HTTP/WebSocket API
                    ▼
┌─────────────────────────────────────────┐
│ Backend Core (Go)                       │
├─────────────────────────────────────────┤
│ • REST API Server                       │
│ • WebSocket Manager                     │
│ • Generation Queue                      │
│ • Model Manager                         │
│ • Plugin System                         │
│ • Configuration Manager                 │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Inference Engine                        │
├─────────────────────────────────────────┤
│ • ONNX Runtime Integration              │
│ • GPU Detection & Optimization         │
│ • Memory Management                     │
│ • Model Caching                         │
└─────────────────────────────────────────┘
```

## Directory Structure

```
stable-diffusion-platform/
├── README.md
├── LICENSE
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── build.yml
│       ├── test.yml
│       └── release.yml
├── docs/
│   ├── api/
│   ├── deployment/
│   └── development/
├── backend/
│   ├── cmd/
│   │   ├── server/
│   │   │   └── main.go
│   │   └── cli/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   │   ├── handlers/
│   │   │   ├── middleware/
│   │   │   └── routes/
│   │   ├── config/
│   │   ├── models/
│   │   ├── queue/
│   │   ├── inference/
│   │   ├── plugins/
│   │   └── utils/
│   ├── pkg/
│   │   ├── onnx/
│   │   ├── gpu/
│   │   └── storage/
│   ├── go.mod
│   ├── go.sum
│   ├── Dockerfile
│   └── scripts/
├── frontend/
│   ├── desktop/           # Tauri application
│   │   ├── src-tauri/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tauri.conf.json
│   ├── web/              # Next.js web application
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── next.config.js
│   └── shared/           # Shared components and utilities
│       ├── components/
│       ├── hooks/
│       ├── types/
│       └── api/
├── models/
│   ├── base/
│   ├── loras/
│   ├── embeddings/
│   └── configs/
├── plugins/
│   ├── examples/
│   └── specs/
├── scripts/
│   ├── build/
│   ├── install/
│   └── dev/
└── releases/
    ├── windows/
    ├── macos/
    └── linux/
```

## Backend Specification (Go)

### Core Dependencies

```go
// go.mod
module github.com/username/stable-diffusion-platform

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/gorilla/websocket v1.5.1
    github.com/spf13/cobra v1.8.0
    github.com/spf13/viper v1.18.2
    github.com/google/uuid v1.5.0
    github.com/sirupsen/logrus v1.9.3
    github.com/swaggo/gin-swagger v1.6.0
    github.com/swaggo/files v1.0.1
    github.com/swaggo/swag v1.16.2
    gorm.io/gorm v1.25.5
    gorm.io/driver/sqlite v1.5.4
)
```

### API Endpoints

#### Generation API
```yaml
# OpenAPI 3.0 Specification
/api/v1/generate:
  post:
    summary: Generate image from text prompt
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/GenerationRequest'
    responses:
      202:
        description: Generation queued
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QueueItem'

/api/v1/generate/{id}:
  get:
    summary: Get generation status
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Generation status
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GenerationStatus'

/api/v1/generate/{id}/cancel:
  post:
    summary: Cancel generation
    responses:
      200:
        description: Generation cancelled
```

#### Model Management API
```yaml
/api/v1/models:
  get:
    summary: List available models
    responses:
      200:
        description: List of models
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/Model'

/api/v1/models/install:
  post:
    summary: Install new model
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ModelInstallRequest'

/api/v1/models/{id}:
  delete:
    summary: Uninstall model
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
```

### Data Models

```go
// internal/models/generation.go
type GenerationRequest struct {
    ID          string            `json:"id" gorm:"primaryKey"`
    Prompt      string            `json:"prompt" validate:"required,min=1,max=1000"`
    NegPrompt   string            `json:"negative_prompt"`
    Model       string            `json:"model" validate:"required"`
    LoRAs       []LoRAConfig      `json:"loras"`
    Width       int               `json:"width" validate:"min=64,max=2048"`
    Height      int               `json:"height" validate:"min=64,max=2048"`
    Steps       int               `json:"steps" validate:"min=1,max=150"`
    CFGScale    float64           `json:"cfg_scale" validate:"min=1,max=30"`
    Seed        int64             `json:"seed"`
    BatchSize   int               `json:"batch_size" validate:"min=1,max=10"`
    Sampler     string            `json:"sampler"`
    CreatedAt   time.Time         `json:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at"`
}

type LoRAConfig struct {
    Name     string  `json:"name" validate:"required"`
    Weight   float64 `json:"weight" validate:"min=-2,max=2"`
}

type GenerationStatus struct {
    ID          string                 `json:"id"`
    Status      GenerationStatusType   `json:"status"`
    Progress    float64                `json:"progress"`
    CurrentStep int                    `json:"current_step"`
    TotalSteps  int                    `json:"total_steps"`
    Results     []GenerationResult     `json:"results,omitempty"`
    Error       string                 `json:"error,omitempty"`
    StartedAt   *time.Time             `json:"started_at,omitempty"`
    CompletedAt *time.Time             `json:"completed_at,omitempty"`
}

type GenerationStatusType string

const (
    StatusQueued     GenerationStatusType = "queued"
    StatusProcessing GenerationStatusType = "processing"
    StatusCompleted  GenerationStatusType = "completed"
    StatusFailed     GenerationStatusType = "failed"
    StatusCancelled  GenerationStatusType = "cancelled"
)

type GenerationResult struct {
    ImagePath string            `json:"image_path"`
    Seed      int64             `json:"seed"`
    Metadata  map[string]string `json:"metadata"`
}

// internal/models/model.go
type Model struct {
    ID          string      `json:"id" gorm:"primaryKey"`
    Name        string      `json:"name"`
    Type        ModelType   `json:"type"`
    Version     string      `json:"version"`
    Description string      `json:"description"`
    FilePath    string      `json:"file_path"`
    FileSize    int64       `json:"file_size"`
    Hash        string      `json:"hash"`
    IsActive    bool        `json:"is_active"`
    CreatedAt   time.Time   `json:"created_at"`
    UpdatedAt   time.Time   `json:"updated_at"`
}

type ModelType string

const (
    ModelTypeCheckpoint ModelType = "checkpoint"
    ModelTypeLoRA       ModelType = "lora"
    ModelTypeEmbedding  ModelType = "embedding"
    ModelTypeVAE        ModelType = "vae"
)
```

### Core Services

```go
// internal/queue/manager.go
type QueueManager interface {
    Enqueue(req *models.GenerationRequest) error
    Dequeue() (*models.GenerationRequest, error)
    Cancel(id string) error
    GetStatus(id string) (*models.GenerationStatus, error)
    GetQueue() ([]*models.GenerationRequest, error)
    UpdateProgress(id string, progress float64, step int) error
}

// internal/inference/engine.go
type InferenceEngine interface {
    Initialize(config *Config) error
    LoadModel(modelPath string) error
    Generate(ctx context.Context, req *models.GenerationRequest, progressCallback func(float64, int)) ([]*models.GenerationResult, error)
    GetLoadedModels() []string
    GetCapabilities() *Capabilities
}

// internal/api/handlers/generation.go
type GenerationHandler struct {
    queue  queue.QueueManager
    engine inference.InferenceEngine
    logger *logrus.Logger
}

func (h *GenerationHandler) Generate(c *gin.Context) {
    var req models.GenerationRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    req.ID = uuid.New().String()
    req.CreatedAt = time.Now()
    
    if err := h.queue.Enqueue(&req); err != nil {
        c.JSON(500, gin.H{"error": "Failed to queue generation"})
        return
    }
    
    c.JSON(202, gin.H{"id": req.ID, "status": "queued"})
}
```

### Configuration

```go
// internal/config/config.go
type Config struct {
    Server   ServerConfig   `mapstructure:"server"`
    Storage  StorageConfig  `mapstructure:"storage"`
    Models   ModelsConfig   `mapstructure:"models"`
    Queue    QueueConfig    `mapstructure:"queue"`
    Logging  LoggingConfig  `mapstructure:"logging"`
    Plugins  PluginsConfig  `mapstructure:"plugins"`
}

type ServerConfig struct {
    Host         string `mapstructure:"host" default:"localhost"`
    Port         int    `mapstructure:"port" default:"8080"`
    ReadTimeout  int    `mapstructure:"read_timeout" default:"30"`
    WriteTimeout int    `mapstructure:"write_timeout" default:"30"`
    EnableCORS   bool   `mapstructure:"enable_cors" default:"true"`
}

type StorageConfig struct {
    OutputDir   string `mapstructure:"output_dir" default:"./outputs"`
    ModelsDir   string `mapstructure:"models_dir" default:"./models"`
    TempDir     string `mapstructure:"temp_dir" default:"./temp"`
    MaxFileSize int64  `mapstructure:"max_file_size" default:"10737418240"` // 10GB
}
```

## Frontend Specification (React + Tauri)

### Desktop Application (Tauri)

```json
// frontend/desktop/package.json
{
  "name": "stable-diffusion-desktop",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "react-query": "^3.39.3",
    "@tauri-apps/api": "^1.5.3",
    "@tailwindcss/forms": "^0.5.7",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.303.0",
    "socket.io-client": "^4.7.4",
    "zustand": "^4.4.7",
    "react-hook-form": "^7.48.2",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.2"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.8",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.0.2",
    "vite": "^5.0.0"
  }
}
```

```json
// frontend/desktop/src-tauri/tauri.conf.json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist",
    "withGlobalTauri": false
  },
  "package": {
    "productName": "Stable Diffusion Platform",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      },
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "exists": true
      },
      "path": {
        "all": true
      },
      "dialog": {
        "all": false,
        "open": true,
        "save": true
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.sdplatform.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "Stable Diffusion Platform",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  }
}
```

### React Components Structure

```typescript
// frontend/shared/types/api.ts
export interface GenerationRequest {
  prompt: string;
  negative_prompt?: string;
  model: string;
  loras?: LoRAConfig[];
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  seed?: number;
  batch_size: number;
  sampler: string;
}

export interface LoRAConfig {
  name: string;
  weight: number;
}

export interface GenerationStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: number;
  total_steps: number;
  results?: GenerationResult[];
  error?: string;
  started_at?: string;
  completed_at?: string;
}

// frontend/shared/api/client.ts
export class SDApiClient {
  private baseUrl: string;
  private socket?: Socket;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async generate(request: GenerationRequest): Promise<{ id: string; status: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async getStatus(id: string): Promise<GenerationStatus> {
    const response = await fetch(`${this.baseUrl}/api/v1/generate/${id}`);
    return response.json();
  }

  connectWebSocket(onProgress: (status: GenerationStatus) => void) {
    this.socket = io(`${this.baseUrl}/api/v1/ws`);
    this.socket.on('progress', onProgress);
    return this.socket;
  }
}
```

```tsx
// frontend/shared/components/GenerationForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const generationSchema = z.object({
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().optional(),
  model: z.string().min(1),
  width: z.number().min(64).max(2048),
  height: z.number().min(64).max(2048),
  steps: z.number().min(1).max(150),
  cfg_scale: z.number().min(1).max(30),
  seed: z.number().optional(),
  batch_size: z.number().min(1).max(10),
  sampler: z.string(),
});

type GenerationFormData = z.infer<typeof generationSchema>;

interface GenerationFormProps {
  onSubmit: (data: GenerationFormData) => void;
  isLoading: boolean;
}

export const GenerationForm: React.FC<GenerationFormProps> = ({
  onSubmit,
  isLoading,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerationFormData>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      width: 512,
      height: 512,
      steps: 20,
      cfg_scale: 7.5,
      batch_size: 1,
      sampler: 'euler_a',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Prompt
        </label>
        <textarea
          {...register('prompt')}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          rows={3}
          placeholder="Describe the image you want to generate..."
        />
        {errors.prompt && (
          <p className="mt-1 text-sm text-red-600">{errors.prompt.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Width
          </label>
          <input
            type="number"
            {...register('width', { valueAsNumber: true })}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Height
          </label>
          <input
            type="number"
            {...register('height', { valueAsNumber: true })}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Generating...' : 'Generate'}
      </button>
    </form>
  );
};
```

## Build and Deployment

### Cross-Platform Build Scripts

```bash
#!/bin/bash
# scripts/build/build-all.sh

set -e

echo "Building backend for all platforms..."

# Backend builds
cd backend
GOOS=windows GOARCH=amd64 go build -o ../releases/windows/sd-backend.exe ./cmd/server
GOOS=linux GOARCH=amd64 go build -o ../releases/linux/sd-backend ./cmd/server
GOOS=darwin GOARCH=amd64 go build -o ../releases/macos/sd-backend ./cmd/server
GOOS=darwin GOARCH=arm64 go build -o ../releases/macos-arm64/sd-backend ./cmd/server

echo "Building frontend..."

# Desktop app builds
cd ../frontend/desktop
npm run tauri build

# Web app build
cd ../web
npm run build

echo "Creating installers..."
cd ../../scripts/install
./create-installers.sh
```

### GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    - name: Run tests
      run: |
        cd backend
        go test ./...

  build:
    needs: test
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        
    - name: Install Rust
      uses: dtolnay/rust-toolchain@stable
      
    - name: Install Tauri CLI
      run: npm install -g @tauri-apps/cli
      
    - name: Build backend
      run: |
        cd backend
        go build -o sd-backend ./cmd/server
        
    - name: Build frontend
      run: |
        cd frontend/desktop
        npm install
        npm run tauri build
        
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-${{ matrix.os }}
        path: |
          backend/sd-backend*
          frontend/desktop/src-tauri/target/release/bundle/
```

### Docker Configuration

```dockerfile
# backend/Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o sd-backend ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/sd-backend .
COPY --from=builder /app/config.yaml .

EXPOSE 8080
CMD ["./sd-backend"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    volumes:
      - ./models:/app/models
      - ./outputs:/app/outputs
    environment:
      - CONFIG_PATH=/app/config.yaml
    restart: unless-stopped
    
  frontend:
    build:
      context: ./frontend/web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080
    depends_on:
      - backend
    restart: unless-stopped
```

## Plugin System

### Plugin Interface

```go
// internal/plugins/interface.go
type Plugin interface {
    Name() string
    Version() string
    Initialize(config map[string]interface{}) error
    Shutdown() error
}

type PreprocessorPlugin interface {
    Plugin
    PreprocessRequest(req *models.GenerationRequest) (*models.GenerationRequest, error)
}

type PostprocessorPlugin interface {
    Plugin
    PostprocessResult(result *models.GenerationResult) (*models.GenerationResult, error)
}

type ModelPlugin interface {
    Plugin
    LoadModel(path string) error
    Generate(ctx context.Context, req *models.GenerationRequest) ([]*models.GenerationResult, error)
}
```

### Example Plugin

```go
// plugins/examples/upscaler/main.go
package main

import (
    "context"
    "github.com/username/stable-diffusion-platform/internal/models"
    "github.com/username/stable-diffusion-platform/internal/plugins"
)

type UpscalerPlugin struct {
    config map[string]interface{}
}

func (p *UpscalerPlugin) Name() string {
    return "Real-ESRGAN Upscaler"
}

func (p *UpscalerPlugin) Version() string {
    return "1.0.0"
}

func (p *UpscalerPlugin) Initialize(config map[string]interface{}) error {
    p.config = config
    return nil
}

func (p *UpscalerPlugin) PostprocessResult(result *models.GenerationResult) (*models.GenerationResult, error) {
    // Upscale the generated image
    upscaledPath, err := p.upscaleImage(result.ImagePath)
    if err != nil {
        return result, err
    }
    
    result.ImagePath = upscaledPath
    result.Metadata["upscaled"] = "true"
    return result, nil
}

func NewPlugin() plugins.PostprocessorPlugin {
    return &UpscalerPlugin{}
}
```

## Installation and Setup

### One-Click Installer Script

```bash
#!/bin/bash
# scripts/install/install.sh

set -e

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
    x86_64) ARCH="amd64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

BINARY_NAME="sd-backend"
if [ "$PLATFORM" = "windows" ]; then
    BINARY_NAME="sd-backend.exe"
fi

INSTALL_DIR="$HOME/.sd-platform"
BIN_DIR="$INSTALL_DIR/bin"
MODELS_DIR="$INSTALL_DIR/models"

echo "Installing Stable Diffusion Platform..."
echo "Platform: $PLATFORM"
echo "Architecture: $ARCH"

# Create directories
mkdir -p "$BIN_DIR" "$MODELS_DIR"

# Download binary
DOWNLOAD_URL="https://github.com/username/stable-diffusion-platform/releases/latest/download/sd-backend-$PLATFORM-$ARCH"
if [ "$PLATFORM" = "windows" ]; then
    DOWNLOAD_URL="$DOWNLOAD_URL.exe"
fi

echo "Downloading from $DOWNLOAD_URL..."
curl -L -o "$BIN_DIR/$BINARY_NAME" "$DOWNLOAD_URL"
chmod +x "$BIN_DIR/$BINARY_NAME"

# Create config file
cat > "$INSTALL_DIR/config.yaml" << EOF
server:
  host: localhost
  port: 8080
  
storage:
  output_dir: $INSTALL_DIR/outputs
  models_dir: $INSTALL_DIR/models
  temp_dir: $INSTALL_DIR/temp

logging:
  level: info
  file: $INSTALL_DIR/logs/app.log
EOF

# Add to PATH
if ! echo "$PATH" | grep -q "$BIN_DIR"; then
    echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$HOME/.bashrc"
fi

echo "Installation complete!"
echo "Run 'sd-backend' to start the server"
echo "Models directory: $MODELS_DIR"
```

## Testing Strategy

### Backend Tests

```go
// backend/internal/api/handlers/generation_test.go
func TestGenerationHandler_Generate(t *testing.T) {
    tests := []struct {
        name           string
        requestBody    interface{}
        expectedStatus int
        expectedError  string
    }{
        {
            name: "valid request",
            requestBody: models.GenerationRequest{
                Prompt: "test prompt",
                Model:  "test-model",
                Width:  512,
                Height: 512,
                Steps:  20,
            },
            expectedStatus: 202,
        },
        {
            name: "missing prompt",
            requestBody: models.GenerationRequest{
                Model:  "test-model",
                Width:  512,
                Height: 512,
            },
            expectedStatus: 400,
            expectedError:  "prompt is required",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### Frontend Tests

```typescript
// frontend/shared/components/__tests__/GenerationForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationForm } from '../GenerationForm';

describe('GenerationForm', () => {
  it('renders all form fields', () => {
    render(<GenerationForm onSubmit={() => {}} isLoading={false} />);
    
    expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<GenerationForm onSubmit={() => {}} isLoading={false} />);
    
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    
    expect(await screen.findByText(/prompt is required/i)).toBeInTheDocument();
  });
});
```

## Documentation Requirements

### API Documentation
- OpenAPI 3.0 specification with Swagger UI
- Code examples in multiple languages
- Authentication and error handling guides

### User Documentation
- Installation guides for each platform
- Model management and configuration
- Plugin development guide
- Troubleshooting and FAQ

### Developer Documentation
- Architecture overview and design decisions
- Contributing guidelines
- Code style and testing requirements
- Release process documentation

## Performance Requirements

### Backend Performance
- Handle concurrent generations based on GPU memory
- Queue management with priority system
- Memory optimization for large models
- Graceful degradation under load

### Frontend Performance
- Lazy loading for image galleries
- Real-time progress updates without blocking UI
- Efficient state management with minimal re-renders
- Offline capability for desktop app

## Security Considerations

### Input Validation
- Strict validation of all API inputs
- File upload size and type restrictions
- Prompt content filtering (optional)

### Access Control
- API rate limiting
- Optional authentication for multi-user deployments
- Secure file handling and path traversal prevention

### Privacy
- Local-first approach with no data collection
- Optional telemetry with user consent
- Secure model and output storage

This specification provides a complete foundation for building a production-ready, cross-platform Stable Diffusion platform with modern architecture and excellent developer experience.