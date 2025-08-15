'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Github, Server, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import TabNavigation from '@/components/TabNavigation';
import Text2ImageTab from '@/components/Text2ImageTab';
import Image2ImageTab from '@/components/Image2ImageTab';
import PrimaryPreview from '@/components/PrimaryPreview';
import ImageGallery from '@/components/ImageGallery';
import GenerationProgress from '@/components/GenerationProgress';
import Settings from '@/components/Settings';
import ModelSelector from '@/components/ModelSelector';
import { useSettings } from '@/contexts/SettingsContext';
import sdApi, { GenerationRequest, GenerationResult, GenerationStatus, Model } from '@/lib/api';

export default function Home() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'txt2img' | 'img2img'>('txt2img');
  const [images, setImages] = useState<GenerationResult[]>([]);
  const [currentImage, setCurrentImage] = useState<GenerationResult | null>(null);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendReady, setIsBackendReady] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // State for model management
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState('runwayml/stable-diffusion-v1-5');
  
  // State for transferring between workflows
  const [transferredImage, setTransferredImage] = useState<string | null>(null);
  const [transferredParams, setTransferredParams] = useState<any>(null);

  // Check backend status on mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Poll for generation status
  useEffect(() => {
    if (!currentGenerationId || !isGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await sdApi.getStatus(currentGenerationId);
        setGenerationStatus(status);

        if (status.status === 'completed') {
          setIsGenerating(false);
          if (status.results && status.results.length > 0) {
            setCurrentImage(status.results[0]);
            setImages(prev => [...status.results!, ...prev]);
          }
          setCurrentGenerationId(null);
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          setIsGenerating(false);
          setCurrentGenerationId(null);
          if (status.status === 'failed') {
            setError(status.error || 'Generation failed');
          }
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
        setError('Failed to fetch generation status');
        setIsGenerating(false);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [currentGenerationId, isGenerating]);

  const checkBackendStatus = async () => {
    try {
      const health = await sdApi.health();
      setIsBackendReady(health.status === 'healthy');
      
      // Fetch available models
      if (health.status === 'healthy') {
        try {
          const modelsResponse = await sdApi.getModels();
          setModels(modelsResponse.models);
        } catch (err) {
          console.error('Failed to fetch models:', err);
        }
      }
    } catch (err) {
      setIsBackendReady(false);
    }
  };

  const handleGenerate = async (data: GenerationRequest) => {
    setError(null);
    setIsGenerating(true);
    
    try {
      const response = await sdApi.generate(data);
      setCurrentGenerationId(response.id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to start generation');
      setIsGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (!currentGenerationId) return;
    
    try {
      await sdApi.cancel(currentGenerationId);
      setIsGenerating(false);
      setCurrentGenerationId(null);
      setGenerationStatus(null);
    } catch (err) {
      console.error('Failed to cancel generation:', err);
    }
  };

  const handleUseInImg2Img = (imageUrl: string, metadata: any) => {
    // Convert the image URL to base64
    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setTransferredImage(base64);
          setTransferredParams(metadata);
          setActiveTab('img2img');
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => {
        console.error('Failed to transfer image:', err);
        setError('Failed to transfer image to img2img');
      });
  };

  const handleTransferConsumed = () => {
    setTransferredImage(null);
    setTransferredParams(null);
  };

  const handleRegenerate = (metadata: any) => {
    const params: GenerationRequest = {
      prompt: metadata.prompt || '',
      negative_prompt: metadata.negative || metadata.negative_prompt || '',
      width: parseInt(metadata.width) || 512,
      height: parseInt(metadata.height) || 512,
      steps: parseInt(metadata.steps) || 20,
      cfg_scale: parseFloat(metadata.cfg_scale) || 7.5,
      sampler: metadata.sampler || 'DPM++ 2M Karras',
      seed: -1, // Use random seed for regeneration
      batch_size: 1,
      model: metadata.model || currentModel,
    };
    handleGenerate(params);
  };

  return (
    <div className="min-h-screen bg-gradient-palenight">
      {/* Header */}
      <header className="bg-palenight-bgLight/80 backdrop-blur-sm border-b border-palenight-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-8 h-8 text-palenight-purple" />
              <div>
                <h1 className="text-2xl font-bold text-palenight-textBright">
                  AbleRefusal
                </h1>
                <p className="text-sm text-palenight-comment">Generate amazing AI images locally</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Backend Status */}
              <div className="flex items-center space-x-2">
                <Server className={`w-4 h-4 ${isBackendReady ? 'text-palenight-green' : 'text-palenight-red'}`} />
                <span className="text-sm text-palenight-text">
                  {isBackendReady === null ? 'Checking...' : isBackendReady ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-palenight-text hover:text-palenight-textBright transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              
              {/* GitHub Link */}
              <a
                href="https://github.com/apimlett/ablerefusal"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-palenight-text hover:text-palenight-textBright transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Backend Error Alert */}
        {isBackendReady === false && (
          <div className="mb-6 p-4 bg-palenight-red/10 border border-palenight-red rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-palenight-red mt-0.5" />
            <div>
              <p className="text-palenight-red font-medium">Backend server is not responding</p>
              <p className="text-sm text-palenight-text mt-1">
                Make sure the backend is running on http://localhost:8080
              </p>
              <button
                onClick={checkBackendStatus}
                className="mt-2 text-sm text-palenight-purple hover:text-palenight-purple/80"
              >
                Retry connection
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Generation Form with Tabs */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24">
              {/* Model Selector - Shared between tabs */}
              <ModelSelector
                models={models}
                currentModel={currentModel}
                onModelChange={setCurrentModel}
                className="mb-6"
              />
              
              {/* Tab Navigation */}
              <TabNavigation 
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
              
              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'txt2img' ? (
                  <Text2ImageTab
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    currentModel={currentModel}
                  />
                ) : (
                  <Image2ImageTab
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    currentModel={currentModel}
                    transferredImage={transferredImage}
                    transferredParams={transferredParams}
                    onTransferConsumed={handleTransferConsumed}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Content - Progress, Preview and Gallery */}
          <div className="lg:col-span-2 space-y-6">
            {/* Error Display */}
            {error && (
              <div className="p-4 bg-palenight-red/10 border border-palenight-red rounded-lg">
                <p className="text-palenight-red">{error}</p>
              </div>
            )}

            {/* Generation Progress */}
            {generationStatus && (
              <GenerationProgress 
                status={generationStatus}
                onCancel={handleCancel}
              />
            )}

            {/* Primary Preview */}
            <div>
              <h2 className="text-lg font-semibold text-palenight-textBright mb-4">
                Preview Canvas
              </h2>
              <PrimaryPreview 
                currentImage={currentImage}
                onUseInImg2Img={handleUseInImg2Img}
                onRegenerate={handleRegenerate}
              />
            </div>

            {/* Image Gallery */}
            <div>
              <h2 className="text-lg font-semibold text-palenight-textBright mb-4">
                Generation History
              </h2>
              <ImageGallery 
                images={images}
                onUseInImg2Img={handleUseInImg2Img}
                onImageClick={(image) => setCurrentImage(image)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-palenight-border">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-palenight-comment">
            <p>Built with Next.js, Go, and Python Diffusers</p>
            <p className="mt-1">
              Palenight theme • Open source • Local inference
            </p>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}