'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Download, Maximize2, X, Info, Copy, Check, ArrowRight } from 'lucide-react';
import { GenerationResult } from '@/lib/api';
import sdApi from '@/lib/api';

interface ImageGalleryProps {
  images: GenerationResult[];
  onImageClick?: (image: GenerationResult) => void;
  onUseInImg2Img?: (imageUrl: string, metadata: any) => void;
}

export default function ImageGallery({ images, onImageClick, onUseInImg2Img }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GenerationResult | null>(null);
  const [copiedSeed, setCopiedSeed] = useState<number | null>(null);

  const handleDownload = async (image: GenerationResult) => {
    const imageUrl = sdApi.getImageUrl(image.image_url);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sd-${image.seed}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const copySeed = (seed: number) => {
    navigator.clipboard.writeText(seed.toString());
    setCopiedSeed(seed);
    setTimeout(() => setCopiedSeed(null), 2000);
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-palenight-comment">No images generated yet</p>
        <p className="text-sm text-palenight-comment mt-2">
          Enter a prompt and click Generate to create your first image
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div
            key={`${image.seed}-${index}`}
            className="card group relative overflow-hidden cursor-pointer hover:border-palenight-purple transition-all duration-200"
            onClick={() => setSelectedImage(image)}
          >
            {/* Image */}
            <div className="relative aspect-square bg-palenight-bgDark rounded-lg overflow-hidden">
              <img
                src={sdApi.getImageUrl(image.image_url)}
                alt={image.metadata?.prompt || 'Generated image'}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-palenight-bgDark/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-sm text-palenight-textBright line-clamp-2">
                    {image.metadata?.prompt}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {onUseInImg2Img && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseInImg2Img(sdApi.getImageUrl(image.image_url), image.metadata);
                    }}
                    className="p-2 bg-palenight-purple/80 backdrop-blur-sm rounded-lg hover:bg-palenight-purple transition-colors"
                    title="Use in img2img"
                  >
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(image);
                  }}
                  className="p-2 bg-palenight-bgDark/80 backdrop-blur-sm rounded-lg hover:bg-palenight-bgDark transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-palenight-textBright" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(image);
                  }}
                  className="p-2 bg-palenight-bgDark/80 backdrop-blur-sm rounded-lg hover:bg-palenight-bgDark transition-colors"
                  title="View fullscreen"
                >
                  <Maximize2 className="w-4 h-4 text-palenight-textBright" />
                </button>
              </div>
            </div>

            {/* Image info */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-palenight-comment">
                  {image.width}×{image.height}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copySeed(image.seed);
                  }}
                  className="text-xs text-palenight-purple hover:text-palenight-purple/80 flex items-center space-x-1"
                >
                  {copiedSeed === image.seed ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Seed: {image.seed}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-palenight-bgDark/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in">
          <div className="relative max-w-7xl w-full">
            {/* Close button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-palenight-text hover:text-palenight-textBright transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="bg-palenight-bgLight rounded-xl overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                {/* Image */}
                <div className="lg:flex-1 bg-palenight-bgDark p-8 flex items-center justify-center">
                  <img
                    src={sdApi.getImageUrl(selectedImage.image_url)}
                    alt={selectedImage.metadata?.prompt || 'Generated image'}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>

                {/* Metadata */}
                <div className="lg:w-96 p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold text-palenight-textBright flex items-center space-x-2">
                    <Info className="w-5 h-5 text-palenight-purple" />
                    <span>Image Details</span>
                  </h3>

                  {/* Prompt */}
                  <div>
                    <label className="text-sm font-medium text-palenight-purple">Prompt</label>
                    <p className="mt-1 text-sm text-palenight-text">
                      {selectedImage.metadata?.prompt || 'N/A'}
                    </p>
                    <button
                      onClick={() => copyPrompt(selectedImage.metadata?.prompt || '')}
                      className="mt-2 text-xs text-palenight-blue hover:text-palenight-blue/80 flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy prompt</span>
                    </button>
                  </div>

                  {/* Negative Prompt */}
                  {selectedImage.metadata?.negative && (
                    <div>
                      <label className="text-sm font-medium text-palenight-purple">Negative Prompt</label>
                      <p className="mt-1 text-sm text-palenight-text">
                        {selectedImage.metadata.negative}
                      </p>
                    </div>
                  )}

                  {/* Technical Details */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-palenight-purple">Technical Details</label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-palenight-comment">Dimensions:</span>
                        <p className="text-palenight-text">{selectedImage.width}×{selectedImage.height}</p>
                      </div>
                      <div>
                        <span className="text-palenight-comment">Seed:</span>
                        <p className="text-palenight-text">{selectedImage.seed}</p>
                      </div>
                      <div>
                        <span className="text-palenight-comment">Steps:</span>
                        <p className="text-palenight-text">{selectedImage.metadata?.steps || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-palenight-comment">CFG Scale:</span>
                        <p className="text-palenight-text">{selectedImage.metadata?.cfg_scale || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-palenight-comment">Sampler:</span>
                        <p className="text-palenight-text">{selectedImage.metadata?.sampler || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-palenight-comment">Model:</span>
                        <p className="text-palenight-text">{selectedImage.metadata?.model || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col space-y-2 pt-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(selectedImage)}
                        className="btn-primary flex-1 flex items-center justify-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => copySeed(selectedImage.seed)}
                        className="btn-secondary flex-1 flex items-center justify-center space-x-2"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy Seed</span>
                      </button>
                    </div>
                    {onUseInImg2Img && (
                      <button
                        onClick={() => {
                          onUseInImg2Img(sdApi.getImageUrl(selectedImage.image_url), selectedImage.metadata);
                          setSelectedImage(null);
                        }}
                        className="w-full btn-primary bg-gradient-to-r from-palenight-purple to-palenight-pink flex items-center justify-center space-x-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>Use in Image to Image</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}