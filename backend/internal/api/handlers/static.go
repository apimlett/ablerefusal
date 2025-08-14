package handlers

import (
	"net/http"
	"path/filepath"

	"github.com/ablerefusal/ablerefusal/internal/storage"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// StaticHandler handles static file serving
type StaticHandler struct {
	storage storage.Manager
	logger  *logrus.Logger
}

// NewStaticHandler creates a new static handler
func NewStaticHandler(storage storage.Manager, logger *logrus.Logger) *StaticHandler {
	return &StaticHandler{
		storage: storage,
		logger:  logger,
	}
}

// ServeImage serves a generated image
func (h *StaticHandler) ServeImage(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing filename"})
		return
	}

	// Validate filename (prevent directory traversal)
	if filepath.Base(filename) != filename {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}

	// Get file path
	filePath, err := h.storage.GetOutputPath(filename)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Serve file
	c.File(filePath)
}