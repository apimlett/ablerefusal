package routes

import (
	"net/http"

	"github.com/ablerefusal/ablerefusal/internal/api/handlers"
	"github.com/ablerefusal/ablerefusal/internal/api/middleware"
	"github.com/ablerefusal/ablerefusal/internal/config"
	"github.com/ablerefusal/ablerefusal/internal/queue"
	"github.com/ablerefusal/ablerefusal/internal/storage"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Setup initializes and returns the router with all routes
func Setup(cfg *config.Config, queueManager queue.Manager, storageManager storage.Manager, logger *logrus.Logger) *gin.Engine {
	router := gin.New()

	// Add middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.RequestID())

	// Configure CORS
	if cfg.Server.EnableCORS {
		corsConfig := cors.DefaultConfig()
		corsConfig.AllowOrigins = []string{"http://localhost:3000", "http://localhost:1420"}
		corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
		corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
		corsConfig.AllowCredentials = true
		router.Use(cors.New(corsConfig))
	}

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(logger)
	generationHandler := handlers.NewGenerationHandler(queueManager, logger)
	statusHandler := handlers.NewStatusHandler(queueManager, logger)
	// staticHandler := handlers.NewStaticHandler(storageManager, logger) // TODO: Implement when needed

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Health check
		v1.GET("/health", healthHandler.Health)
		v1.GET("/ready", healthHandler.Ready)

		// Generation endpoints
		v1.POST("/generate", generationHandler.Generate)
		v1.GET("/generate/:id", statusHandler.GetStatus)
		v1.POST("/generate/:id/cancel", generationHandler.Cancel)
		v1.GET("/queue", statusHandler.GetQueue)

		// Model endpoints
		v1.GET("/models", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"models": []gin.H{
					{
						"id":          "runwayml/stable-diffusion-v1-5",
						"name":        "Stable Diffusion 1.5",
						"type":        "pytorch",
						"version":     "1.5",
						"description": "Base Stable Diffusion v1.5 model",
						"ready":       true,
					},
					{
						"id":          "stabilityai/stable-diffusion-2-1",
						"name":        "Stable Diffusion 2.1",
						"type":        "pytorch",
						"version":     "2.1",
						"description": "Stable Diffusion v2.1 model",
						"ready":       false,
					},
					{
						"id":          "stabilityai/stable-diffusion-xl-base-1.0",
						"name":        "SDXL 1.0",
						"type":        "pytorch",
						"version":     "xl-1.0",
						"description": "Stable Diffusion XL base model",
						"ready":       false,
					},
				},
			})
		})
	}

	// Static file serving for generated images
	router.Static("/outputs", cfg.Storage.OutputDir)

	// WebSocket endpoint for real-time updates (placeholder)
	router.GET("/ws", func(c *gin.Context) {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "WebSocket support coming soon"})
	})

	// Catch-all 404
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "endpoint not found"})
	})

	return router
}