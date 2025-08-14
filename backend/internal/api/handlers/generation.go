package handlers

import (
	"net/http"

	"github.com/ablerefusal/stable-diffusion-platform/internal/models"
	"github.com/ablerefusal/stable-diffusion-platform/internal/queue"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// GenerationHandler handles generation endpoints
type GenerationHandler struct {
	queue  queue.Manager
	logger *logrus.Logger
}

// NewGenerationHandler creates a new generation handler
func NewGenerationHandler(queue queue.Manager, logger *logrus.Logger) *GenerationHandler {
	return &GenerationHandler{
		queue:  queue,
		logger: logger,
	}
}

// Generate handles POST /api/v1/generate
func (h *GenerationHandler) Generate(c *gin.Context) {
	// Create request with defaults
	req := models.NewGenerationRequest()
	
	// Bind JSON request (this will override defaults with provided values)
	if err := c.BindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Failed to bind generation request")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure ID is set
	if req.ID == "" {
		req.ID = uuid.New().String()
	}
	
	// Ensure model is set
	if req.Model == "" {
		req.Model = "sd15"
	}

	// Validate request
	if err := req.Validate(); err != nil {
		h.logger.WithError(err).Error("Invalid generation request")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Add to queue
	position, err := h.queue.Enqueue(req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to enqueue generation")
		if err == models.ErrQueueFull {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Queue is full, please try again later"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue generation"})
		return
	}

	h.logger.WithFields(logrus.Fields{
		"request_id": req.ID,
		"position":   position,
	}).Info("Generation request queued")

	// Return response
	c.JSON(http.StatusAccepted, gin.H{
		"id":       req.ID,
		"status":   "queued",
		"position": position,
		"message":  "Generation request queued successfully",
	})
}

// Cancel handles POST /api/v1/generate/:id/cancel
func (h *GenerationHandler) Cancel(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing generation ID"})
		return
	}

	if err := h.queue.Cancel(id); err != nil {
		if err == models.ErrGenerationNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Generation not found"})
			return
		}
		h.logger.WithError(err).Error("Failed to cancel generation")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel generation"})
		return
	}

	h.logger.WithField("request_id", id).Info("Generation cancelled")
	c.JSON(http.StatusOK, gin.H{
		"id":      id,
		"status":  "cancelled",
		"message": "Generation cancelled successfully",
	})
}