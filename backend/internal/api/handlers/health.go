package handlers

import (
	"net/http"
	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	logger *logrus.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(logger *logrus.Logger) *HealthHandler {
	return &HealthHandler{
		logger: logger,
	}
}

// Health returns basic health status
func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"time":   c.Request.Context().Value("request_time"),
	})
}

// Ready returns detailed readiness status
func (h *HealthHandler) Ready(c *gin.Context) {
	// Get memory stats
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	c.JSON(http.StatusOK, gin.H{
		"status": "ready",
		"system": gin.H{
			"go_version":   runtime.Version(),
			"go_routines":  runtime.NumGoroutine(),
			"cpu_count":    runtime.NumCPU(),
			"memory_alloc": memStats.Alloc / 1024 / 1024,      // MB
			"memory_total": memStats.TotalAlloc / 1024 / 1024, // MB
		},
		"services": gin.H{
			"inference": false, // Will be true when ONNX is integrated
			"storage":   true,
			"queue":     true,
		},
	})
}