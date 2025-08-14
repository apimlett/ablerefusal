package handlers

import (
	"net/http"

	"github.com/ablerefusal/stable-diffusion-platform/internal/models"
	"github.com/ablerefusal/stable-diffusion-platform/internal/queue"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// StatusHandler handles status endpoints
type StatusHandler struct {
	queue  queue.Manager
	logger *logrus.Logger
}

// NewStatusHandler creates a new status handler
func NewStatusHandler(queue queue.Manager, logger *logrus.Logger) *StatusHandler {
	return &StatusHandler{
		queue:  queue,
		logger: logger,
	}
}

// GetStatus handles GET /api/v1/generate/:id
func (h *StatusHandler) GetStatus(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing generation ID"})
		return
	}

	status, err := h.queue.GetStatus(id)
	if err != nil {
		if err == models.ErrGenerationNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Generation not found"})
			return
		}
		h.logger.WithError(err).Error("Failed to get generation status")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get status"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GetQueue handles GET /api/v1/queue
func (h *StatusHandler) GetQueue(c *gin.Context) {
	queue, err := h.queue.GetQueue()
	if err != nil {
		h.logger.WithError(err).Error("Failed to get queue")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get queue"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"queue": queue,
		"count": len(queue),
	})
}