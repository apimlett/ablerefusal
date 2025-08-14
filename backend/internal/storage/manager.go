package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/ablerefusal/stable-diffusion-platform/internal/config"
	"github.com/ablerefusal/stable-diffusion-platform/internal/models"
)

// Manager interface for storage operations
type Manager interface {
	SaveImage(id string, data []byte) (string, error)
	GetOutputPath(filename string) (string, error)
	GetModelPath(modelName string) (string, error)
	CleanupTemp() error
	GetStorageStats() (*StorageStats, error)
}

// StorageManager implements the Manager interface
type StorageManager struct {
	config config.StorageConfig
}

// StorageStats represents storage statistics
type StorageStats struct {
	OutputDirSize int64
	ModelsDirSize int64
	TempDirSize   int64
	TotalSize     int64
}

// NewManager creates a new storage manager
func NewManager(config config.StorageConfig) (Manager, error) {
	// Ensure directories exist
	dirs := []string{
		config.OutputDir,
		config.ModelsDir,
		config.TempDir,
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	return &StorageManager{
		config: config,
	}, nil
}

// SaveImage saves an image to the output directory
func (m *StorageManager) SaveImage(id string, data []byte) (string, error) {
	// Generate filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("%s_%s.png", id, timestamp)
	filePath := filepath.Join(m.config.OutputDir, filename)

	// Write file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to save image: %w", err)
	}

	return filename, nil
}

// GetOutputPath returns the full path for an output file
func (m *StorageManager) GetOutputPath(filename string) (string, error) {
	filePath := filepath.Join(m.config.OutputDir, filename)
	
	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", models.ErrFileNotFound
	}

	return filePath, nil
}

// GetModelPath returns the full path for a model
func (m *StorageManager) GetModelPath(modelName string) (string, error) {
	modelPath := filepath.Join(m.config.ModelsDir, modelName)
	
	// Check if model directory exists
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		return "", models.ErrModelNotFound
	}

	return modelPath, nil
}

// CleanupTemp removes temporary files
func (m *StorageManager) CleanupTemp() error {
	// Get temp directory contents
	entries, err := os.ReadDir(m.config.TempDir)
	if err != nil {
		return fmt.Errorf("failed to read temp directory: %w", err)
	}

	// Remove files older than 1 hour
	cutoff := time.Now().Add(-1 * time.Hour)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			filePath := filepath.Join(m.config.TempDir, entry.Name())
			os.Remove(filePath)
		}
	}

	return nil
}

// GetStorageStats returns storage statistics
func (m *StorageManager) GetStorageStats() (*StorageStats, error) {
	stats := &StorageStats{}

	// Calculate output directory size
	outputSize, err := getDirSize(m.config.OutputDir)
	if err != nil {
		return nil, err
	}
	stats.OutputDirSize = outputSize

	// Calculate models directory size
	modelsSize, err := getDirSize(m.config.ModelsDir)
	if err != nil {
		return nil, err
	}
	stats.ModelsDirSize = modelsSize

	// Calculate temp directory size
	tempSize, err := getDirSize(m.config.TempDir)
	if err != nil {
		return nil, err
	}
	stats.TempDirSize = tempSize

	stats.TotalSize = stats.OutputDirSize + stats.ModelsDirSize + stats.TempDirSize

	return stats, nil
}

// getDirSize calculates the total size of a directory
func getDirSize(path string) (int64, error) {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}

// CopyFile copies a file from src to dst
func CopyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}