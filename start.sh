#!/bin/bash

# AbleRefusal - Start Frontend and Backend Services
# This script starts both the backend Go server and the frontend Next.js development server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AbleRefusal Services...${NC}"
echo "================================"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    # Kill all child processes
    pkill -P $$ || true
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup SIGINT SIGTERM

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo -e "${RED}Error: backend directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend/web" ]; then
    echo -e "${RED}Error: frontend/web directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Start Backend
echo -e "${YELLOW}Starting Backend Server...${NC}"
cd backend
if [ -f "sd-backend" ]; then
    # Use compiled binary if it exists
    ./sd-backend &
    BACKEND_PID=$!
    echo -e "${GREEN}Backend started with compiled binary (PID: $BACKEND_PID)${NC}"
elif [ -f "cmd/server/main.go" ]; then
    # Otherwise run with go run
    go run cmd/server/main.go &
    BACKEND_PID=$!
    echo -e "${GREEN}Backend started with go run (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}Error: Cannot find backend main.go or compiled binary${NC}"
    exit 1
fi
cd ..

# Give backend a moment to start
sleep 2

# Start Frontend
echo -e "${YELLOW}Starting Frontend Server...${NC}"
cd frontend/web
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"
cd ../..

echo "================================"
echo -e "${GREEN}All services started successfully!${NC}"
echo ""
echo "Backend:  http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID