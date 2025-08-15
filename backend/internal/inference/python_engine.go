package inference

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/ablerefusal/ablerefusal/internal/config"
	"github.com/ablerefusal/ablerefusal/internal/models"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// PythonEngine communicates with the Python inference service
type PythonEngine struct {
	config        config.InferenceConfig
	storageConfig config.StorageConfig
	logger        *logrus.Logger
	baseURL       string
	httpClient    *http.Client
	ready         bool
}

// PythonGenerateRequest represents the request to Python service
type PythonGenerateRequest struct {
	Prompt         string                   `json:"prompt"`
	NegativePrompt string                   `json:"negative_prompt"`
	Width          int                      `json:"width"`
	Height         int                      `json:"height"`
	Steps          int                      `json:"steps"`
	CFGScale       float32                  `json:"cfg_scale"`
	Sampler        string                   `json:"sampler"`
	Seed           int64                    `json:"seed"`
	BatchSize      int                      `json:"batch_size"`
	Model          string                   `json:"model,omitempty"`
	Loras          []map[string]interface{} `json:"loras,omitempty"`
	EnableLCM      bool                     `json:"enable_lcm"`
	ClipSkip       int                      `json:"clip_skip"`
	// Image-to-image parameters
	InitImage string  `json:"init_image,omitempty"`
	Strength  float32 `json:"strength,omitempty"`
}

