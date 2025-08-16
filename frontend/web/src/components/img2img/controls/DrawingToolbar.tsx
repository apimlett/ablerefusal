import React, { useState } from 'react';
import { Brush, Eraser, Palette, Circle } from 'lucide-react';
import { ChromePicker, ColorResult } from 'react-color';

interface DrawingToolbarProps {
  tool: 'brush' | 'eraser';
  onToolChange: (tool: 'brush' | 'eraser') => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  brushOpacity: number;
  onBrushOpacityChange: (opacity: number) => void;
  showColorPicker?: boolean;
  showOpacity?: boolean;
}

export default function DrawingToolbar({
  tool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  brushColor,
  onBrushColorChange,
  brushOpacity,
  onBrushOpacityChange,
  showColorPicker = true,
  showOpacity = true
}: DrawingToolbarProps) {
  const [showColorPopup, setShowColorPopup] = useState(false);

  const handleColorChange = (color: ColorResult) => {
    onBrushColorChange(color.hex);
  };

  return (
    <div className="space-y-4 p-4 bg-palenight-bgDark rounded-lg border border-palenight-border">
      {/* Tool Selection */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Tool
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToolChange('brush')}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
              ${tool === 'brush'
                ? 'bg-palenight-purple/20 border-palenight-purple text-palenight-purple'
                : 'bg-palenight-bgLight border-palenight-border text-palenight-text hover:border-palenight-purple/50'
              }
            `}
          >
            <Brush className="w-4 h-4" />
            <span className="text-sm">Brush</span>
          </button>
          <button
            type="button"
            onClick={() => onToolChange('eraser')}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
              ${tool === 'eraser'
                ? 'bg-palenight-purple/20 border-palenight-purple text-palenight-purple'
                : 'bg-palenight-bgLight border-palenight-border text-palenight-text hover:border-palenight-purple/50'
              }
            `}
          >
            <Eraser className="w-4 h-4" />
            <span className="text-sm">Eraser</span>
          </button>
        </div>
      </div>

      {/* Brush Size */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Brush Size: {brushSize}px
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            min="1"
            max="100"
            className="flex-1"
          />
          <div 
            className="w-8 h-8 rounded-full border-2 border-palenight-border flex items-center justify-center"
            style={{ backgroundColor: tool === 'brush' ? brushColor : 'transparent' }}
          >
            <Circle 
              className="text-palenight-text" 
              style={{ 
                width: Math.min(brushSize / 3, 24) + 'px', 
                height: Math.min(brushSize / 3, 24) + 'px',
                fill: tool === 'brush' ? brushColor : 'none'
              }} 
            />
          </div>
        </div>
      </div>

      {/* Color Picker (only for brush in sketch mode) */}
      {showColorPicker && tool === 'brush' && (
        <div>
          <label className="block text-sm font-medium text-palenight-text mb-2">
            Brush Color
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPopup(!showColorPopup)}
              className="w-full h-10 rounded-lg border-2 border-palenight-border flex items-center gap-2 px-3"
              style={{ backgroundColor: brushColor }}
            >
              <Palette className="w-4 h-4 text-white mix-blend-difference" />
              <span className="text-sm text-white mix-blend-difference">{brushColor}</span>
            </button>
            
            {showColorPopup && (
              <div className="absolute z-20 mt-2">
                <div 
                  className="fixed inset-0" 
                  onClick={() => setShowColorPopup(false)}
                />
                <ChromePicker
                  color={brushColor}
                  onChange={handleColorChange}
                  disableAlpha
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Brush Opacity */}
      {showOpacity && tool === 'brush' && (
        <div>
          <label className="block text-sm font-medium text-palenight-text mb-2">
            Opacity: {Math.round(brushOpacity * 100)}%
          </label>
          <input
            type="range"
            value={brushOpacity}
            onChange={(e) => onBrushOpacityChange(Number(e.target.value))}
            min="0"
            max="1"
            step="0.05"
            className="w-full"
          />
        </div>
      )}

      {/* Quick Color Presets (for sketch mode) */}
      {showColorPicker && tool === 'brush' && (
        <div>
          <label className="block text-sm font-medium text-palenight-text mb-2">
            Quick Colors
          </label>
          <div className="flex gap-2 flex-wrap">
            {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onBrushColorChange(color)}
                className={`
                  w-8 h-8 rounded-lg border-2 transition-all
                  ${brushColor === color ? 'border-palenight-purple scale-110' : 'border-palenight-border'}
                `}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}