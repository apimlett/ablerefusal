package queue

import (
	"context"
	"sync"
	"time"

	"github.com/ablerefusal/stable-diffusion-platform/internal/config"
	"github.com/ablerefusal/stable-diffusion-platform/internal/inference"
	"github.com/ablerefusal/stable-diffusion-platform/internal/models"
	"github.com/ablerefusal/stable-diffusion-platform/internal/storage"
	"github.com/sirupsen/logrus"
)

// Manager interface for queue operations
type Manager interface {
	Enqueue(req *models.GenerationRequest) (int, error)
	Cancel(id string) error
	GetStatus(id string) (*models.GenerationStatus, error)
	GetQueue() ([]*models.QueueItem, error)
	StartProcessor(ctx context.Context)
}

// QueueManager implements the Manager interface
type QueueManager struct {
	queue          []*models.QueueItem
	statuses       map[string]*models.GenerationStatus
	mu             sync.RWMutex
	config         config.QueueConfig
	inference      inference.Engine
	storage        storage.Manager
	logger         *logrus.Logger
	processingChan chan *models.GenerationRequest
	cancelChans    map[string]chan struct{}
}

// NewManager creates a new queue manager
func NewManager(config config.QueueConfig, inference inference.Engine, storage storage.Manager, logger *logrus.Logger) Manager {
	return &QueueManager{
		queue:          make([]*models.QueueItem, 0),
		statuses:       make(map[string]*models.GenerationStatus),
		config:         config,
		inference:      inference,
		storage:        storage,
		logger:         logger,
		processingChan: make(chan *models.GenerationRequest, config.MaxQueueSize),
		cancelChans:    make(map[string]chan struct{}),
	}
}

// Enqueue adds a generation request to the queue
func (m *QueueManager) Enqueue(req *models.GenerationRequest) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check queue size
	if len(m.queue) >= m.config.MaxQueueSize {
		return -1, models.ErrQueueFull
	}

	// Create status
	status := &models.GenerationStatus{
		ID:         req.ID,
		Status:     models.StatusQueued,
		Progress:   0,
		TotalSteps: req.Steps,
	}

	// Create queue item
	item := &models.QueueItem{
		Request:  req,
		Status:   status,
		Position: len(m.queue) + 1,
	}

	// Add to queue
	m.queue = append(m.queue, item)
	m.statuses[req.ID] = status

	// Create cancel channel
	m.cancelChans[req.ID] = make(chan struct{})

	// Send to processing channel
	select {
	case m.processingChan <- req:
		m.logger.WithField("request_id", req.ID).Info("Request enqueued")
	default:
		m.logger.WithField("request_id", req.ID).Warn("Processing channel full")
	}

	return item.Position, nil
}

// Cancel cancels a generation request
func (m *QueueManager) Cancel(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	status, exists := m.statuses[id]
	if !exists {
		return models.ErrGenerationNotFound
	}

	// Update status
	status.Status = models.StatusCancelled
	now := time.Now()
	status.CompletedAt = &now

	// Send cancel signal
	if cancelChan, exists := m.cancelChans[id]; exists {
		close(cancelChan)
		delete(m.cancelChans, id)
	}

	// Remove from queue if still queued
	for i, item := range m.queue {
		if item.Request.ID == id {
			m.queue = append(m.queue[:i], m.queue[i+1:]...)
			break
		}
	}

	return nil
}

// GetStatus returns the status of a generation request
func (m *QueueManager) GetStatus(id string) (*models.GenerationStatus, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status, exists := m.statuses[id]
	if !exists {
		return nil, models.ErrGenerationNotFound
	}

	return status, nil
}

// GetQueue returns the current queue
func (m *QueueManager) GetQueue() ([]*models.QueueItem, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]*models.QueueItem, len(m.queue))
	copy(items, m.queue)
	return items, nil
}

// StartProcessor starts the queue processor
func (m *QueueManager) StartProcessor(ctx context.Context) {
	m.logger.Info("Starting queue processor")

	for i := 0; i < m.config.MaxConcurrent; i++ {
		go m.processWorker(ctx, i)
	}
}

