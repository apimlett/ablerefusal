package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ablerefusal/ablerefusal/internal/api/routes"
	"github.com/ablerefusal/ablerefusal/internal/config"
	"github.com/ablerefusal/ablerefusal/internal/inference"
	"github.com/ablerefusal/ablerefusal/internal/logger"
	"github.com/ablerefusal/ablerefusal/internal/queue"
	"github.com/ablerefusal/ablerefusal/internal/storage"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func main() {
	// Initialize logger
	log := logger.New()
	log.Info("Starting AbleRefusal Server...")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.WithError(err).Fatal("Failed to load configuration")
	}

	// Set gin mode based on environment
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize storage manager
	storageManager, err := storage.NewManager(cfg.Storage)
	if err != nil {
		log.WithError(err).Fatal("Failed to initialize storage manager")
	}

	// Initialize inference engine
	inferenceEngine, err := inference.NewEngine(cfg.Inference, cfg.Storage, log)
	if err != nil {
		log.WithError(err).Fatal("Failed to initialize inference engine")
	}

	// Initialize queue manager
	queueManager := queue.NewManager(cfg.Queue, inferenceEngine, storageManager, log)
	
	// Start queue processor
	go queueManager.StartProcessor(context.Background())

	// Setup routes
	router := routes.Setup(cfg, queueManager, storageManager, log)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.WithFields(logrus.Fields{
			"host": cfg.Server.Host,
			"port": cfg.Server.Port,
		}).Info("Server started")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.WithError(err).Fatal("Failed to start server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.WithError(err).Fatal("Server forced to shutdown")
	}

	log.Info("Server exited")
}