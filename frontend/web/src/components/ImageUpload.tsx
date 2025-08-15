'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (base64: string) => void;
  onImageClear: () => void;
  currentImage: string | null;
  disabled?: boolean;
}

export default function ImageUpload({ 
  onImageSelect, 
  onImageClear, 
  currentImage,
  disabled = false 
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onImageSelect(base64);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <div className="w-full">
      {!currentImage ? (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-palenight-purple bg-palenight-purple/10' 
              : 'border-palenight-border hover:border-palenight-purple/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
          
          <Upload className="w-8 h-8 mx-auto mb-2 text-palenight-comment" />
          <p className="text-sm text-palenight-text">
            Drop an image here or click to upload
          </p>
          <p className="text-xs text-palenight-comment mt-1">
            PNG, JPG, WEBP up to 10MB
          </p>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden bg-palenight-bgDark border border-palenight-border">
          <img 
            src={currentImage} 
            alt="Initial image" 
            className="w-full h-48 object-cover"
          />
          <button
            onClick={onImageClear}
            disabled={disabled}
            className="absolute top-2 right-2 p-1.5 bg-palenight-bgDark/80 rounded-lg hover:bg-palenight-red/20 transition-colors"
            title="Remove image"
          >
            <X className="w-4 h-4 text-palenight-text" />
          </button>
          <div className="absolute bottom-2 left-2 flex items-center space-x-2 bg-palenight-bgDark/80 px-2 py-1 rounded">
            <ImageIcon className="w-3 h-3 text-palenight-purple" />
            <span className="text-xs text-palenight-text">Image-to-Image Mode</span>
          </div>
        </div>
      )}
    </div>
  );
}