// processWorker processes generation requests
func (m *QueueManager) processWorker(ctx context.Context, workerID int) {
	logger := m.logger.WithField("worker_id", workerID)
	logger.Info("Queue worker started")

	for {
		select {
		case <-ctx.Done():
			logger.Info("Queue worker stopped")
			return

		case req := <-m.processingChan:
			if req == nil {
				continue
			}

			logger.WithField("request_id", req.ID).Info("Processing generation request")
			m.processRequest(ctx, req)
		}
	}
}

// processRequest processes a single generation request
func (m *QueueManager) processRequest(ctx context.Context, req *models.GenerationRequest) {
	// Update status to processing
	m.updateStatus(req.ID, models.StatusProcessing, 0)

	// Get cancel channel
	m.mu.RLock()
	cancelChan := m.cancelChans[req.ID]
	m.mu.RUnlock()

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(m.config.Timeout)*time.Second)
	defer cancel()

	// Progress callback
	progressCallback := func(progress float64, step int) {
		m.updateProgress(req.ID, progress, step)
	}

	// Process generation
	select {
	case <-cancelChan:
		m.logger.WithField("request_id", req.ID).Info("Generation cancelled")
		m.updateStatus(req.ID, models.StatusCancelled, 100)
		return

	case <-timeoutCtx.Done():
		m.logger.WithField("request_id", req.ID).Error("Generation timeout")
		m.updateStatusWithError(req.ID, models.StatusFailed, "Generation timeout")
		return

	default:
		// Call inference engine (placeholder for now)
		results, err := m.inference.Generate(timeoutCtx, req, progressCallback)
		if err != nil {
			m.logger.WithError(err).WithField("request_id", req.ID).Error("Generation failed")
			m.updateStatusWithError(req.ID, models.StatusFailed, err.Error())
			return
		}

		// Update status with results
		m.updateStatusWithResults(req.ID, models.StatusCompleted, results)
		m.logger.WithField("request_id", req.ID).Info("Generation completed")
	}

	// Remove from queue
	m.removeFromQueue(req.ID)
}

// updateStatus updates the status of a generation
func (m *QueueManager) updateStatus(id string, status models.GenerationStatusType, progress float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if genStatus, exists := m.statuses[id]; exists {
		genStatus.Status = status
		genStatus.Progress = progress
		
		if status == models.StatusProcessing && genStatus.StartedAt == nil {
			now := time.Now()
			genStatus.StartedAt = &now
		}
		
		if status == models.StatusCompleted || status == models.StatusFailed || status == models.StatusCancelled {
			now := time.Now()
			genStatus.CompletedAt = &now
		}
	}
}

// updateProgress updates the progress of a generation
func (m *QueueManager) updateProgress(id string, progress float64, step int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if status, exists := m.statuses[id]; exists {
		status.Progress = progress
		status.CurrentStep = step
	}
}

// updateStatusWithError updates the status with an error
func (m *QueueManager) updateStatusWithError(id string, status models.GenerationStatusType, errorMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if genStatus, exists := m.statuses[id]; exists {
		genStatus.Status = status
		genStatus.Error = errorMsg
		now := time.Now()
		genStatus.CompletedAt = &now
	}
}

// updateStatusWithResults updates the status with results
func (m *QueueManager) updateStatusWithResults(id string, status models.GenerationStatusType, results []*models.GenerationResult) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if genStatus, exists := m.statuses[id]; exists {
		genStatus.Status = status
		genStatus.Progress = 100
		genStatus.Results = make([]models.GenerationResult, len(results))
		for i, result := range results {
			genStatus.Results[i] = *result
		}
		now := time.Now()
		genStatus.CompletedAt = &now
	}
}

// removeFromQueue removes a request from the queue
func (m *QueueManager) removeFromQueue(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, item := range m.queue {
		if item.Request.ID == id {
			m.queue = append(m.queue[:i], m.queue[i+1:]...)
			break
		}
	}

	// Update positions
	for i, item := range m.queue {
		item.Position = i + 1
	}
}