import React from 'react';
import { Image, Brush, Eraser, Palette } from 'lucide-react';

export type Img2ImgMode = 'normal' | 'sketch' | 'inpaint' | 'inpaint_sketch';

interface Img2ImgModeSelectorProps {
  mode: Img2ImgMode;
  onModeChange: (mode: Img2ImgMode) => void;
  disabled?: boolean;
}

export default function Img2ImgModeSelector({ 
  mode, 
  onModeChange, 
  disabled = false 
}: Img2ImgModeSelectorProps) {
  const modes = [
    {
      id: 'normal' as Img2ImgMode,
      label: 'Normal',
      icon: Image,
      description: 'Standard image-to-image transformation'
    },
    {
      id: 'sketch' as Img2ImgMode,
      label: 'Sketch',
      icon: Brush,
      description: 'Draw on top of the image'
    },
    {
      id: 'inpaint' as Img2ImgMode,
      label: 'Inpaint',
      icon: Eraser,
      description: 'Mask areas to regenerate'
    },
    {
      id: 'inpaint_sketch' as Img2ImgMode,
      label: 'Inpaint Sketch',
      icon: Palette,
      description: 'Combine masking with drawing'
    }
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        {modes.map((modeOption) => {
          const Icon = modeOption.icon;
          const isActive = mode === modeOption.id;
          
          return (
            <button
              key={modeOption.id}
              type="button"
              onClick={() => onModeChange(modeOption.id)}
              disabled={disabled}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                ${isActive 
                  ? 'bg-palenight-purple/20 border-palenight-purple text-palenight-purple' 
                  : 'bg-palenight-bgLight border-palenight-border text-palenight-text hover:border-palenight-purple/50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={modeOption.description}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{modeOption.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-palenight-comment mt-2">
        {modes.find(m => m.id === mode)?.description}
      </p>
    </div>
  );
}