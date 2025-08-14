"""
AbleRefusal Inference Service
FastAPI service for Stable Diffusion inference with full diffusers support
"""

import os
import asyncio
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_serializer
import uvicorn
import torch

from inference_engine import InferenceEngine, GenerationRequest, GenerationResult

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AbleRefusal Inference Service",
    description="Python-based inference service for Stable Diffusion with Civitai model support",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global inference engine instance
inference_engine: Optional[InferenceEngine] = None

# In-memory job storage (replace with Redis in production)
jobs: Dict[str, Dict[str, Any]] = {}


class HealthResponse(BaseModel):
    status: str
    message: str
    models_loaded: List[str]
    device: str


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    width: int = Field(default=512, ge=64, le=2048)
    height: int = Field(default=512, ge=64, le=2048)
    steps: int = Field(default=20, ge=1, le=150)
    cfg_scale: float = Field(default=7.5, ge=1.0, le=30.0)
    sampler: str = Field(default="DPM++ 2M Karras")
    seed: int = Field(default=-1)
    batch_size: int = Field(default=1, ge=1, le=4)
    model: Optional[str] = None
    loras: Optional[List[Dict[str, Any]]] = None
    enable_lcm: bool = False
    clip_skip: int = Field(default=1, ge=1, le=12)


class GenerateResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobStatus(BaseModel):
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: float
    current_step: int
    total_steps: int
    message: Optional[str] = None
    results: Optional[List[str]] = None  # Image URLs/paths
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    @field_serializer('created_at', 'completed_at')
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt:
            # Ensure timezone-aware and format as ISO 8601 with Z suffix for UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat().replace('+00:00', 'Z')
        return None


@app.on_event("startup")
async def startup_event():
    """Initialize the inference engine on startup"""
    global inference_engine
    
    logger.info("Starting AbleRefusal Inference Service...")
    
    # Initialize inference engine
    # Use MPS on Mac, CUDA on Linux/Windows, CPU as fallback
    if torch.backends.mps.is_available():
        default_device = "mps"
    elif torch.cuda.is_available():
        default_device = "cuda"
    else:
        default_device = "cpu"
    
    inference_engine = InferenceEngine(
        models_dir=os.getenv("MODELS_DIR", "./models"),
        outputs_dir=os.getenv("OUTPUTS_DIR", "./outputs"),
        device=os.getenv("DEVICE", default_device)
    )
    
    # Load default model if specified
    default_model = os.getenv("DEFAULT_MODEL")
    if default_model:
        try:
            await inference_engine.load_model(default_model)
            logger.info(f"Loaded default model: {default_model}")
        except Exception as e:
            logger.error(f"Failed to load default model: {e}")
    
    logger.info("Inference service ready!")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global inference_engine
    if inference_engine:
        await inference_engine.cleanup()
    logger.info("Inference service shutdown complete")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    if not inference_engine:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    return HealthResponse(
        status="healthy",
        message="Inference service is running",
        models_loaded=inference_engine.get_loaded_models(),
        device=inference_engine.device
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate_image(
    request: GenerateRequest,
    background_tasks: BackgroundTasks
):
    """Generate images from text prompt"""
    if not inference_engine:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    # Create job ID
    job_id = str(uuid.uuid4())
    
    # Initialize job status
    jobs[job_id] = {
        "status": "pending",
        "progress": 0.0,
        "current_step": 0,
        "total_steps": request.steps,
        "created_at": datetime.now(timezone.utc),
        "request": request.dict()
    }
    
    # Start generation in background
    background_tasks.add_task(
        run_generation,
        job_id,
        request
    )
    
    return GenerateResponse(
        job_id=job_id,
        status="accepted",
        message="Generation job queued successfully"
    )


async def run_generation(job_id: str, request: GenerateRequest):
    """Run generation task in background"""
    try:
        jobs[job_id]["status"] = "processing"
        
        # Progress callback
        def progress_callback(step: int, total: int, latents=None):
            jobs[job_id]["progress"] = (step / total) * 100
            jobs[job_id]["current_step"] = step
            jobs[job_id]["total_steps"] = total
        
        # Convert request to engine format
        gen_request = GenerationRequest(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg_scale=request.cfg_scale,
            sampler=request.sampler,
            seed=request.seed,
            batch_size=request.batch_size,
            model=request.model,
            loras=request.loras,
            enable_lcm=request.enable_lcm,
            clip_skip=request.clip_skip
        )
        
        # Run generation
        results = await inference_engine.generate(
            gen_request,
            progress_callback=progress_callback
        )
        
        # Update job status
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100.0
        jobs[job_id]["results"] = [r.image_path for r in results]
        jobs[job_id]["completed_at"] = datetime.now(timezone.utc)
        
    except Exception as e:
        logger.error(f"Generation failed for job {job_id}: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["completed_at"] = datetime.now(timezone.utc)


@app.get("/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get status of a generation job"""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        progress=job.get("progress", 0),
        current_step=job.get("current_step", 0),
        total_steps=job.get("total_steps", 0),
        message=job.get("message"),
        results=job.get("results"),
        error=job.get("error"),
        created_at=job["created_at"],
        completed_at=job.get("completed_at")
    )


@app.post("/load-model")
async def load_model(model_path: str, model_type: str = "safetensors"):
    """Load a model from file or Hugging Face"""
    if not inference_engine:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    try:
        await inference_engine.load_model(model_path, model_type)
        return {"status": "success", "message": f"Model {model_path} loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/models")
async def list_models():
    """List available and loaded models"""
    if not inference_engine:
        raise HTTPException(status_code=503, detail="Inference engine not initialized")
    
    return {
        "loaded": inference_engine.get_loaded_models(),
        "available": inference_engine.list_available_models()
    }


@app.get("/samplers")
async def list_samplers():
    """List available samplers"""
    return {
        "samplers": [
            "DPM++ 2M Karras",
            "DPM++ 2M SDE Karras", 
            "DPM++ SDE Karras",
            "Euler a",
            "Euler",
            "LMS",
            "Heun",
            "DPM2",
            "DPM2 a",
            "DPM++ 2S a",
            "DPM fast",
            "DPM adaptive",
            "LMS Karras",
            "DDIM",
            "PLMS",
            "UniPC",
        ],
        "lcm_samplers": [
            "LCM",
            "LCM Karras"
        ]
    }


@app.get("/image/{image_path:path}")
async def get_image(image_path: str):
    """Serve generated images"""
    full_path = Path("outputs") / image_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(full_path, media_type="image/png")


if __name__ == "__main__":
    import torch  # Import here to check CUDA availability
    
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8001)),
        reload=os.getenv("ENV", "development") == "development",
        log_level="info"
    )