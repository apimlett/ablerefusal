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
  const [isBackendReady, setIsBackendReady] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Text2Img workflow state
  const [txt2imgImages, setTxt2imgImages] = useState<GenerationResult[]>([]);
  const [txt2imgCurrentImage, setTxt2imgCurrentImage] = useState<GenerationResult | null>(null);
  const [txt2imgGenerationId, setTxt2imgGenerationId] = useState<string | null>(null);
  const [txt2imgGenerationStatus, setTxt2imgGenerationStatus] = useState<GenerationStatus | null>(null);
  const [txt2imgIsGenerating, setTxt2imgIsGenerating] = useState(false);
  const [txt2imgError, setTxt2imgError] = useState<string | null>(null);
  
  // Img2Img workflow state
  const [img2imgImages, setImg2imgImages] = useState<GenerationResult[]>([]);
  const [img2imgCurrentImage, setImg2imgCurrentImage] = useState<GenerationResult | null>(null);
  const [img2imgGenerationId, setImg2imgGenerationId] = useState<string | null>(null);
  const [img2imgGenerationStatus, setImg2imgGenerationStatus] = useState<GenerationStatus | null>(null);
  const [img2imgIsGenerating, setImg2imgIsGenerating] = useState(false);
  const [img2imgError, setImg2imgError] = useState<string | null>(null);
  
  // Helper functions to get current workflow state
  const images = activeTab === 'txt2img' ? txt2imgImages : img2imgImages;
  const currentImage = activeTab === 'txt2img' ? txt2imgCurrentImage : img2imgCurrentImage;
  const currentGenerationId = activeTab === 'txt2img' ? txt2imgGenerationId : img2imgGenerationId;
  const generationStatus = activeTab === 'txt2img' ? txt2imgGenerationStatus : img2imgGenerationStatus;
  const isGenerating = activeTab === 'txt2img' ? txt2imgIsGenerating : img2imgIsGenerating;
  const error = activeTab === 'txt2img' ? txt2imgError : img2imgError;
  
  const setImages = activeTab === 'txt2img' ? setTxt2imgImages : setImg2imgImages;
  const setCurrentImage = activeTab === 'txt2img' ? setTxt2imgCurrentImage : setImg2imgCurrentImage;
  const setCurrentGenerationId = activeTab === 'txt2img' ? setTxt2imgGenerationId : setImg2imgGenerationId;
  const setGenerationStatus = activeTab === 'txt2img' ? setTxt2imgGenerationStatus : setImg2imgGenerationStatus;
  const setIsGenerating = activeTab === 'txt2img' ? setTxt2imgIsGenerating : setImg2imgIsGenerating;
  const setError = activeTab === 'txt2img' ? setTxt2imgError : setImg2imgError;
  
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

  // Poll for txt2img generation status
  useEffect(() => {
    if (!txt2imgGenerationId || !txt2imgIsGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await sdApi.getStatus(txt2imgGenerationId);
        setTxt2imgGenerationStatus(status);

        if (status.status === 'completed') {
          setTxt2imgIsGenerating(false);
          if (status.results && status.results.length > 0) {
            setTxt2imgCurrentImage(status.results[0]);
            setTxt2imgImages(prev => [...status.results!, ...prev]);
          }
          setTxt2imgGenerationId(null);
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          setTxt2imgIsGenerating(false);
          setTxt2imgGenerationId(null);
          if (status.status === 'failed') {
            setTxt2imgError(status.error || 'Generation failed');
          }
        }
      } catch (err) {
        console.error('Failed to fetch txt2img status:', err);
        setTxt2imgError('Failed to fetch generation status');
        setTxt2imgIsGenerating(false);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [txt2imgGenerationId, txt2imgIsGenerating]);

  // Poll for img2img generation status
  useEffect(() => {
    if (!img2imgGenerationId || !img2imgIsGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await sdApi.getStatus(img2imgGenerationId);
        setImg2imgGenerationStatus(status);

        if (status.status === 'completed') {
          setImg2imgIsGenerating(false);
          if (status.results && status.results.length > 0) {
            setImg2imgCurrentImage(status.results[0]);
            setImg2imgImages(prev => [...status.results!, ...prev]);
          }
          setImg2imgGenerationId(null);
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          setImg2imgIsGenerating(false);
          setImg2imgGenerationId(null);
          if (status.status === 'failed') {
            setImg2imgError(status.error || 'Generation failed');
          }
        }
      } catch (err) {
        console.error('Failed to fetch img2img status:', err);
        setImg2imgError('Failed to fetch generation status');
        setImg2imgIsGenerating(false);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [img2imgGenerationId, img2imgIsGenerating]);

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
    // Determine which workflow is being used based on whether init_image is present
    const isImg2Img = !!data.init_image;
    
    if (isImg2Img) {
      setImg2imgError(null);
      setImg2imgIsGenerating(true);
      try {
        const response = await sdApi.generate(data);
        setImg2imgGenerationId(response.id);
      } catch (err: any) {
        setImg2imgError(err.response?.data?.error || err.message || 'Failed to start generation');
        setImg2imgIsGenerating(false);
      }
    } else {
      setTxt2imgError(null);
      setTxt2imgIsGenerating(true);
      try {
        const response = await sdApi.generate(data);
        setTxt2imgGenerationId(response.id);
      } catch (err: any) {
        setTxt2imgError(err.response?.data?.error || err.message || 'Failed to start generation');
        setTxt2imgIsGenerating(false);
      }
    }
  };

  const handleCancel = async () => {
    // Cancel the active workflow's generation
    if (activeTab === 'txt2img' && txt2imgGenerationId) {
      try {
        await sdApi.cancel(txt2imgGenerationId);
        setTxt2imgIsGenerating(false);
        setTxt2imgGenerationId(null);
        setTxt2imgGenerationStatus(null);
      } catch (err) {
        console.error('Failed to cancel txt2img generation:', err);
      }
    } else if (activeTab === 'img2img' && img2imgGenerationId) {
      try {
        await sdApi.cancel(img2imgGenerationId);
        setImg2imgIsGenerating(false);
        setImg2imgGenerationId(null);
        setImg2imgGenerationStatus(null);
      } catch (err) {
        console.error('Failed to cancel img2img generation:', err);
      }
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
                    isGenerating={txt2imgIsGenerating}
                    currentModel={currentModel}
                  />
                ) : (
                  <Image2ImageTab
                    onGenerate={handleGenerate}
                    isGenerating={img2imgIsGenerating}
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
            {/* Text2Img Workflow Content */}
            {activeTab === 'txt2img' && (
              <>
                {/* Error Display */}
                {txt2imgError && (
                  <div className="p-4 bg-palenight-red/10 border border-palenight-red rounded-lg">
                    <p className="text-palenight-red">{txt2imgError}</p>
                  </div>
                )}

                {/* Generation Progress */}
                {txt2imgGenerationStatus && (
                  <GenerationProgress 
                    status={txt2imgGenerationStatus}
                    onCancel={handleCancel}
                  />
                )}

                {/* Primary Preview */}
                <div>
                  <PrimaryPreview 
                    currentImage={txt2imgCurrentImage}
                    onUseInImg2Img={handleUseInImg2Img}
                    onRegenerate={handleRegenerate}
                  />
                </div>

                {/* Image Gallery */}
                {txt2imgImages.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-palenight-textBright mb-4">
                      History
                    </h2>
                    <ImageGallery 
                      images={txt2imgImages}
                      onUseInImg2Img={handleUseInImg2Img}
                      onImageClick={(image) => setTxt2imgCurrentImage(image)}
                    />
                  </div>
                )}
              </>
            )}

            {/* Img2Img Workflow Content */}
            {activeTab === 'img2img' && (
              <>
                {/* Error Display */}
                {img2imgError && (
                  <div className="p-4 bg-palenight-red/10 border border-palenight-red rounded-lg">
                    <p className="text-palenight-red">{img2imgError}</p>
                  </div>
                )}

                {/* Generation Progress */}
                {img2imgGenerationStatus && (
                  <GenerationProgress 
                    status={img2imgGenerationStatus}
                    onCancel={handleCancel}
                  />
                )}

                {/* Primary Preview */}
                <div>
                  <PrimaryPreview 
                    currentImage={img2imgCurrentImage}
                    onUseInImg2Img={handleUseInImg2Img}
                    onRegenerate={handleRegenerate}
                  />
                </div>

                {/* Image Gallery */}
                {img2imgImages.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-palenight-textBright mb-4">
                      History
                    </h2>
                    <ImageGallery 
                      images={img2imgImages}
                      onUseInImg2Img={handleUseInImg2Img}
                      onImageClick={(image) => setImg2imgCurrentImage(image)}
                    />
                  </div>
                )}
              </>
            )}
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