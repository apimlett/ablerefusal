package inference

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// PythonServiceManager manages the Python inference service lifecycle
type PythonServiceManager struct {
	logger      *logrus.Logger
	cmd         *exec.Cmd
	serviceURL  string
	servicePath string
	venvPath    string
	isRunning   bool
}

// NewPythonServiceManager creates a new Python service manager
func NewPythonServiceManager(logger *logrus.Logger, serviceURL string) *PythonServiceManager {
	// Get the project root directory (ablerefusal)
	// The executable is in backend/, so we need to go up one level
	execPath, _ := os.Executable()
	backendDir := filepath.Dir(execPath)
	projectRoot := filepath.Dir(backendDir)
	servicePath := filepath.Join(projectRoot, "inference-service")
	
	// Determine venv path based on OS
	venvPath := filepath.Join(servicePath, "venv")
	
	return &PythonServiceManager{
		logger:      logger,
		serviceURL:  serviceURL,
		servicePath: servicePath,
		venvPath:    venvPath,
		isRunning:   false,
	}
}

// Start starts the Python inference service
func (m *PythonServiceManager) Start(ctx context.Context) error {
	m.logger.Info("Starting Python inference service...")

	// Check if service is already running
	if m.isHealthy() {
		m.logger.Info("Python inference service is already running")
		m.isRunning = true
		return nil
	}

	// Check if Python service directory exists
	if _, err := os.Stat(m.servicePath); os.IsNotExist(err) {
		return fmt.Errorf("Python service directory not found at %s", m.servicePath)
	}

	// Check if virtual environment exists
	venvPython := m.getPythonExecutable()
	if _, err := os.Stat(venvPython); os.IsNotExist(err) {
		m.logger.Warn("Virtual environment not found, attempting to create it...")
		if err := m.setupVirtualEnvironment(); err != nil {
			return fmt.Errorf("failed to setup virtual environment: %w", err)
		}
	}

	// Prepare the command to start the service
	m.cmd = exec.CommandContext(ctx, venvPython, "main.py")
	m.cmd.Dir = m.servicePath
	
	// Set environment variables
	m.cmd.Env = append(os.Environ(),
		"PYTHONUNBUFFERED=1",
		"HOST=0.0.0.0",
		"PORT=8001",
		"ENV=production",
	)

	// Capture stdout and stderr
	stdout, err := m.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := m.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the process
	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Python service: %w", err)
	}

	// Log output in separate goroutines
	go m.logOutput(stdout, "stdout")
	go m.logOutput(stderr, "stderr")

	// Wait for service to be healthy
	if err := m.waitForHealthy(30 * time.Second); err != nil {
		m.Stop()
		return fmt.Errorf("Python service failed to start: %w", err)
	}

	m.isRunning = true
	m.logger.Info("Python inference service started successfully")
	
	// Load default model
	m.logger.Info("Loading default model...")
	if err := m.loadDefaultModel(); err != nil {
		m.logger.WithError(err).Warn("Failed to load default model, service will work but use mock generation")
	}
	
	return nil
}

// loadDefaultModel loads the default SD 1.5 model
func (m *PythonServiceManager) loadDefaultModel() error {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	
	// Load the default model
	modelPath := "runwayml/stable-diffusion-v1-5"
	url := fmt.Sprintf("%s/load-model?model_path=%s&model_type=huggingface", m.serviceURL, modelPath)
	
	resp, err := client.Post(url, "application/json", nil)
	if err != nil {
		return fmt.Errorf("failed to load model: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to load model: %s", string(body))
	}
	
	m.logger.WithField("model", modelPath).Info("Default model loaded successfully")
	return nil
}

