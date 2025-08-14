# Stable Diffusion Platform - Development Guidelines

## Project Overview
This is a decoupled, cross-platform Stable Diffusion platform with a Go backend and React frontend. The architecture separates the backend inference engine from frontend interfaces for maximum flexibility.

## Technology Stack
- **Backend**: Go with Gin framework, ONNX Runtime for inference
- **Frontend**: React with TypeScript, Tauri for desktop, Next.js for web
- **Model Format**: ONNX (converted from PyTorch/Safetensors)
- **API**: RESTful with WebSocket for real-time updates

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

### Phase 1: Core Backend (Week 1-2)
1. Basic Go server with Gin
2. ONNX Runtime integration
3. Simple generation endpoint
4. File storage for outputs
5. Basic configuration system

### Phase 2: Basic Frontend (Week 2-3)
1. Simple React UI with generation form
2. API client integration
3. Image display functionality
4. Progress indication
5. Basic error handling

### Phase 3: Model Management (Week 3-4)
1. Model download from Hugging Face
2. ONNX conversion utilities
3. Model configuration system
4. Multiple model support

### Phase 4: Polish & Testing (Week 4)
1. Comprehensive testing
2. Documentation
3. Installation scripts
4. Performance optimization

## Key Implementation Notes

### ONNX Model Handling
- Models must be converted from PyTorch to ONNX format
- Use optimized ONNX models for better performance
- Implement proper memory management for large models

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
go mod init github.com/username/stable-diffusion-platform
go mod tidy
go run cmd/server/main.go
go build -o sd-backend cmd/server/main.go
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

### Model Conversion (Python required)
```bash
python scripts/convert_to_onnx.py --model_id "runwayml/stable-diffusion-v1-5" --output_path ./models/
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