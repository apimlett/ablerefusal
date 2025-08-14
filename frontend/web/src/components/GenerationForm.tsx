'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Wand2, Settings, Loader2 } from 'lucide-react';
import { GenerationRequest } from '@/lib/api';

interface GenerationFormProps {
  onSubmit: (data: GenerationRequest) => Promise<void>;
  isGenerating: boolean;
}

export default function GenerationForm({ onSubmit, isGenerating }: GenerationFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<GenerationRequest>({
    defaultValues: {
      prompt: '',
      negative_prompt: '',
      width: 512,
      height: 512,
      steps: 20,
      cfg_scale: 7.5,
      seed: -1,
      batch_size: 1,
      sampler: 'euler_a',
      model: 'runwayml/stable-diffusion-v1-5',
    },
  });

  const currentWidth = watch('width');
  const currentHeight = watch('height');
  const currentSteps = watch('steps');
  const currentCfg = watch('cfg_scale');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Model Selection */}
      <div>
        <label htmlFor="model" className="block text-sm font-medium text-palenight-text mb-2">
          Model
        </label>
        <select
          {...register('model')}
          className="input"
          disabled={isGenerating}
        >
          <option value="runwayml/stable-diffusion-v1-5">Stable Diffusion 1.5</option>
          <option value="stabilityai/stable-diffusion-2-1">Stable Diffusion 2.1</option>
          <option value="stabilityai/stable-diffusion-xl-base-1.0">SDXL 1.0</option>
        </select>
      </div>

      {/* Main Prompt */}
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-palenight-textBright mb-2">
          Prompt
        </label>
        <textarea
          {...register('prompt', { required: 'Prompt is required' })}
          rows={3}
          className="textarea"
          placeholder="Describe the image you want to generate..."
          disabled={isGenerating}
        />
        {errors.prompt && (
          <p className="mt-1 text-sm text-palenight-red">{errors.prompt.message}</p>
        )}
      </div>

      {/* Negative Prompt */}
      <div>
        <label htmlFor="negative_prompt" className="block text-sm font-medium text-palenight-text mb-2">
          Negative Prompt (optional)
        </label>
        <textarea
          {...register('negative_prompt')}
          rows={2}
          className="textarea"
          placeholder="What to avoid in the image..."
          disabled={isGenerating}
        />
      </div>

      {/* Advanced Settings Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center space-x-2 text-palenight-purple hover:text-palenight-purple/80 transition-colors"
      >
        <Settings className="w-4 h-4" />
        <span className="text-sm font-medium">
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </span>
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="card space-y-4 animate-slide-up">
          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Width: {currentWidth}px
              </label>
              <input
                type="range"
                {...register('width', { valueAsNumber: true })}
                min="256"
                max="1024"
                step="64"
                className="w-full"
                disabled={isGenerating}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Height: {currentHeight}px
              </label>
              <input
                type="range"
                {...register('height', { valueAsNumber: true })}
                min="256"
                max="1024"
                step="64"
                className="w-full"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Quick Size Presets */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                register('width').onChange({ target: { value: 512 } });
                register('height').onChange({ target: { value: 512 } });
              }}
              className="badge-blue cursor-pointer hover:bg-palenight-blue hover:bg-opacity-30"
            >
              512×512
            </button>
            <button
              type="button"
              onClick={() => {
                register('width').onChange({ target: { value: 768 } });
                register('height').onChange({ target: { value: 768 } });
              }}
              className="badge-blue cursor-pointer hover:bg-palenight-blue hover:bg-opacity-30"
            >
              768×768
            </button>
            <button
              type="button"
              onClick={() => {
                register('width').onChange({ target: { value: 1024 } });
                register('height').onChange({ target: { value: 576 } });
              }}
              className="badge-blue cursor-pointer hover:bg-palenight-blue hover:bg-opacity-30"
            >
              16:9
            </button>
            <button
              type="button"
              onClick={() => {
                register('width').onChange({ target: { value: 576 } });
                register('height').onChange({ target: { value: 1024 } });
              }}
              className="badge-blue cursor-pointer hover:bg-palenight-blue hover:bg-opacity-30"
            >
              9:16
            </button>
          </div>

          {/* Steps and CFG Scale */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Steps: {currentSteps}
              </label>
              <input
                type="range"
                {...register('steps', { valueAsNumber: true })}
                min="10"
                max="50"
                step="5"
                className="w-full"
                disabled={isGenerating}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                CFG Scale: {currentCfg}
              </label>
              <input
                type="range"
                {...register('cfg_scale', { valueAsNumber: true })}
                min="1"
                max="20"
                step="0.5"
                className="w-full"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Seed and Batch Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Seed
              </label>
              <input
                type="number"
                {...register('seed', { valueAsNumber: true })}
                className="input"
                placeholder="-1 for random"
                disabled={isGenerating}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-palenight-text mb-2">
                Batch Size
              </label>
              <input
                type="number"
                {...register('batch_size', { valueAsNumber: true, min: 1, max: 4 })}
                className="input"
                min="1"
                max="4"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Sampler */}
          <div>
            <label className="block text-sm font-medium text-palenight-text mb-2">
              Sampler
            </label>
            <select {...register('sampler')} className="input" disabled={isGenerating}>
              <option value="euler_a">Euler A</option>
              <option value="euler">Euler</option>
              <option value="dpm++_2m">DPM++ 2M</option>
              <option value="dpm++_2m_karras">DPM++ 2M Karras</option>
              <option value="ddim">DDIM</option>
            </select>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        type="submit"
        disabled={isGenerating}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5" />
            <span>Generate Image</span>
          </>
        )}
      </button>
    </form>
  );
}