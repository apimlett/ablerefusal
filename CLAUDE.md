# AbleRefusal - Development Guidelines

## Project Overview
AbleRefusal is a decoupled Stable Diffusion platform using:
- **Go backend**: API server with queue management and static file serving
- **Python service**: FastAPI server with diffusers for actual inference
- **React frontend**: Next.js web interface with settings management

The Go backend manages the Python service lifecycle automatically, eliminating manual startup.

## Technology Stack
- **Backend**: Go with Gin framework for API and queue management
- **Inference**: Python 3.10+ with FastAPI and diffusers library
- **Frontend**: React with TypeScript, Next.js for web
- **Model Format**: PyTorch/Safetensors (native Hugging Face format)
- **API**: RESTful with JSON payloads

## Development Workflow

### Code Quality Standards
- Always run tests before marking any task as complete
- Use `go fmt` and `go vet` for Go code
- Use ESLint and Prettier for TypeScript/React code
- Follow existing code patterns and conventions

### Testing Requirements
- Backend: `go test ./...` in the backend directory
- Frontend: `npm test` in the frontend directories
- Integration: Test API endpoints with actual model inference

### Git Workflow
- Create feature branches for new functionality
- Write descriptive commit messages
- Never commit sensitive data or API keys
- Test builds locally before pushing

## MVP Development Priorities

### Phase 1: Core System ✅ (COMPLETED)
1. Go server with Gin framework
2. Python FastAPI inference service
3. Diffusers integration with GPU support
4. Generation endpoints with queue
5. Automatic service management

### Phase 2: Frontend ✅ (COMPLETED)
1. React/Next.js UI with generation form
2. Settings management interface
3. Image gallery with results
4. Progress indication
5. Error handling and recovery

### Phase 3: Current Focus (IN PROGRESS)
1. LoRA support implementation
2. Performance optimization
3. Memory management improvements
4. Testing and documentation

### Phase 4: Polish & Testing (Week 4)
1. Comprehensive testing
2. Documentation
3. Installation scripts
4. Performance optimization

## Key Implementation Notes

### Model Handling
- Direct loading from Hugging Face hub
- Automatic detection of SD 1.5 vs SDXL models
- GPU acceleration with CUDA/MPS support
- Proper memory management with offloading

### API Design
- Follow RESTful principles
- Use proper HTTP status codes
- Implement request validation
- Add rate limiting for production

### Frontend Best Practices
- Implement proper loading states
- Handle errors gracefully
- Use TypeScript for type safety
- Follow React best practices

### Security Considerations
- Validate all user inputs
- Implement file upload restrictions
- Use proper CORS configuration
- Never expose internal paths

## Common Commands

### Backend Development
```bash
cd backend
go mod tidy
go run cmd/server/main.go  # Starts both Go and Python services
go build -o ablerefusal-backend cmd/server/main.go
go test ./...
```

### Frontend Development
```bash
cd frontend/web
npm install
npm run dev
npm run build
npm test
```

### Python Inference Service
```bash
cd inference-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
# Service auto-starts with backend
```

## File Organization
- Keep inference logic separate from API handlers
- Use dependency injection for testability
- Organize frontend components by feature
- Keep shared types in a common location

## Performance Guidelines
- Implement request queuing for GPU management
- Use streaming for large file transfers
- Implement caching where appropriate
- Monitor memory usage during inference

## Documentation Requirements
- Document all API endpoints
- Include setup instructions in README
- Add inline comments for complex logic
- Maintain changelog for releases

## Debugging Tips
- Use structured logging in backend
- Implement request tracing
- Add performance metrics
- Use browser DevTools for frontend debugging

## Remember
- This is an MVP - focus on core functionality first
- Prioritize working software over perfect code
- Test with actual Stable Diffusion models early
- Keep the architecture flexible for future enhancements