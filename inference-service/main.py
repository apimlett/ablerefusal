"""
AbleRefusal Inference Service
FastAPI service for Stable Diffusion inference with full diffusers support
"""

import os
import asyncio
import logging
import base64
import time
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from pathlib import Path
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_serializer
import uvicorn
import torch
import json

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

@app.middleware("http")
async def encryption_middleware(request: Request, call_next):
    """Middleware to handle encrypted requests and responses"""
    # Skip encryption for health endpoint
    if request.url.path == "/health":
        return await call_next(request)
    
    # Only process POST requests with bodies
    if request.method == "POST" and os.getenv("ENABLE_INFERENCE_ENCRYPTION") == "true":
        # Check if request has encrypted content
        if request.headers.get("X-Encrypted") == "true":
            try:
                # Read and decrypt the body
                body = await request.body()
                decrypted_data = decrypt_json_request(body)
                
                # Create new request with decrypted body
                async def receive():
                    return {
                        "type": "http.request",
                        "body": json.dumps(decrypted_data).encode()
                    }
                
                request._receive = receive
            except Exception as e:
                logger.error(f"Failed to decrypt request: {e}")
                return JSONResponse(
                    status_code=400,
                    content={"error": "Failed to decrypt request"}
                )
    
    # Process the request
    response = await call_next(request)
    
    # Encrypt response if needed (for JSON responses)
    if os.getenv("ENABLE_INFERENCE_ENCRYPTION") == "true" and request.url.path != "/health":
        # Check if it's a JSON response
        if response.headers.get("content-type", "").startswith("application/json"):
            # Read the response body
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            try:
                # Parse and encrypt the JSON
                json_data = json.loads(body)
                encrypted_body = encrypt_if_needed(json.dumps(json_data))
                
                # Return encrypted response
                return Response(
                    content=encrypted_body,
                    media_type="application/octet-stream",
                    headers={"X-Encrypted": "true"}
                )
            except:
                # If not JSON or encryption fails, return original
                return Response(content=body, media_type=response.headers.get("content-type"))
    
    return response

# Global inference engine instance
inference_engine: Optional[InferenceEngine] = None

# In-memory job storage with TTL support
jobs: Dict[str, Dict[str, Any]] = {}

# Request deduplication cache
request_cache: Dict[str, str] = {}  # hash -> job_id

# Configuration
JOB_CACHE_MINUTES = int(os.getenv("JOB_CACHE_MINUTES", "3"))
CLEANUP_INTERVAL_SECONDS = int(os.getenv("CLEANUP_INTERVAL_SECONDS", "30"))
REQUEST_CACHE_SECONDS = int(os.getenv("REQUEST_CACHE_SECONDS", "30"))


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
    # Image-to-image parameters
    init_image: Optional[str] = None  # Base64 encoded image
    strength: float = Field(default=0.75, ge=0.0, le=1.0)  # Denoising strength


class GenerateResponse(BaseModel):
    job_id: str
    status: str
    message: str


class ImageResult(BaseModel):
    image_id: str
    image_data: str  # Base64 encoded image
    seed: int
    width: int
    height: int
    metadata: Dict[str, Any]


class JobStatus(BaseModel):
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: float
    current_step: int
    total_steps: int
    message: Optional[str] = None
    results: Optional[List[ImageResult]] = None  # List of image results
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


def get_encryption_key():
    """Get or create encryption key from environment"""
    secret = os.getenv("INFERENCE_ENCRYPTION_SECRET", "default-secret-key-change-in-production")
    # Derive a 32-byte key using SHA256
    digest = hashes.Hash(hashes.SHA256(), backend=default_backend())
    digest.update(secret.encode())
    return digest.finalize()

def encrypt_if_needed(data: str) -> str:
    """Encrypt data if encryption is enabled"""
    if os.getenv("ENABLE_INFERENCE_ENCRYPTION") != "true":
        return data
    
    key = get_encryption_key()
    iv = os.urandom(16)  # AES block size
    
    cipher = Cipher(
        algorithms.AES(key),
        modes.CFB(iv),
        backend=default_backend()
    )
    encryptor = cipher.encryptor()
    
    plaintext = data.encode()
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    
    # Combine IV and ciphertext, then base64 encode
    encrypted = base64.b64encode(iv + ciphertext).decode('utf-8')
    return encrypted

def decrypt_if_needed(data: str) -> str:
    """Decrypt data if encryption is enabled"""
    if os.getenv("ENABLE_INFERENCE_ENCRYPTION") != "true":
        return data
    
    key = get_encryption_key()
    encrypted_bytes = base64.b64decode(data)
    
    # Extract IV and ciphertext
    iv = encrypted_bytes[:16]
    ciphertext = encrypted_bytes[16:]
    
    cipher = Cipher(
        algorithms.AES(key),
        modes.CFB(iv),
        backend=default_backend()
    )
    decryptor = cipher.decryptor()
    
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    return plaintext.decode('utf-8')

