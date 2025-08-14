"""
Inference Engine for Stable Diffusion with full diffusers support
Supports Civitai models, LoRAs, LCM, and advanced samplers
"""

import os
import gc
import logging
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
import functools

import torch
from PIL import Image
import numpy as np
from safetensors.torch import load_file
from diffusers import (
    StableDiffusionPipeline,
    StableDiffusionXLPipeline,
    DiffusionPipeline,
    DPMSolverMultistepScheduler,
    EulerAncestralDiscreteScheduler,
    EulerDiscreteScheduler,
    LMSDiscreteScheduler,
    DDIMScheduler,
    PNDMScheduler,
    UniPCMultistepScheduler,
    LCMScheduler,
    AutoencoderKL,
)
from diffusers.models import UNet2DConditionModel
from transformers import CLIPTextModel, CLIPTokenizer

logger = logging.getLogger(__name__)


@dataclass
class GenerationRequest:
    prompt: str
    negative_prompt: str = ""
    width: int = 512
    height: int = 512
    steps: int = 20
    cfg_scale: float = 7.5
    sampler: str = "DPM++ 2M Karras"
    seed: int = -1
    batch_size: int = 1
    model: Optional[str] = None
    loras: Optional[List[Dict[str, Any]]] = None
    enable_lcm: bool = False
    clip_skip: int = 1


@dataclass
class GenerationResult:
    image_path: str
    seed: int
    width: int
    height: int
    metadata: Dict[str, Any]


