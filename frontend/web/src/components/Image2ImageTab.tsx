import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Upload, X } from 'lucide-react';
import ImageUpload from './ImageUpload';

interface Image2ImageTabProps {
  onGenerate: (params: any) => void;
  isGenerating: boolean;
  models: Array<{ id: string; name: string }>;
  currentModel: string;
  onModelChange: (model: string) => void;
  transferredImage?: string;
  transferredParams?: any;
  onTransferConsumed?: () => void;
}

export default function Image2ImageTab({ 
  onGenerate, 
  isGenerating, 
  models, 
  currentModel, 
  onModelChange,
  transferredImage,
  transferredParams,
  onTransferConsumed
}: Image2ImageTabProps) {
  const [initImage, setInitImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [strength, setStrength] = useState(0.75);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced settings
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7.5);
  const [seed, setSeed] = useState(-1);
  const [sampler, setSampler] = useState('DPM++ 2M Karras');

  // Handle transferred image and parameters
  useEffect(() => {
    if (transferredImage) {
      setInitImage(transferredImage);
      if (transferredParams) {
        setPrompt(transferredParams.prompt || '');
        setNegativePrompt(transferredParams.negative_prompt || '');
        setWidth(transferredParams.width || 512);
        setHeight(transferredParams.height || 512);
        setSteps(transferredParams.steps || 20);
        setCfgScale(transferredParams.cfg_scale || 7.5);
        setSeed(transferredParams.seed || -1);
        setSampler(transferredParams.sampler || 'DPM++ 2M Karras');
        if (transferredParams.model) {
          onModelChange(transferredParams.model);
        }
      }
      // Notify parent that transfer has been consumed
      if (onTransferConsumed) {
        onTransferConsumed();
      }
    }
  }, [transferredImage, transferredParams, onModelChange, onTransferConsumed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!initImage) {
      alert('Please upload an image first');
      return;
    }
    
    const params = {
      prompt,
      negative_prompt: negativePrompt,
      init_image: initImage,
      strength,
      width,
      height,
      steps,
      cfg_scale: cfgScale,
      seed,
      sampler,
      batch_size: 1,
      model: currentModel,
    };
    
    onGenerate(params);
  };

  const handleImageSelect = (image: string) => {
    setInitImage(image);
  };

  const handleImageClear = () => {
    setInitImage(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Model
        </label>
        <div className="relative">
          <select
            value={currentModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-4 pr-12 py-3 bg-palenight-bgDark text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple transition-colors appearance-none"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-palenight-comment">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Initial Image Upload */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Initial Image *
        </label>
        <ImageUpload
          onImageSelect={handleImageSelect}
          onImageClear={handleImageClear}
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
            onChange={(e) => setStrength(Number(e.target.value))}
            min="0"
            max="1"
            step="0.05"
            className="w-full"
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

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe how you want to modify the image..."
          className="w-full px-4 py-3 bg-palenight-bgLight text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple transition-colors resize-none"
          rows={3}
          required
        />
      </div>

      {/* Negative Prompt */}
      <div>
        <label className="block text-sm font-medium text-palenight-text mb-2">
          Negative Prompt (optional)
        </label>
        <textarea
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="What to avoid in the modified image..."
          className="w-full px-4 py-3 bg-palenight-bgLight text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple transition-colors resize-none"
          rows={2}
        />
      </div>

      {/* Advanced Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-palenight-text hover:text-palenight-purple transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Advanced Settings
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 p-4 bg-palenight-bgDark rounded-lg border border-palenight-border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Width
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min="256"
                max="1024"
                step="64"
                className="w-full px-3 py-2 bg-palenight-bgLight text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Height
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min="256"
                max="1024"
                step="64"
                className="w-full px-3 py-2 bg-palenight-bgLight text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Steps: {steps}
              </label>
              <input
                type="range"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                min="1"
                max="100"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                CFG Scale: {cfgScale}
              </label>
              <input
                type="range"
                value={cfgScale}
                onChange={(e) => setCfgScale(Number(e.target.value))}
                min="1"
                max="20"
                step="0.5"
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-palenight-text mb-2">
              Sampler
            </label>
            <div className="relative">
              <select
                value={sampler}
                onChange={(e) => setSampler(e.target.value)}
                className="w-full px-3 pr-10 py-2 bg-palenight-bgLight text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple appearance-none"
              >
                <option value="DPM++ 2M Karras">DPM++ 2M Karras</option>
                <option value="DPM++ 2M SDE Karras">DPM++ 2M SDE Karras</option>
                <option value="Euler a">Euler a</option>
                <option value="Euler">Euler</option>
                <option value="LMS">LMS</option>
                <option value="DDIM">DDIM</option>
                <option value="LCM">LCM</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-palenight-comment">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-palenight-text mb-2">
              Seed (-1 for random)
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              min="-1"
              className="w-full px-3 pr-10 py-2 bg-palenight-bgLight text-palenight-text rounded-lg border border-palenight-border focus:border-palenight-purple focus:ring-1 focus:ring-palenight-purple"
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        type="submit"
        disabled={isGenerating || !prompt || !initImage}
        className="w-full py-3 px-4 bg-gradient-to-r from-palenight-purple to-palenight-pink text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Generating...' : 'Generate Image'}
      </button>
    </form>
  );
}