def encrypt_json_response(data: dict) -> str:
    """Encrypt JSON response if encryption is enabled"""
    if os.getenv("ENABLE_INFERENCE_ENCRYPTION") != "true":
        return json.dumps(data)
    
    json_str = json.dumps(data)
    return encrypt_if_needed(json_str)

def decrypt_json_request(encrypted_body: bytes) -> dict:
    """Decrypt JSON request if encryption is enabled"""
    if os.getenv("ENABLE_INFERENCE_ENCRYPTION") != "true":
        return json.loads(encrypted_body)
    
    # Decrypt the body
    decrypted = decrypt_if_needed(encrypted_body.decode('utf-8'))
    return json.loads(decrypted)

async def cleanup_expired_jobs():
    """Background task to clean up expired jobs and request cache"""
    while True:
        try:
            current_time = datetime.now(timezone.utc)
            
            # Clean up expired jobs
            expired_jobs = []
            for job_id, job_data in jobs.items():
                created_at = job_data.get("created_at")
                if created_at and isinstance(created_at, datetime):
                    age_minutes = (current_time - created_at).total_seconds() / 60
                    if age_minutes > JOB_CACHE_MINUTES:
                        expired_jobs.append(job_id)
            
            for job_id in expired_jobs:
                logger.info(f"Cleaning up expired job: {job_id} (aged out after {JOB_CACHE_MINUTES} minutes)")
                del jobs[job_id]
            
            if expired_jobs:
                logger.info(f"Cleaned up {len(expired_jobs)} expired jobs")
            
            # Clean up expired request cache entries
            expired_requests = []
            current_timestamp = time.time()
            for req_hash, cache_data in list(request_cache.items()):
                if isinstance(cache_data, dict):
                    if current_timestamp - cache_data.get("timestamp", 0) > REQUEST_CACHE_SECONDS:
                        expired_requests.append(req_hash)
            
            for req_hash in expired_requests:
                del request_cache[req_hash]
            
            # Wait before next cleanup
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)

@app.on_event("startup")
async def startup_event():
    """Initialize the inference engine on startup"""
    global inference_engine
    
    logger.info("Starting AbleRefusal Inference Service...")
    
    # Log configuration
    logger.info(f"Job cache TTL: {JOB_CACHE_MINUTES} minutes")
    logger.info(f"Cleanup interval: {CLEANUP_INTERVAL_SECONDS} seconds")
    logger.info(f"Request deduplication cache: {REQUEST_CACHE_SECONDS} seconds")
    
    # Log encryption status
    if os.getenv("ENABLE_INFERENCE_ENCRYPTION") == "true":
        logger.info("End-to-end encryption is ENABLED for image transfers")
    else:
        logger.info("End-to-end encryption is DISABLED for image transfers")
    
    # Start cleanup task
    asyncio.create_task(cleanup_expired_jobs())
    
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
    
    # Check request cache for deduplication
    request_hash = hashlib.sha256(
        f"{request.prompt}{request.negative_prompt}{request.width}{request.height}"
        f"{request.steps}{request.cfg_scale}{request.sampler}{request.model}".encode()
    ).hexdigest()[:16]
    
    # Check if identical request is already processing
    if request_hash in request_cache:
        cache_entry = request_cache[request_hash]
        if isinstance(cache_entry, dict) and time.time() - cache_entry.get("timestamp", 0) < REQUEST_CACHE_SECONDS:
            existing_job_id = cache_entry.get("job_id")
            if existing_job_id in jobs:
                logger.info(f"Request deduplicated, returning existing job: {existing_job_id}")
                return GenerateResponse(
                    job_id=existing_job_id,
                    status="accepted",
                    message="Using existing generation job (duplicate request)"
                )
    
    # Create new job ID
    job_id = str(uuid.uuid4())
    
    # Add to request cache
    request_cache[request_hash] = {
        "job_id": job_id,
        "timestamp": time.time()
    }
    
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
        from inference_engine import GenerationRequest as EngineGenerationRequest
        gen_request = EngineGenerationRequest(
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
            clip_skip=request.clip_skip,
            init_image=request.init_image,
            strength=request.strength
        )
        
        # Run generation
        results = await inference_engine.generate(
            gen_request,
            progress_callback=progress_callback
        )
        
        # Update job status with base64 image data
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100.0
        jobs[job_id]["results"] = [
            {
                "image_id": r.image_path,  # Use image_path as ID
                "image_data": encrypt_if_needed(r.image_data),  # Encrypted base64 image
                "seed": r.seed,
                "width": r.width,
                "height": r.height,
                "metadata": r.metadata
            }
            for r in results
        ]
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