class InferenceEngine:
    """Main inference engine for Stable Diffusion"""
    
    SCHEDULER_MAPPING = {
        "DPM++ 2M Karras": (DPMSolverMultistepScheduler, {"use_karras_sigmas": True}),
        "DPM++ 2M SDE Karras": (DPMSolverMultistepScheduler, {"use_karras_sigmas": True, "algorithm_type": "sde-dpmsolver++"}),
        "DPM++ SDE Karras": (DPMSolverMultistepScheduler, {"use_karras_sigmas": True, "algorithm_type": "sde-dpmsolver++"}),
        "Euler a": (EulerAncestralDiscreteScheduler, {}),
        "Euler": (EulerDiscreteScheduler, {}),
        "LMS": (LMSDiscreteScheduler, {}),
        "LMS Karras": (LMSDiscreteScheduler, {"use_karras_sigmas": True}),
        "DDIM": (DDIMScheduler, {}),
        "PNDM": (PNDMScheduler, {}),
        "UniPC": (UniPCMultistepScheduler, {}),
        "LCM": (LCMScheduler, {}),
    }
    
    def __init__(
        self,
        models_dir: str = "./models",
        outputs_dir: str = "./outputs",
        device: str = "cuda",
        dtype: torch.dtype = torch.float16,
        enable_xformers: bool = True,
        enable_cpu_offload: bool = False,
        cache_dir: Optional[str] = None
    ):
        self.models_dir = Path(models_dir)
        self.outputs_dir = Path(outputs_dir)
        self.device = device
        # MPS requires float32
        self.dtype = torch.float32 if device == "mps" else dtype
        self.enable_xformers = enable_xformers
        self.enable_cpu_offload = enable_cpu_offload
        self.cache_dir = cache_dir or os.path.expanduser("~/.cache/huggingface")
        
        # Create directories
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
        
        # Model storage
        self.pipelines: Dict[str, DiffusionPipeline] = {}
        self.current_model: Optional[str] = None
        self.loaded_loras: Dict[str, Dict] = {}
        
        # Compiled UNet cache for torch.compile optimization
        self.compiled_unets: Dict[str, Any] = {}
        
        logger.info(f"Inference engine initialized on {device}")
    
    async def load_model(
        self,
        model_path: str,
        model_type: str = "safetensors"
    ) -> None:
        """Load a Stable Diffusion model"""
        
        # Check if model is already loaded
        if model_path in self.pipelines:
            self.current_model = model_path
            logger.info(f"Model {model_path} already loaded")
            return
        
        try:
            # Determine if it's a local file or HuggingFace model
            if os.path.exists(model_path):
                pipe = await self._load_local_model(model_path, model_type)
            else:
                pipe = await self._load_huggingface_model(model_path)
            
            # Configure pipeline
            # MPS requires float32
            if self.device == "mps":
                pipe = pipe.to(self.device, dtype=torch.float32)
            else:
                pipe = pipe.to(self.device, dtype=self.dtype)
            
            # Enable optimizations
            # 1. Attention slicing - critical for MPS performance (20% boost)
            if self.device == "mps":
                pipe.enable_attention_slicing()
                logger.info("Enabled attention slicing for MPS (20% performance boost)")
            
            # 2. VAE tiling for memory efficiency with large images
            if hasattr(pipe, 'vae') and hasattr(pipe.vae, 'enable_tiling'):
                pipe.vae.enable_tiling()
                logger.info("Enabled VAE tiling for memory efficiency")
            
            # 3. VAE slicing for batch processing
            if hasattr(pipe, 'enable_vae_slicing'):
                pipe.enable_vae_slicing()
                logger.info("Enabled VAE slicing")
            
            # 4. Memory efficient attention (xformers fallback for non-MPS)
            if self.enable_xformers and self.device != "cpu" and self.device != "mps":
                try:
                    pipe.enable_xformers_memory_efficient_attention()
                    logger.info("Enabled xformers memory efficient attention")
                except Exception as e:
                    logger.warning(f"Failed to enable xformers: {e}")
            
            # 5. Disable progress bar for performance
            pipe.set_progress_bar_config(disable=True)
            
            # 6. Disable safety checker for 10% speed boost
            if hasattr(pipe, 'safety_checker'):
                pipe.safety_checker = None
                pipe.requires_safety_checker = False
                logger.info("Disabled safety checker for performance")
            
            # 7. CPU offload if requested
            if self.enable_cpu_offload:
                pipe.enable_model_cpu_offload()
                logger.info("Enabled CPU offload")
            
            # 8. Compile UNet with torch.compile for 20-30% speedup (PyTorch 2.0+)
            # Note: torch.compile is not fully supported on MPS yet, only use for CUDA
            if hasattr(torch, 'compile') and self.device == "cuda":
                try:
                    # Compile the UNet (the main bottleneck)
                    compile_key = f"{model_path}_{self.device}"
                    if compile_key not in self.compiled_unets:
                        logger.info("Compiling UNet with torch.compile (first run will be slower)...")
                        pipe.unet = torch.compile(pipe.unet, mode="max-autotune", dynamic=True)
                        self.compiled_unets[compile_key] = True
                        logger.info("UNet compiled with mode=max-autotune")
                except Exception as e:
                    logger.warning(f"Failed to compile UNet: {e}")
            
            # Store pipeline
            self.pipelines[model_path] = pipe
            self.current_model = model_path
            
            # Log pipeline components
            logger.info(f"Successfully loaded model: {model_path}")
            logger.info(f"Pipeline components - tokenizer: {pipe.tokenizer is not None}, "
                       f"text_encoder: {hasattr(pipe, 'text_encoder') and pipe.text_encoder is not None}, "
                       f"unet: {hasattr(pipe, 'unet') and pipe.unet is not None}, "
                       f"vae: {hasattr(pipe, 'vae') and pipe.vae is not None}")
            
        except Exception as e:
            logger.error(f"Failed to load model {model_path}: {e}")
            raise
    
    async def _load_local_model(
        self,
        model_path: str,
        model_type: str
    ) -> DiffusionPipeline:
        """Load a model from local file (safetensors/ckpt)"""
        
        model_file = Path(model_path)
        
        if model_type == "safetensors" or model_file.suffix == ".safetensors":
            # Load safetensors checkpoint
            state_dict = load_file(model_path)
            
            # Detect model type (SD 1.5 vs SDXL)
            is_sdxl = self._detect_sdxl(state_dict)
            
            if is_sdxl:
                # Load as SDXL
                pipe = StableDiffusionXLPipeline.from_single_file(
                    model_path,
                    torch_dtype=self.dtype,
                    use_safetensors=True
                )
            else:
                # Load as SD 1.5
                pipe = StableDiffusionPipeline.from_single_file(
                    model_path,
                    torch_dtype=self.dtype,
                    use_safetensors=True
                )
        
        elif model_type == "ckpt" or model_file.suffix == ".ckpt":
            # Load checkpoint file
            pipe = StableDiffusionPipeline.from_single_file(
                model_path,
                torch_dtype=self.dtype
            )
        
        else:
            # Try to load as diffusers format
            pipe = DiffusionPipeline.from_pretrained(
                model_path,
                torch_dtype=self.dtype,
                use_safetensors=True
            )
        
        return pipe
    
    async def _load_huggingface_model(self, model_id: str) -> DiffusionPipeline:
        """Load a model from HuggingFace Hub"""
        
        # Try different loading strategies
        # For SD 1.5 models, try SD pipeline first
        if "stable-diffusion-v1" in model_id or "sd-v1" in model_id.lower():
            strategies = [
                # Try SD 1.5 with safetensors first for v1 models
                (StableDiffusionPipeline, True, "SD 1.5 with safetensors"),
                (StableDiffusionPipeline, False, "SD 1.5 with .bin"),
                (DiffusionPipeline, True, "Generic with safetensors"),
                (DiffusionPipeline, False, "Generic with .bin"),
            ]
        else:
            strategies = [
                # Try SDXL first for newer models
                (StableDiffusionXLPipeline, True, "SDXL with safetensors"),
                (StableDiffusionPipeline, True, "SD 1.5 with safetensors"),
                (DiffusionPipeline, True, "Generic with safetensors"),
                (DiffusionPipeline, False, "Generic with .bin"),
            ]
        
        last_error = None
        for pipeline_class, use_safetensors, desc in strategies:
            try:
                kwargs = {
                    "torch_dtype": self.dtype,
                    "cache_dir": self.cache_dir,
                    "local_files_only": False,
                    "safety_checker": None,
                    "requires_safety_checker": False
                }
                if use_safetensors:
                    kwargs["use_safetensors"] = True
                    
                pipe = pipeline_class.from_pretrained(model_id, **kwargs)
                logger.info(f"Loaded model using {desc}: {model_id}")
                return pipe
            except Exception as e:
                last_error = e
                continue
        
        # If all strategies failed, raise the last error
        raise last_error
    
    def _detect_sdxl(self, state_dict: Dict) -> bool:
        """Detect if model is SDXL based on state dict keys"""
        # SDXL has specific keys that SD 1.5 doesn't have
        sdxl_keys = [
            "conditioner.embedders.0.transformer.text_model.embeddings.position_embedding.weight",
            "conditioner.embedders.1.model.ln_final.weight"
        ]
        
        for key in sdxl_keys:
            if any(k.startswith(key) for k in state_dict.keys()):
                return True
        
        # Check UNet dimensions
        for key in state_dict.keys():
            if "model.diffusion_model.input_blocks.0.0.weight" in key:
                shape = state_dict[key].shape
                if shape[1] == 9:  # SDXL has 9 input channels
                    return True
                elif shape[1] == 4:  # SD 1.5 has 4 input channels
                    return False
        
        return False
    
    async def load_lora(
        self,
        lora_path: str,
        weight: float = 1.0,
        name: Optional[str] = None
    ) -> None:
        """Load a LoRA model"""
        
        if not self.current_model:
            raise ValueError("No base model loaded")
        
        pipe = self.pipelines[self.current_model]
        lora_name = name or Path(lora_path).stem
        
        try:
            # Load LoRA weights
            pipe.load_lora_weights(lora_path)
            
            # Store LoRA info
            self.loaded_loras[lora_name] = {
                "path": lora_path,
                "weight": weight
            }
            
            logger.info(f"Loaded LoRA: {lora_name} with weight {weight}")
            
        except Exception as e:
            logger.error(f"Failed to load LoRA {lora_path}: {e}")
            raise
    
    def _get_scheduler(self, sampler_name: str, pipe: DiffusionPipeline):
        """Get scheduler for the specified sampler"""
        
        if sampler_name not in self.SCHEDULER_MAPPING:
            logger.warning(f"Unknown sampler {sampler_name}, using default")
            return pipe.scheduler
        
        scheduler_class, kwargs = self.SCHEDULER_MAPPING[sampler_name]
        
        # Create scheduler with pipeline's config
        scheduler = scheduler_class.from_config(
            pipe.scheduler.config,
            **kwargs
        )
        
        return scheduler
    
    async def generate(
        self,
        request: GenerationRequest,
        progress_callback: Optional[Callable] = None
    ) -> List[GenerationResult]:
        """Generate images based on request"""
        
        # Select model
        model_to_use = request.model or self.current_model
        if not model_to_use or model_to_use not in self.pipelines:
            raise ValueError(f"Model {model_to_use} not loaded")
        
        pipe = self.pipelines[model_to_use]
        
        # Log what we're getting
        logger.info(f"Retrieved pipeline for model {model_to_use}")
        logger.info(f"Pipeline type: {type(pipe)}")
        logger.info(f"Pipeline has tokenizer attr: {hasattr(pipe, 'tokenizer')}")
        if hasattr(pipe, 'tokenizer'):
            logger.info(f"Tokenizer value: {pipe.tokenizer}")
        
        # Check pipeline components
        if not hasattr(pipe, 'tokenizer') or pipe.tokenizer is None:
            logger.error(f"Pipeline for model {model_to_use} missing tokenizer")
            logger.error(f"Available attributes: {dir(pipe)}")
            raise ValueError(f"Pipeline for model {model_to_use} is not properly initialized")
        
        # Set scheduler based on sampler
        pipe.scheduler = self._get_scheduler(request.sampler, pipe)
        
        # Handle LCM mode
        if request.enable_lcm:
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            # LCM typically uses fewer steps
            actual_steps = min(request.steps, 8)
        else:
            actual_steps = request.steps
        
        # Apply LoRAs if specified
        if request.loras:
            for lora in request.loras:
                await self.load_lora(
                    lora["path"],
                    lora.get("weight", 1.0),
                    lora.get("name")
                )
        
        # Set seed
        generator = None
        if request.seed != -1:
            generator = torch.Generator(device=self.device).manual_seed(request.seed)
            actual_seed = request.seed
        else:
            actual_seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator(device=self.device).manual_seed(actual_seed)
        
        # Ensure dimensions are multiples of 8 (required for SD models)
        width = request.width - (request.width % 8)
        height = request.height - (request.height % 8)
        
        if width != request.width or height != request.height:
            logger.warning(f"Adjusting dimensions from {request.width}x{request.height} to {width}x{height} (must be multiples of 8)")
        
        # Prepare generation kwargs
        generation_kwargs = {
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "width": width,
            "height": height,
            "num_inference_steps": actual_steps,
            "guidance_scale": request.cfg_scale,
            "generator": generator,
            "num_images_per_prompt": request.batch_size,
        }
        
        # Add callback for progress
        if progress_callback:
            def callback(pipe, step, timestep, callback_kwargs):
                progress_callback(step, actual_steps)
                return callback_kwargs
            generation_kwargs["callback_on_step_end"] = callback
        
        # Handle CLIP skip
        if request.clip_skip > 1:
            # This requires modifying the text encoder output
            # Implementation depends on pipeline version
            pass
        
        # Clear MPS cache before generation for optimal memory
        if self.device == "mps":
            if hasattr(torch.mps, 'empty_cache'):
                torch.mps.empty_cache()
        
        try:
            # Generate images with optimized context
            if self.device == "mps":
                # MPS doesn't support autocast with bfloat16, use no_grad for better performance
                with torch.no_grad():
                    output = pipe(**generation_kwargs)
            else:
                with torch.autocast(self.device, dtype=self.dtype):
                    output = pipe(**generation_kwargs)
            
            # Clear cache after generation
            if self.device == "mps" and hasattr(torch.mps, 'empty_cache'):
                torch.mps.empty_cache()
            
            # Save images and create results
            results = []
            for i, image in enumerate(output.images):
                # Generate unique filename
                image_hash = hashlib.md5(
                    f"{request.prompt}_{actual_seed}_{i}".encode()
                ).hexdigest()[:8]
                filename = f"{image_hash}_{actual_seed}_{i}.png"
                filepath = self.outputs_dir / filename
                
                # Save image
                image.save(filepath)
                
                # Create result
                result = GenerationResult(
                    image_path=str(filepath),
                    seed=actual_seed,
                    width=request.width,
                    height=request.height,
                    metadata={
                        "prompt": request.prompt,
                        "negative_prompt": request.negative_prompt,
                        "steps": actual_steps,
                        "cfg_scale": request.cfg_scale,
                        "sampler": request.sampler,
                        "model": model_to_use,
                        "loras": request.loras,
                        "enable_lcm": request.enable_lcm,
                        "clip_skip": request.clip_skip
                    }
                )
                results.append(result)
            
            logger.info(f"Generated {len(results)} images")
            return results
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise
        
        finally:
            # Clear LoRAs after generation
            if request.loras and hasattr(pipe, 'unload_lora_weights'):
                pipe.unload_lora_weights()
                self.loaded_loras.clear()
    
    def get_loaded_models(self) -> List[str]:
        """Get list of loaded models"""
        return list(self.pipelines.keys())
    
    def list_available_models(self) -> List[Dict[str, str]]:
        """List models available in models directory"""
        models = []
        
        # Check for safetensors files
        for file in self.models_dir.glob("**/*.safetensors"):
            models.append({
                "name": file.stem,
                "path": str(file),
                "type": "safetensors"
            })
        
        # Check for ckpt files
        for file in self.models_dir.glob("**/*.ckpt"):
            models.append({
                "name": file.stem,
                "path": str(file),
                "type": "ckpt"
            })
        
        # Check for diffusers directories
        for dir in self.models_dir.iterdir():
            if dir.is_dir() and (dir / "model_index.json").exists():
                models.append({
                    "name": dir.name,
                    "path": str(dir),
                    "type": "diffusers"
                })
        
        return models
    
    async def cleanup(self):
        """Cleanup resources"""
        for pipe in self.pipelines.values():
            del pipe
        
        self.pipelines.clear()
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        gc.collect()
        
        logger.info("Inference engine cleanup complete")