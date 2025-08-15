package inference

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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

// PythonImageResult represents a single image result from Python service
type PythonImageResult struct {
	ImageID   string                 `json:"image_id"`
	ImageData string                 `json:"image_data"` // Base64 encoded image
	Seed      int64                  `json:"seed"`
	Width     int                    `json:"width"`
	Height    int                    `json:"height"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// PythonJobStatus represents job status from Python service
type PythonJobStatus struct {
	JobID       string              `json:"job_id"`
	Status      string              `json:"status"`
	Progress    float64             `json:"progress"`
	CurrentStep int                 `json:"current_step"`
	TotalSteps  int                 `json:"total_steps"`
	Message     string              `json:"message,omitempty"`
	Results     []PythonImageResult `json:"results,omitempty"`
	Error       string              `json:"error,omitempty"`
	CreatedAt   time.Time           `json:"created_at"`
	CompletedAt time.Time           `json:"completed_at,omitempty"`
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

	// Marshal and encrypt request if needed
	jsonData, err := json.Marshal(pythonReq)
	if err != nil {
		return nil, err
	}

	var requestBody []byte
	var contentType string
	headers := make(map[string]string)

	if os.Getenv("ENABLE_INFERENCE_ENCRYPTION") == "true" {
		// Encrypt the request
		encrypted, err := e.encryptIfNeeded(string(jsonData))
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt request: %w", err)
		}
		requestBody = []byte(encrypted)
		contentType = "application/octet-stream"
		headers["X-Encrypted"] = "true"
	} else {
		requestBody = jsonData
		contentType = "application/json"
	}

	// Create request with headers
	httpReq, err := http.NewRequest("POST", e.baseURL+"/generate", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", contentType)
	for k, v := range headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := e.httpClient.Do(httpReq)
	if err != nil {
		e.logger.WithError(err).Error("Failed to send generation request")
		return e.mockGenerate(ctx, req, progressCallback)
	}
	defer resp.Body.Close()

	// Parse response (decrypt if needed)
	var genResp PythonGenerateResponse
	
	if os.Getenv("ENABLE_INFERENCE_ENCRYPTION") == "true" && resp.Header.Get("X-Encrypted") == "true" {
		// Read and decrypt response
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		
		decrypted, err := e.decryptIfNeeded(string(body))
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt response: %w", err)
		}
		
		if err := json.Unmarshal([]byte(decrypted), &genResp); err != nil {
			return nil, fmt.Errorf("failed to parse generation response: %w", err)
		}
	} else {
		if err := json.NewDecoder(resp.Body).Decode(&genResp); err != nil {
			return nil, fmt.Errorf("failed to parse generation response: %w", err)
		}
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
	
	if os.Getenv("ENABLE_INFERENCE_ENCRYPTION") == "true" && resp.Header.Get("X-Encrypted") == "true" {
		// Read and decrypt response
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		
		decrypted, err := e.decryptIfNeeded(string(body))
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt job status: %w", err)
		}
		
		if err := json.Unmarshal([]byte(decrypted), &status); err != nil {
			return nil, err
		}
	} else {
		if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
			return nil, err
		}
	}

	return &status, nil
}

// processResults converts Python results to our format and saves images
func (e *PythonEngine) processResults(req *models.GenerationRequest, status *PythonJobStatus) ([]*models.GenerationResult, error) {
	results := make([]*models.GenerationResult, 0, len(status.Results))

	// Ensure outputs directory exists
	outputsDir := e.storageConfig.OutputDir
	if outputsDir == "" {
		outputsDir = "./outputs"
	}
	if err := os.MkdirAll(outputsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create outputs directory: %w", err)
	}

	for i, imgResult := range status.Results {
		// Decrypt base64 image data if encryption is enabled
		imageData, err := e.decryptIfNeeded(imgResult.ImageData)
		if err != nil {
			e.logger.WithError(err).Error("Failed to decrypt image data")
			return nil, fmt.Errorf("failed to decrypt image data: %w", err)
		}

		// Decode base64 image
		imageBytes, err := base64.StdEncoding.DecodeString(imageData)
		if err != nil {
			return nil, fmt.Errorf("failed to decode base64 image: %w", err)
		}

		// Generate filename
		filename := fmt.Sprintf("%s.png", imgResult.ImageID)
		filepath := filepath.Join(outputsDir, filename)

		// Save image to disk
		if err := os.WriteFile(filepath, imageBytes, 0644); err != nil {
			return nil, fmt.Errorf("failed to save image: %w", err)
		}

		// Convert metadata to string map
		metadata := make(map[string]string)
		for k, v := range imgResult.Metadata {
			metadata[k] = fmt.Sprintf("%v", v)
		}
		metadata["batch_index"] = fmt.Sprintf("%d", i)
		metadata["generated_at"] = time.Now().Format(time.RFC3339)

		result := &models.GenerationResult{
			ImagePath: filepath,
			ImageURL:  fmt.Sprintf("/outputs/%s", filename),
			Seed:      imgResult.Seed,
			Width:     imgResult.Width,
			Height:    imgResult.Height,
			Metadata:  metadata,
		}
		results = append(results, result)
	}

	return results, nil
}

// encryptIfNeeded encrypts data if encryption is enabled
func (e *PythonEngine) encryptIfNeeded(data string) (string, error) {
	// Check if encryption is enabled via environment variable
	if os.Getenv("ENABLE_INFERENCE_ENCRYPTION") != "true" {
		return data, nil
	}

	key := e.getOrCreateEncryptionKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	plaintext := []byte(data)
	ciphertext := make([]byte, aes.BlockSize+len(plaintext))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], plaintext)

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptIfNeeded decrypts data if encryption is enabled
func (e *PythonEngine) decryptIfNeeded(data string) (string, error) {
	// Check if encryption is enabled via environment variable
	if os.Getenv("ENABLE_INFERENCE_ENCRYPTION") != "true" {
		return data, nil
	}

	key := e.getOrCreateEncryptionKey()
	ciphertext, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < aes.BlockSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(ciphertext, ciphertext)

	return string(ciphertext), nil
}

// getOrCreateEncryptionKey gets or creates an encryption key
func (e *PythonEngine) getOrCreateEncryptionKey() []byte {
	// Use a shared secret from environment or generate one
	secret := os.Getenv("INFERENCE_ENCRYPTION_SECRET")
	if secret == "" {
		secret = "default-secret-key-change-in-production"
	}

	// Derive a 32-byte key using SHA256
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
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