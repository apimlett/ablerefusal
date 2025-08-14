package models

import "errors"

var (
	// Validation errors
	ErrEmptyPrompt       = errors.New("prompt cannot be empty")
	ErrInvalidDimensions = errors.New("invalid image dimensions")
	ErrInvalidSteps      = errors.New("invalid number of steps")
	ErrInvalidCFGScale   = errors.New("invalid CFG scale")
	ErrInvalidBatchSize  = errors.New("invalid batch size")
	
	// Queue errors
	ErrQueueFull         = errors.New("generation queue is full")
	ErrGenerationNotFound = errors.New("generation not found")
	ErrGenerationTimeout = errors.New("generation timeout")
	
	// Model errors
	ErrModelNotFound     = errors.New("model not found")
	ErrModelLoadFailed   = errors.New("failed to load model")
	
	// Storage errors
	ErrStorageFull       = errors.New("storage is full")
	ErrFileNotFound      = errors.New("file not found")
)