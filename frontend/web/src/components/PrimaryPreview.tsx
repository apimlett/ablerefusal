'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Maximize2, 
  Copy, 
  ArrowRight,
  Info,
  RefreshCw
} from 'lucide-react';
import { GenerationResult } from '@/lib/api';
import sdApi from '@/lib/api';

interface PrimaryPreviewProps {
  currentImage: GenerationResult | null;
  onUseInImg2Img?: (imageUrl: string, metadata: any) => void;
  onRegenerate?: (params: any) => void;
}

export default function PrimaryPreview({ 
  currentImage, 
  onUseInImg2Img,
  onRegenerate
}: PrimaryPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentImage]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = async () => {
    if (!currentImage) return;
    
    const imageUrl = sdApi.getImageUrl(currentImage.image_url);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sd-${currentImage.seed}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const copySeed = () => {
    if (!currentImage) return;
    navigator.clipboard.writeText(currentImage.seed.toString());
  };

  if (!currentImage) {
    return (
      <div className="bg-palenight-bgDark rounded-xl border border-palenight-border p-8">
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-palenight-bgLight flex items-center justify-center">
            <Maximize2 className="w-8 h-8 text-palenight-comment" />
          </div>
          <h3 className="text-lg font-medium text-palenight-text mb-2">
            No Image Generated Yet
          </h3>
          <p className="text-sm text-palenight-comment max-w-md">
            Your generated images will appear here. This preview area will display your latest creation 
            and serve as a canvas for advanced editing features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-palenight-bgDark rounded-xl border border-palenight-border overflow-hidden">
      {/* Toolbar */}
      <div className="bg-palenight-bgLight border-b border-palenight-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-palenight-bgDark rounded-lg p-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgLight rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-sm text-palenight-text min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgLight rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1.5 text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgLight rounded transition-colors"
                title="Reset zoom"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Pan indicator */}
            {zoom > 1 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-palenight-bgDark rounded-lg">
                <Move className="w-4 h-4 text-palenight-comment" />
                <span className="text-xs text-palenight-comment">Drag to pan</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Info Toggle */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-lg transition-colors ${
                showInfo 
                  ? 'bg-palenight-purple text-white' 
                  : 'text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgDark'
              }`}
              title="Toggle info"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Action Buttons */}
            <button
              onClick={handleDownload}
              className="p-2 text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgDark rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>

            {onUseInImg2Img && (
              <button
                onClick={() => onUseInImg2Img(sdApi.getImageUrl(currentImage.image_url), currentImage.metadata)}
                className="px-3 py-1.5 bg-palenight-purple text-white rounded-lg hover:bg-palenight-purple/90 transition-colors flex items-center gap-2 text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Use in img2img
              </button>
            )}

            {onRegenerate && currentImage.metadata && (
              <button
                onClick={() => onRegenerate(currentImage.metadata)}
                className="px-3 py-1.5 bg-palenight-bgDark text-palenight-text rounded-lg hover:bg-palenight-bgLight transition-colors flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="relative bg-palenight-bgDark overflow-hidden"
        style={{ height: '600px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Checkerboard Background */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%, #808080 0% 75%, transparent 0%)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0, 20px 20px'
          }}
        />

        {/* Image Container */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <img
            ref={imageRef}
            src={sdApi.getImageUrl(currentImage.image_url)}
            alt={currentImage.metadata?.prompt || 'Generated image'}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            draggable={false}
          />
        </div>

        {/* Info Overlay */}
        {showInfo && (
          <div className="absolute top-4 right-4 bg-palenight-bgLight/95 backdrop-blur-sm rounded-lg p-4 max-w-sm border border-palenight-border">
            <h4 className="font-medium text-palenight-text mb-3">Image Details</h4>
            
            <div className="space-y-2 text-sm">
              {currentImage.metadata?.prompt && (
                <div>
                  <span className="text-palenight-comment">Prompt:</span>
                  <p className="text-palenight-text mt-1 line-clamp-3">
                    {currentImage.metadata.prompt}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <span className="text-palenight-comment">Size:</span>
                  <p className="text-palenight-text">{currentImage.width}×{currentImage.height}</p>
                </div>
                <div>
                  <span className="text-palenight-comment">Seed:</span>
                  <p className="text-palenight-text flex items-center gap-1">
                    {currentImage.seed}
                    <button onClick={copySeed} className="text-palenight-purple hover:text-palenight-purple/80">
                      <Copy className="w-3 h-3" />
                    </button>
                  </p>
                </div>
                {currentImage.metadata?.steps && (
                  <div>
                    <span className="text-palenight-comment">Steps:</span>
                    <p className="text-palenight-text">{currentImage.metadata.steps}</p>
                  </div>
                )}
                {currentImage.metadata?.cfg_scale && (
                  <div>
                    <span className="text-palenight-comment">CFG:</span>
                    <p className="text-palenight-text">{currentImage.metadata.cfg_scale}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Future Canvas Overlay for Inpainting */}
        <canvas 
          className="absolute inset-0 pointer-events-none"
          style={{ display: 'none' }} // Hidden for now, will be used for inpainting
        />
      </div>
    </div>
  );
}