#!/bin/bash

# Stable Diffusion Platform - Development Setup Script

set -e

echo "========================================="
echo "Stable Diffusion Platform - Dev Setup"
echo "========================================="
echo ""

# Check operating system
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS"
echo "Detected Architecture: $ARCH"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for Homebrew on macOS
if [ "$OS" = "Darwin" ]; then
    if ! command_exists brew; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
fi

# Check and install Go
echo "Checking for Go..."
if ! command_exists go; then
    echo "❌ Go not found. Installing Go..."
    
    if [ "$OS" = "Darwin" ]; then
        brew install go
    elif [ "$OS" = "Linux" ]; then
        # Download and install Go for Linux
        GO_VERSION="1.21.5"
        wget "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
        sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
        rm "go${GO_VERSION}.linux-amd64.tar.gz"
        
        # Add to PATH
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
        export PATH=$PATH:/usr/local/go/bin
    fi
else
    GO_VERSION=$(go version | awk '{print $3}')
    echo "✅ Go is installed: $GO_VERSION"
fi

# Check and install Node.js
echo "Checking for Node.js..."
if ! command_exists node; then
    echo "❌ Node.js not found. Installing Node.js..."
    
    if [ "$OS" = "Darwin" ]; then
        brew install node
    elif [ "$OS" = "Linux" ]; then
        # Install via NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed: $NODE_VERSION"
fi

# Check and install Python (for model conversion)
echo "Checking for Python..."
if ! command_exists python3; then
    echo "❌ Python not found. Installing Python..."
    
    if [ "$OS" = "Darwin" ]; then
        brew install python@3.11
    elif [ "$OS" = "Linux" ]; then
        sudo apt-get update
        sudo apt-get install -y python3 python3-pip
    fi
else
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python is installed: $PYTHON_VERSION"
fi

echo ""
echo "========================================="
echo "Setting up Backend"
echo "========================================="
echo ""

# Initialize Go modules
cd backend
echo "Installing Go dependencies..."
go mod download
echo "✅ Go dependencies installed"

# Build backend
echo "Building backend..."
go build -o sd-backend cmd/server/main.go
echo "✅ Backend built successfully"

cd ..

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start the backend server:"
echo "   cd backend && ./sd-backend"
echo ""
echo "2. In a new terminal, set up the frontend:"
echo "   cd frontend/web"
echo "   npm install"
echo "   npm run dev"
echo ""
echo "3. Download a Stable Diffusion ONNX model:"
echo "   python3 scripts/download-model.py"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "For more information, see the README.md file."