// PythonGenerateResponse represents the response from Python service
type PythonGenerateResponse struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// PythonJobStatus represents job status from Python service
type PythonJobStatus struct {
	JobID       string    `json:"job_id"`
	Status      string    `json:"status"`
	Progress    float64   `json:"progress"`
	CurrentStep int       `json:"current_step"`
	TotalSteps  int       `json:"total_steps"`
	Message     string    `json:"message,omitempty"`
	Results     []string  `json:"results,omitempty"`
	Error       string    `json:"error,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	CompletedAt time.Time `json:"completed_at,omitempty"`
}

// NewPythonEngine creates a new Python inference engine client
func NewPythonEngine(cfg config.InferenceConfig, storageConfig config.StorageConfig, logger *logrus.Logger) (Engine, error) {
	// Get Python service URL from config or environment
	pythonURL := cfg.PythonServiceURL
	if pythonURL == "" {
		pythonURL = "http://localhost:8001"
	}

	engine := &PythonEngine{
		config:        cfg,
		storageConfig: storageConfig,
		logger:        logger,
		baseURL:       pythonURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute, // Increased for image generation
		},
		ready: false,
	}

	// Initialize and check health
	if err := engine.Initialize(); err != nil {
		return nil, err
	}

	return engine, nil
}

// Initialize checks if the Python service is healthy
func (e *PythonEngine) Initialize() error {
	e.logger.Info("Initializing Python inference engine client")

	// Check health endpoint
	resp, err := e.httpClient.Get(e.baseURL + "/health")
	if err != nil {
		e.logger.WithError(err).Warn("Python inference service not available, using mock generation")
		// Don't fail, allow mock generation
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		e.ready = true
		e.logger.Info("Python inference service is healthy")
	} else {
		e.logger.Warn("Python inference service returned non-OK status")
	}

	return nil
}

// LoadModel sends a load model request to Python service
func (e *PythonEngine) LoadModel(modelPath string) error {
	if !e.ready {
		e.logger.Warn("Python service not ready, skipping model load")
		return nil
	}

	payload := map[string]string{
		"model_path": modelPath,
		"model_type": "safetensors",
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := e.httpClient.Post(
		e.baseURL+"/load-model",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to load model: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to load model: %s", string(body))
	}

	e.logger.WithField("model", modelPath).Info("Model loaded in Python service")
	return nil
}

// Generate sends generation request to Python service
func (e *PythonEngine) Generate(ctx context.Context, req *models.GenerationRequest, progressCallback func(float64, int)) ([]*models.GenerationResult, error) {
	e.logger.WithField("request_id", req.ID).Info("Starting generation via Python service")

	// If Python service is not ready, fall back to mock
	if !e.ready {
		return e.mockGenerate(ctx, req, progressCallback)
	}

	// Prepare Python request
	pythonReq := PythonGenerateRequest{
		Prompt:         req.Prompt,
		NegativePrompt: req.NegPrompt,
		Width:          req.Width,
		Height:         req.Height,
		Steps:          req.Steps,
		CFGScale:       req.CFGScale,
		Sampler:        req.Sampler,
		Seed:           req.Seed,
		BatchSize:      req.BatchSize,
		Model:          req.Model,
		EnableLCM:      false,
		ClipSkip:       1,
		InitImage:      req.InitImage,
		Strength:       req.Strength,
	}

	// Parse extra parameters if present
	if req.ExtraParams != nil {
		if lcm, ok := req.ExtraParams["enable_lcm"].(bool); ok {
			pythonReq.EnableLCM = lcm
		}
		if clipSkip, ok := req.ExtraParams["clip_skip"].(int); ok {
			pythonReq.ClipSkip = clipSkip
		}
		if loras, ok := req.ExtraParams["loras"].([]map[string]interface{}); ok {
			pythonReq.Loras = loras
		}
	}

	// Send generation request
	jsonData, err := json.Marshal(pythonReq)
	if err != nil {
		return nil, err
	}

	resp, err := e.httpClient.Post(
		e.baseURL+"/generate",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		e.logger.WithError(err).Error("Failed to send generation request")
		return e.mockGenerate(ctx, req, progressCallback)
	}
	defer resp.Body.Close()

	// Parse response
	var genResp PythonGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
		return nil, fmt.Errorf("failed to parse generation response: %w", err)
	}

	if genResp.Status != "accepted" {
		return nil, fmt.Errorf("generation not accepted: %s", genResp.Message)
	}

	// Poll for job completion
	jobID := genResp.JobID
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("generation cancelled")
		case <-ticker.C:
			status, err := e.getJobStatus(jobID)
			if err != nil {
				return nil, err
			}

			// Update progress
			if progressCallback != nil && status.TotalSteps > 0 {
				progressCallback(status.Progress, status.CurrentStep)
			}

			// Check completion
			switch status.Status {
			case "completed":
				return e.processResults(req, status)
			case "failed":
				return nil, fmt.Errorf("generation failed: %s", status.Error)
			}
		}
	}
}

// getJobStatus gets the status of a job from Python service
func (e *PythonEngine) getJobStatus(jobID string) (*PythonJobStatus, error) {
	resp, err := e.httpClient.Get(e.baseURL + "/job/" + jobID)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var status PythonJobStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}

	return &status, nil
}

// processResults converts Python results to our format
func (e *PythonEngine) processResults(req *models.GenerationRequest, status *PythonJobStatus) ([]*models.GenerationResult, error) {
	results := make([]*models.GenerationResult, 0, len(status.Results))

	for i, imagePath := range status.Results {
		result := &models.GenerationResult{
			ImagePath: imagePath,
			ImageURL:  fmt.Sprintf("/%s", imagePath), // imagePath already contains "outputs/" prefix
			Seed:      req.Seed,
			Width:     req.Width,
			Height:    req.Height,
			Metadata: map[string]string{
				"prompt":        req.Prompt,
				"negative":      req.NegPrompt,
				"steps":         fmt.Sprintf("%d", req.Steps),
				"cfg_scale":     fmt.Sprintf("%.1f", req.CFGScale),
				"sampler":       req.Sampler,
				"model":         req.Model,
				"generated_at":  time.Now().Format(time.RFC3339),
				"batch_index":   fmt.Sprintf("%d", i),
			},
		}
		results = append(results, result)
	}

	return results, nil
}

// mockGenerate provides fallback mock generation
func (e *PythonEngine) mockGenerate(ctx context.Context, req *models.GenerationRequest, progressCallback func(float64, int)) ([]*models.GenerationResult, error) {
	// Similar to ONNX engine's mock generation
	results := make([]*models.GenerationResult, req.BatchSize)

	for i := 0; i < req.BatchSize; i++ {
		// Simulate generation steps
		for step := 1; step <= req.Steps; step++ {
			select {
			case <-ctx.Done():
				return nil, fmt.Errorf("generation cancelled")
			default:
				time.Sleep(50 * time.Millisecond)
				
				if progressCallback != nil {
					progress := float64(step) / float64(req.Steps) * 100
					progressCallback(progress, step)
				}
			}
		}

		// Create mock result
		filename := fmt.Sprintf("mock_%s_%d.png", uuid.New().String(), i)
		results[i] = &models.GenerationResult{
			ImagePath: filename,
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
				"mock":         "true",
			},
		}
	}

	e.logger.WithField("request_id", req.ID).Info("Mock generation completed")
	return results, nil
}

// GetLoadedModels returns the list of loaded models
func (e *PythonEngine) GetLoadedModels() []string {
	if !e.ready {
		return []string{}
	}

	resp, err := e.httpClient.Get(e.baseURL + "/models")
	if err != nil {
		e.logger.WithError(err).Error("Failed to get loaded models")
		return []string{}
	}
	defer resp.Body.Close()

	var modelsResp struct {
		Loaded []string `json:"loaded"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err != nil {
		e.logger.WithError(err).Error("Failed to parse models response")
		return []string{}
	}

	return modelsResp.Loaded
}

// IsReady returns whether the engine is ready for inference
func (e *PythonEngine) IsReady() bool {
	return e.ready
}