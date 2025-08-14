package models

import (
	"time"

	"github.com/google/uuid"
)

// GenerationRequest represents a request to generate an image
type GenerationRequest struct {
	ID          string       `json:"id"`
	Prompt      string       `json:"prompt" binding:"required,min=1,max=1000"`
	NegPrompt   string       `json:"negative_prompt"`
	Model       string       `json:"model"`
	Width       int          `json:"width" binding:"min=64,max=2048"`
	Height      int          `json:"height" binding:"min=64,max=2048"`
	Steps       int          `json:"steps" binding:"min=1,max=150"`
	CFGScale    float64      `json:"cfg_scale" binding:"min=1,max=30"`
	Seed        int64        `json:"seed"`
	BatchSize   int          `json:"batch_size" binding:"min=1,max=10"`
	Sampler     string       `json:"sampler"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// NewGenerationRequest creates a new generation request with defaults
func NewGenerationRequest() *GenerationRequest {
	return &GenerationRequest{
		ID:        uuid.New().String(),
		Width:     512,
		Height:    512,
		Steps:     20,
		CFGScale:  7.5,
		Seed:      -1, // Random seed
		BatchSize: 1,
		Sampler:   "euler_a",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// GenerationStatus represents the current status of a generation
type GenerationStatus struct {
	ID          string               `json:"id"`
	Status      GenerationStatusType `json:"status"`
	Progress    float64              `json:"progress"`
	CurrentStep int                  `json:"current_step"`
	TotalSteps  int                  `json:"total_steps"`
	Results     []GenerationResult   `json:"results,omitempty"`
	Error       string               `json:"error,omitempty"`
	StartedAt   *time.Time           `json:"started_at,omitempty"`
	CompletedAt *time.Time           `json:"completed_at,omitempty"`
}

// GenerationStatusType represents the status of a generation
type GenerationStatusType string

const (
	StatusQueued     GenerationStatusType = "queued"
	StatusProcessing GenerationStatusType = "processing"
	StatusCompleted  GenerationStatusType = "completed"
	StatusFailed     GenerationStatusType = "failed"
	StatusCancelled  GenerationStatusType = "cancelled"
)

// GenerationResult represents a single generated image
type GenerationResult struct {
	ImagePath string            `json:"image_path"`
	ImageURL  string            `json:"image_url"`
	Seed      int64             `json:"seed"`
	Width     int               `json:"width"`
	Height    int               `json:"height"`
	Metadata  map[string]string `json:"metadata"`
}

// QueueItem represents an item in the generation queue
type QueueItem struct {
	Request  *GenerationRequest `json:"request"`
	Status   *GenerationStatus  `json:"status"`
	Position int                `json:"position"`
}

// Validate validates the generation request
func (r *GenerationRequest) Validate() error {
	if r.Prompt == "" {
		return ErrEmptyPrompt
	}
	if r.Width < 64 || r.Width > 2048 {
		return ErrInvalidDimensions
	}
	if r.Height < 64 || r.Height > 2048 {
		return ErrInvalidDimensions
	}
	if r.Steps < 1 || r.Steps > 150 {
		return ErrInvalidSteps
	}
	if r.CFGScale < 1 || r.CFGScale > 30 {
		return ErrInvalidCFGScale
	}
	if r.BatchSize < 1 || r.BatchSize > 10 {
		return ErrInvalidBatchSize
	}
	return nil
}