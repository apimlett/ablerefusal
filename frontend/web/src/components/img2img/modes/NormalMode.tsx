import React from 'react';
import ImageUpload from '../../ImageUpload';

interface NormalModeProps {
  initImage: string | null;
  onImageSelect: (image: string) => void;
  onImageClear: () => void;
  isGenerating: boolean;
  strength: number;
  onStrengthChange: (strength: number) => void;
}

export default function NormalMode({
  initImage,
  onImageSelect,
  onImageClear,
  isGenerating,
  strength,
  onStrengthChange
}: NormalModeProps) {
  return (
    <div className="space-y-6">
      {/* Initial Image Upload */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Initial Image *
        </label>
        <ImageUpload
          onImageSelect={onImageSelect}
          onImageClear={onImageClear}
          currentImage={initImage}
          disabled={isGenerating}
        />
      </div>

      {/* Denoising Strength */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Denoising Strength: {strength.toFixed(2)}
        </label>
        <div className="space-y-2">
          <input
            type="range"
            value={strength}
            onChange={(e) => onStrengthChange(Number(e.target.value))}
            min="0"
            max="1"
            step="0.05"
            className="w-full"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-xs text-palenight-comment">
            <span>More Original</span>
            <span>More Creative</span>
          </div>
        </div>
        <p className="text-sm text-palenight-comment mt-2">
          Lower values preserve more of the original image, higher values allow more changes
        </p>
      </div>
    </div>
  );
}