// Stop stops the Python inference service
func (m *PythonServiceManager) Stop() error {
	if m.cmd == nil || m.cmd.Process == nil {
		return nil
	}

	m.logger.Info("Stopping Python inference service...")

	// Send interrupt signal
	if runtime.GOOS == "windows" {
		// On Windows, use taskkill
		killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", m.cmd.Process.Pid))
		if err := killCmd.Run(); err != nil {
			m.logger.WithError(err).Warn("Failed to kill Python service process")
		}
	} else {
		// On Unix-like systems, send SIGTERM
		if err := m.cmd.Process.Signal(os.Interrupt); err != nil {
			m.logger.WithError(err).Warn("Failed to send interrupt signal")
		}

		// Wait for graceful shutdown
		done := make(chan error, 1)
		go func() {
			done <- m.cmd.Wait()
		}()

		select {
		case <-time.After(5 * time.Second):
			// Force kill if not stopped gracefully
			m.cmd.Process.Kill()
		case <-done:
			// Process stopped gracefully
		}
	}

	m.isRunning = false
	m.cmd = nil
	m.logger.Info("Python inference service stopped")
	return nil
}

// IsRunning returns whether the service is running
func (m *PythonServiceManager) IsRunning() bool {
	return m.isRunning && m.isHealthy()
}

// setupVirtualEnvironment creates and sets up the Python virtual environment
func (m *PythonServiceManager) setupVirtualEnvironment() error {
	m.logger.Info("Setting up Python virtual environment...")

	// Create virtual environment
	createVenv := exec.Command("python3", "-m", "venv", "venv")
	createVenv.Dir = m.servicePath
	if output, err := createVenv.CombinedOutput(); err != nil {
		m.logger.WithField("output", string(output)).Error("Failed to create virtual environment")
		return fmt.Errorf("failed to create virtual environment: %w", err)
	}

	// Install requirements
	pipPath := m.getPipExecutable()
	installReqs := exec.Command(pipPath, "install", "-r", "requirements.txt")
	installReqs.Dir = m.servicePath

	m.logger.Info("Installing Python dependencies (this may take a few minutes)...")
	if output, err := installReqs.CombinedOutput(); err != nil {
		m.logger.WithField("output", string(output)).Error("Failed to install requirements")
		return fmt.Errorf("failed to install requirements: %w", err)
	}

	m.logger.Info("Python virtual environment setup complete")
	return nil
}

// getPythonExecutable returns the path to the Python executable in the virtual environment
func (m *PythonServiceManager) getPythonExecutable() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(m.venvPath, "Scripts", "python.exe")
	}
	return filepath.Join(m.venvPath, "bin", "python")
}

// getPipExecutable returns the path to the pip executable in the virtual environment
func (m *PythonServiceManager) getPipExecutable() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(m.venvPath, "Scripts", "pip.exe")
	}
	return filepath.Join(m.venvPath, "bin", "pip")
}

// isHealthy checks if the Python service is healthy
func (m *PythonServiceManager) isHealthy() bool {
	client := &http.Client{
		Timeout: 2 * time.Second,
	}

	resp, err := client.Get(m.serviceURL + "/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// waitForHealthy waits for the service to become healthy
func (m *PythonServiceManager) waitForHealthy(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if m.isHealthy() {
				return nil
			}
			if time.Now().After(deadline) {
				return fmt.Errorf("timeout waiting for service to be healthy")
			}
		}
	}
}

// logOutput logs the output from the Python service
func (m *PythonServiceManager) logOutput(pipe interface{}, source string) {
	scanner := bufio.NewScanner(pipe.(interface{ Read([]byte) (int, error) }))
	for scanner.Scan() {
		line := scanner.Text()
		
		// Parse Python log level and message
		if strings.Contains(line, "ERROR") {
			m.logger.WithField("source", "python").Error(line)
		} else if strings.Contains(line, "WARNING") {
			m.logger.WithField("source", "python").Warn(line)
		} else if strings.Contains(line, "INFO") {
			m.logger.WithField("source", "python").Info(line)
		} else {
			m.logger.WithField("source", "python").Debug(line)
		}
	}
}