import React, { useState } from 'react';
import ImageUpload from '../../ImageUpload';
import CanvasEditor from '../CanvasEditorWrapper';
import DrawingToolbar from '../controls/DrawingToolbar';

interface SketchModeProps {
  initImage: string | null;
  onImageSelect: (image: string) => void;
  onImageClear: () => void;
  onSketchChange: (sketchDataUrl: string) => void;
  isGenerating: boolean;
  strength: number;
  onStrengthChange: (strength: number) => void;
}

export default function SketchMode({
  initImage,
  onImageSelect,
  onImageClear,
  onSketchChange,
  isGenerating,
  strength,
  onStrengthChange
}: SketchModeProps) {
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(10);
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushOpacity, setBrushOpacity] = useState(1);

  return (
    <div className="space-y-6">
      {/* Initial Image Upload */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Base Image *
        </label>
        <ImageUpload
          onImageSelect={onImageSelect}
          onImageClear={onImageClear}
          currentImage={initImage}
          disabled={isGenerating}
        />
      </div>

      {/* Canvas Editor */}
      {initImage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-palenight-text mb-2">
              Draw on Canvas
            </label>
            <CanvasEditor
              width={512}
              height={512}
              backgroundImage={initImage}
              brushColor={brushColor}
              brushSize={brushSize}
              brushOpacity={brushOpacity}
              tool={tool}
              mode="sketch"
              onCanvasChange={onSketchChange}
            />
          </div>
          
          <div className="lg:col-span-1">
            <DrawingToolbar
              tool={tool}
              onToolChange={setTool}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              brushColor={brushColor}
              onBrushColorChange={setBrushColor}
              brushOpacity={brushOpacity}
              onBrushOpacityChange={setBrushOpacity}
              showColorPicker={true}
              showOpacity={true}
            />
          </div>
        </div>
      )}

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
          Controls how much the AI modifies your sketch
        </p>
      </div>
    </div>
  );
}