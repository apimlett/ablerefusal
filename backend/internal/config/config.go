package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	Server    ServerConfig    `mapstructure:"server"`
	Storage   StorageConfig   `mapstructure:"storage"`
	Models    ModelsConfig    `mapstructure:"models"`
	Queue     QueueConfig     `mapstructure:"queue"`
	Inference InferenceConfig `mapstructure:"inference"`
	Logging   LoggingConfig   `mapstructure:"logging"`
}

type ServerConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	Environment  string `mapstructure:"environment"`
	ReadTimeout  int    `mapstructure:"read_timeout"`
	WriteTimeout int    `mapstructure:"write_timeout"`
	EnableCORS   bool   `mapstructure:"enable_cors"`
}

type StorageConfig struct {
	OutputDir   string `mapstructure:"output_dir"`
	ModelsDir   string `mapstructure:"models_dir"`
	TempDir     string `mapstructure:"temp_dir"`
	MaxFileSize int64  `mapstructure:"max_file_size"`
}

type ModelsConfig struct {
	DefaultModel string              `mapstructure:"default"`
	Available    []ModelConfig       `mapstructure:"available"`
	AutoDownload bool                `mapstructure:"auto_download"`
}

type ModelConfig struct {
	Name        string `mapstructure:"name"`
	Path        string `mapstructure:"path"`
	Type        string `mapstructure:"type"`
	Version     string `mapstructure:"version"`
	Description string `mapstructure:"description"`
}

type QueueConfig struct {
	MaxConcurrent int `mapstructure:"max_concurrent"`
	MaxQueueSize  int `mapstructure:"max_queue_size"`
	Timeout       int `mapstructure:"timeout"`
}

type InferenceConfig struct {
	Device         string `mapstructure:"device"`
	MaxBatchSize   int    `mapstructure:"max_batch_size"`
	MaxResolution  int    `mapstructure:"max_resolution"`
	MemoryLimit    int64  `mapstructure:"memory_limit"`
	UseOptimized   bool   `mapstructure:"use_optimized"`
}

type LoggingConfig struct {
	Level      string `mapstructure:"level"`
	File       string `mapstructure:"file"`
	MaxSize    int    `mapstructure:"max_size"`
	MaxBackups int    `mapstructure:"max_backups"`
	MaxAge     int    `mapstructure:"max_age"`
}

func Load() (*Config, error) {
	// Set default configuration file locations
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	
	// Look for config in these directories
	viper.AddConfigPath(".")
	viper.AddConfigPath("./backend")
	viper.AddConfigPath("/etc/sd-platform/")
	viper.AddConfigPath("$HOME/.sd-platform")

	// Set defaults
	setDefaults()

	// Read environment variables
	viper.AutomaticEnv()
	viper.SetEnvPrefix("SD")

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		// If config file not found, create default one
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			if err := createDefaultConfig(); err != nil {
				return nil, fmt.Errorf("failed to create default config: %w", err)
			}
			// Try reading again
			if err := viper.ReadInConfig(); err != nil {
				return nil, fmt.Errorf("failed to read config: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Ensure directories exist
	if err := ensureDirectories(&config); err != nil {
		return nil, fmt.Errorf("failed to create directories: %w", err)
	}

	return &config, nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "localhost")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.environment", "development")
	viper.SetDefault("server.read_timeout", 30)
	viper.SetDefault("server.write_timeout", 30)
	viper.SetDefault("server.enable_cors", true)

	// Storage defaults
	viper.SetDefault("storage.output_dir", "./outputs")
	viper.SetDefault("storage.models_dir", "./models")
	viper.SetDefault("storage.temp_dir", "./temp")
	viper.SetDefault("storage.max_file_size", 10737418240) // 10GB

	// Models defaults
	viper.SetDefault("models.default", "sd15")
	viper.SetDefault("models.auto_download", false)

	// Queue defaults
	viper.SetDefault("queue.max_concurrent", 1)
	viper.SetDefault("queue.max_queue_size", 100)
	viper.SetDefault("queue.timeout", 300)

	// Inference defaults
	viper.SetDefault("inference.device", "cpu")
	viper.SetDefault("inference.max_batch_size", 1)
	viper.SetDefault("inference.max_resolution", 1024)
	viper.SetDefault("inference.memory_limit", 4294967296) // 4GB
	viper.SetDefault("inference.use_optimized", true)

	// Logging defaults
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.file", "")
	viper.SetDefault("logging.max_size", 100)
	viper.SetDefault("logging.max_backups", 3)
	viper.SetDefault("logging.max_age", 7)
}

func createDefaultConfig() error {
	configPath := "./backend/config.yaml"
	
	defaultConfig := `# Stable Diffusion Platform Configuration

server:
  host: localhost
  port: 8080
  environment: development
  read_timeout: 30
  write_timeout: 30
  enable_cors: true

storage:
  output_dir: ./outputs
  models_dir: ./models
  temp_dir: ./temp
  max_file_size: 10737418240  # 10GB

models:
  default: sd15
  auto_download: false
  available:
    - name: sd15
      path: ./models/sd15
      type: onnx
      version: "1.5"
      description: "Stable Diffusion v1.5 ONNX model"

queue:
  max_concurrent: 1
  max_queue_size: 100
  timeout: 300  # 5 minutes

inference:
  device: cpu  # cpu or gpu
  max_batch_size: 1
  max_resolution: 1024
  memory_limit: 4294967296  # 4GB
  use_optimized: true

logging:
  level: info
  file: ""  # Empty for stdout only
  max_size: 100  # MB
  max_backups: 3
  max_age: 7  # days
`

	// Create directory if it doesn't exist
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// Write default config
	return os.WriteFile(configPath, []byte(defaultConfig), 0644)
}

func ensureDirectories(config *Config) error {
	dirs := []string{
		config.Storage.OutputDir,
		config.Storage.ModelsDir,
		config.Storage.TempDir,
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	return nil
}