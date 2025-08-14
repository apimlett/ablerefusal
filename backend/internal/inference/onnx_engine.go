package inference

import (
	"context"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/ablerefusal/ablerefusal/internal/config"
	"github.com/ablerefusal/ablerefusal/internal/models"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	ort "github.com/yalue/onnxruntime_go"
)

// ONNXEngine implements the Engine interface using ONNX Runtime
type ONNXEngine struct {
	config       config.InferenceConfig
	logger       *logrus.Logger
	session      *ort.AdvancedSession
	loadedModel  string
	ready        bool
	outputDir    string
}

// NewONNXEngine creates a new ONNX inference engine
func NewONNXEngine(cfg config.InferenceConfig, storageConfig config.StorageConfig, logger *logrus.Logger) (Engine, error) {
	engine := &ONNXEngine{
		config:    cfg,
		logger:    logger,
		outputDir: storageConfig.OutputDir,
		ready:     false,
	}

	// Initialize ONNX Runtime
	if err := engine.Initialize(); err != nil {
		return nil, err
	}

	return engine, nil
}

// Initialize initializes the ONNX Runtime
func (e *ONNXEngine) Initialize() error {
	e.logger.Info("Initializing ONNX Runtime")

	// Try to initialize ONNX Runtime environment
	// If it fails (library not installed), we'll fall back to mock generation
	if err := ort.InitializeEnvironment(); err != nil {
		e.logger.WithError(err).Warn("ONNX Runtime not available, using mock generation. To enable real inference, install ONNX Runtime library")
		// Don't return error, just use mock generation
	} else {
		e.logger.Info("ONNX Runtime initialized successfully")
	}

	// Create output directory if it doesn't exist
	if err := os.MkdirAll(e.outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	e.ready = true
	
	return nil
}

// LoadModel loads an ONNX model for inference
func (e *ONNXEngine) LoadModel(modelPath string) error {
	e.logger.WithField("model_path", modelPath).Info("Loading ONNX model")

	// Check if model file exists
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		// For now, we'll just log a warning and continue with mock generation
		e.logger.Warn("Model file not found, will use mock generation")
		e.loadedModel = modelPath
		return nil
	}

	// Create session options
	options, err := ort.NewSessionOptions()
	if err != nil {
		return fmt.Errorf("failed to create session options: %w", err)
	}
	defer options.Destroy()

	// Configure session based on device
	if e.config.Device == "gpu" {
		// Try to enable CUDA if available
		// Note: CUDA provider options require more complex setup
		e.logger.Info("GPU requested but using CPU for now")
	}

	// Set number of threads for CPU execution
	options.SetIntraOpNumThreads(4)
	options.SetInterOpNumThreads(4)

	// Create the session
	// NewAdvancedSession requires input/output values for shape inference
	session, err := ort.NewAdvancedSession(modelPath, []string{}, []string{}, nil, nil, options)
	if err != nil {
		e.logger.WithError(err).Warn("Failed to load ONNX model, will use mock generation")
		e.loadedModel = modelPath
		return nil
	}

	// Clean up old session if exists
	if e.session != nil {
		e.session.Destroy()
	}

	e.session = session
	e.loadedModel = modelPath
	e.logger.WithField("model_path", modelPath).Info("ONNX model loaded successfully")

	return nil
}

// Generate generates images from a request
func (e *ONNXEngine) Generate(ctx context.Context, req *models.GenerationRequest, progressCallback func(float64, int)) ([]*models.GenerationResult, error) {
	e.logger.WithField("request_id", req.ID).Info("Starting generation")

	// For now, if we don't have a real model loaded, use mock generation
	if e.session == nil {
		return e.mockGenerate(ctx, req, progressCallback)
	}

	// TODO: Implement actual ONNX inference here
	// This would involve:
	// 1. Preprocessing the prompt (tokenization)
	// 2. Running the diffusion loop
	// 3. Postprocessing the output
	// For now, we'll use mock generation

	return e.mockGenerate(ctx, req, progressCallback)
}

// mockGenerate provides mock generation for testing
func (e *ONNXEngine) mockGenerate(ctx context.Context, req *models.GenerationRequest, progressCallback func(float64, int)) ([]*models.GenerationResult, error) {
	results := make([]*models.GenerationResult, req.BatchSize)

	for i := 0; i < req.BatchSize; i++ {
		// Simulate generation steps
		for step := 1; step <= req.Steps; step++ {
			select {
			case <-ctx.Done():
				return nil, fmt.Errorf("generation cancelled")
			default:
				// Simulate processing time
				time.Sleep(50 * time.Millisecond)
				
				// Update progress
				if progressCallback != nil {
					progress := float64(step) / float64(req.Steps) * 100
					progressCallback(progress, step)
				}
			}
		}

		// Generate a mock image
		img := e.createMockImage(req.Width, req.Height, req.Prompt)
		
		// Save the image
		filename := fmt.Sprintf("%s_%d.png", uuid.New().String(), i)
		filepath := filepath.Join(e.outputDir, filename)
		
		if err := e.saveImage(img, filepath); err != nil {
			return nil, fmt.Errorf("failed to save image: %w", err)
		}

		results[i] = &models.GenerationResult{
			ImagePath: filepath,
			ImageURL:  fmt.Sprintf("/outputs/%s", filename),
			Seed:      req.Seed,
			Width:     req.Width,
			Height:    req.Height,
			Metadata: map[string]string{
				"prompt":       req.Prompt,
				"negative":     req.NegPrompt,
				"steps":        fmt.Sprintf("%d", req.Steps),
				"cfg_scale":    fmt.Sprintf("%.1f", req.CFGScale),
				"sampler":      req.Sampler,
				"model":        req.Model,
				"generated_at": time.Now().Format(time.RFC3339),
			},
		}
	}

	e.logger.WithField("request_id", req.ID).Info("Generation completed")
	return results, nil
}

// createMockImage creates a placeholder image with gradient
func (e *ONNXEngine) createMockImage(width, height int, prompt string) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Create a gradient based on prompt hash
	hash := 0
	for _, r := range prompt {
		hash = hash*31 + int(r)
	}

	// Generate gradient colors based on hash
	r1 := uint8((hash >> 16) & 0xFF)
	g1 := uint8((hash >> 8) & 0xFF)
	b1 := uint8(hash & 0xFF)
	
	r2 := uint8(255 - r1)
	g2 := uint8(255 - g1)
	b2 := uint8(255 - b1)

	// Draw gradient
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			t := float64(y) / float64(height)
			r := uint8(float64(r1)*(1-t) + float64(r2)*t)
			g := uint8(float64(g1)*(1-t) + float64(g2)*t)
			b := uint8(float64(b1)*(1-t) + float64(b2)*t)
			
			img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
		}
	}

	return img
}

// saveImage saves an image to disk
func (e *ONNXEngine) saveImage(img image.Image, filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	return png.Encode(file, img)
}

// GetLoadedModels returns the list of loaded models
func (e *ONNXEngine) GetLoadedModels() []string {
	if e.loadedModel != "" {
		return []string{e.loadedModel}
	}
	return []string{}
}

// IsReady returns whether the engine is ready for inference
func (e *ONNXEngine) IsReady() bool {
	return e.ready
}

// Cleanup cleans up resources
func (e *ONNXEngine) Cleanup() {
	if e.session != nil {
		e.session.Destroy()
	}
	ort.DestroyEnvironment()
}