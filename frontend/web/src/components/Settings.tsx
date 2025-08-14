'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Server, 
  Sliders, 
  Monitor,
  Download,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Database,
  Cpu,
  Zap,
  Save
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

interface Model {
  name: string;
  path: string;
  type: string;
  loaded?: boolean;
}

export default function Settings({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'server' | 'generation' | 'ui' | 'models'>('server');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [pythonStatus, setPythonStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [loadedModels, setLoadedModels] = useState<string[]>([]);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  // Check server connections
  useEffect(() => {
    if (isOpen) {
      checkConnections();
      fetchModels();
    }
  }, [isOpen, settings.server.backendUrl, settings.server.pythonServiceUrl]);

  const checkConnections = async () => {
    // Check backend connection
    try {
      const response = await fetch(`${settings.server.backendUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(5000),
      });
      setConnectionStatus(response.ok ? 'connected' : 'disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }

    // Check Python service connection
    if (settings.server.enablePythonService) {
      try {
        const response = await fetch(`${settings.server.pythonServiceUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        setPythonStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        setPythonStatus('disconnected');
      }
    }
  };

  const fetchModels = async () => {
    if (!settings.server.enablePythonService) return;

    try {
      const response = await fetch(`${settings.server.pythonServiceUrl}/models`);
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.available || []);
        setLoadedModels(data.loaded || []);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const loadModel = async (modelPath: string) => {
    setIsLoadingModel(true);
    try {
      const response = await fetch(`${settings.server.pythonServiceUrl}/load-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_path: modelPath }),
      });

      if (response.ok) {
        await fetchModels();
      }
    } catch (error) {
      console.error('Failed to load model:', error);
    } finally {
      setIsLoadingModel(false);
    }
  };

  const samplers = [
    'DPM++ 2M Karras',
    'DPM++ 2M SDE Karras',
    'DPM++ SDE Karras',
    'Euler a',
    'Euler',
    'LMS',
    'LMS Karras',
    'Heun',
    'DPM2',
    'DPM2 a',
    'DPM++ 2S a',
    'DDIM',
    'PLMS',
    'UniPC',
    'LCM',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-palenight-bgLight rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-palenight-border">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="w-6 h-6 text-palenight-purple" />
            <h2 className="text-xl font-semibold text-palenight-textBright">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-palenight-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-palenight-text" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-palenight-border">
          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center space-x-2 px-6 py-3 transition-colors ${
              activeTab === 'server'
                ? 'border-b-2 border-palenight-purple text-palenight-purple'
                : 'text-palenight-text hover:text-palenight-textBright'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Server</span>
          </button>
          <button
            onClick={() => setActiveTab('generation')}
            className={`flex items-center space-x-2 px-6 py-3 transition-colors ${
              activeTab === 'generation'
                ? 'border-b-2 border-palenight-purple text-palenight-purple'
                : 'text-palenight-text hover:text-palenight-textBright'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Generation</span>
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center space-x-2 px-6 py-3 transition-colors ${
              activeTab === 'models'
                ? 'border-b-2 border-palenight-purple text-palenight-purple'
                : 'text-palenight-text hover:text-palenight-textBright'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Models</span>
          </button>
          <button
            onClick={() => setActiveTab('ui')}
            className={`flex items-center space-x-2 px-6 py-3 transition-colors ${
              activeTab === 'ui'
                ? 'border-b-2 border-palenight-purple text-palenight-purple'
                : 'text-palenight-text hover:text-palenight-textBright'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Interface</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {activeTab === 'server' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-palenight-textBright mb-4">Server Configuration</h3>
                
                {/* Backend URL */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Backend URL
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={settings.server.backendUrl}
                      onChange={(e) => updateSettings('server', { backendUrl: e.target.value })}
                      className="input flex-1"
                      placeholder="http://localhost:8080"
                    />
                    <div className={`p-2 rounded-lg ${
                      connectionStatus === 'connected' ? 'bg-palenight-green/20' :
                      connectionStatus === 'disconnected' ? 'bg-palenight-red/20' :
                      'bg-palenight-yellow/20'
                    }`}>
                      {connectionStatus === 'connected' ? 
                        <Check className="w-5 h-5 text-palenight-green" /> :
                        connectionStatus === 'disconnected' ?
                        <X className="w-5 h-5 text-palenight-red" /> :
                        <RefreshCw className="w-5 h-5 text-palenight-yellow animate-spin" />
                      }
                    </div>
                  </div>
                </div>

                {/* Python Service */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-palenight-text">
                      Python Inference Service
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.server.enablePythonService}
                        onChange={(e) => updateSettings('server', { enablePythonService: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${
                        settings.server.enablePythonService ? 'bg-palenight-purple' : 'bg-palenight-selection'
                      }`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform mt-1 ${
                          settings.server.enablePythonService ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </div>
                    </label>
                  </div>
                  
                  {settings.server.enablePythonService && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={settings.server.pythonServiceUrl}
                        onChange={(e) => updateSettings('server', { pythonServiceUrl: e.target.value })}
                        className="input flex-1"
                        placeholder="http://localhost:8001"
                      />
                      <div className={`p-2 rounded-lg ${
                        pythonStatus === 'connected' ? 'bg-palenight-green/20' :
                        pythonStatus === 'disconnected' ? 'bg-palenight-red/20' :
                        'bg-palenight-yellow/20'
                      }`}>
                        {pythonStatus === 'connected' ? 
                          <Check className="w-5 h-5 text-palenight-green" /> :
                          pythonStatus === 'disconnected' ?
                          <X className="w-5 h-5 text-palenight-red" /> :
                          <RefreshCw className="w-5 h-5 text-palenight-yellow animate-spin" />
                        }
                      </div>
                    </div>
                  )}
                </div>

                {/* Connection Timeout */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Connection Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={settings.server.connectionTimeout}
                    onChange={(e) => updateSettings('server', { connectionTimeout: parseInt(e.target.value) })}
                    className="input w-full"
                    min="1000"
                    max="60000"
                    step="1000"
                  />
                </div>

                {/* Status Info */}
                {pythonStatus === 'disconnected' && settings.server.enablePythonService && (
                  <div className="p-4 bg-palenight-red/10 border border-palenight-red/30 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-palenight-red mt-0.5" />
                      <div>
                        <p className="text-palenight-red font-medium">Python service not connected</p>
                        <p className="text-sm text-palenight-text mt-1">
                          Make sure the Python inference service is running. Start it with:
                        </p>
                        <code className="block mt-2 p-2 bg-palenight-bg rounded text-xs text-palenight-green">
                          cd inference-service && python main.py
                        </code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'generation' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-palenight-textBright">Default Generation Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Steps */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Default Steps
                  </label>
                  <input
                    type="number"
                    value={settings.generation.defaultSteps}
                    onChange={(e) => updateSettings('generation', { defaultSteps: parseInt(e.target.value) })}
                    className="input w-full"
                    min="1"
                    max="150"
                  />
                </div>

                {/* CFG Scale */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Default CFG Scale
                  </label>
                  <input
                    type="number"
                    value={settings.generation.defaultCfgScale}
                    onChange={(e) => updateSettings('generation', { defaultCfgScale: parseFloat(e.target.value) })}
                    className="input w-full"
                    min="1"
                    max="30"
                    step="0.5"
                  />
                </div>

                {/* Width */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Default Width
                  </label>
                  <select
                    value={settings.generation.defaultWidth}
                    onChange={(e) => updateSettings('generation', { defaultWidth: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    <option value="512">512</option>
                    <option value="768">768</option>
                    <option value="1024">1024</option>
                    <option value="1280">1280</option>
                  </select>
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Default Height
                  </label>
                  <select
                    value={settings.generation.defaultHeight}
                    onChange={(e) => updateSettings('generation', { defaultHeight: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    <option value="512">512</option>
                    <option value="768">768</option>
                    <option value="1024">1024</option>
                    <option value="1280">1280</option>
                  </select>
                </div>

                {/* Sampler */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Default Sampler
                  </label>
                  <select
                    value={settings.generation.defaultSampler}
                    onChange={(e) => updateSettings('generation', { defaultSampler: e.target.value })}
                    className="input w-full"
                  >
                    {samplers.map(sampler => (
                      <option key={sampler} value={sampler}>{sampler}</option>
                    ))}
                  </select>
                </div>

                {/* Batch Size */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    Default Batch Size
                  </label>
                  <input
                    type="number"
                    value={settings.generation.defaultBatchSize}
                    onChange={(e) => updateSettings('generation', { defaultBatchSize: parseInt(e.target.value) })}
                    className="input w-full"
                    min="1"
                    max="4"
                  />
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4 pt-4 border-t border-palenight-border">
                <h4 className="text-sm font-medium text-palenight-textBright">Advanced Options</h4>
                
                {/* LCM Mode */}
                <label className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-5 h-5 text-palenight-yellow" />
                    <div>
                      <span className="text-palenight-text">Enable LCM by default</span>
                      <p className="text-xs text-palenight-comment">Latent Consistency Models for 4-8 step generation</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.generation.enableLCM}
                    onChange={(e) => updateSettings('generation', { enableLCM: e.target.checked })}
                    className="checkbox"
                  />
                </label>

                {/* CLIP Skip */}
                <div>
                  <label className="block text-sm font-medium text-palenight-text mb-2">
                    CLIP Skip
                  </label>
                  <input
                    type="number"
                    value={settings.generation.clipSkip}
                    onChange={(e) => updateSettings('generation', { clipSkip: parseInt(e.target.value) })}
                    className="input w-32"
                    min="1"
                    max="12"
                  />
                  <p className="text-xs text-palenight-comment mt-1">
                    Skip last N layers of CLIP model (1 = no skip)
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-palenight-textBright">Model Management</h3>
              
              {settings.server.enablePythonService ? (
                <>
                  {/* Loaded Models */}
                  <div>
                    <h4 className="text-sm font-medium text-palenight-text mb-3">Loaded Models</h4>
                    {loadedModels.length > 0 ? (
                      <div className="space-y-2">
                        {loadedModels.map(model => (
                          <div key={model} className="flex items-center justify-between p-3 bg-palenight-selection rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Cpu className="w-4 h-4 text-palenight-purple" />
                              <span className="text-palenight-textBright">{model}</span>
                            </div>
                            <span className="text-xs text-palenight-green">Active</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-palenight-comment">No models loaded</p>
                    )}
                  </div>

                  {/* Available Models */}
                  <div>
                    <h4 className="text-sm font-medium text-palenight-text mb-3">Available Models</h4>
                    {availableModels.length > 0 ? (
                      <div className="space-y-2">
                        {availableModels.map(model => (
                          <div key={model.path} className="flex items-center justify-between p-3 bg-palenight-bg rounded-lg">
                            <div>
                              <div className="flex items-center space-x-3">
                                <Database className="w-4 h-4 text-palenight-blue" />
                                <span className="text-palenight-textBright">{model.name}</span>
                              </div>
                              <p className="text-xs text-palenight-comment mt-1">{model.path}</p>
                            </div>
                            <button
                              onClick={() => loadModel(model.path)}
                              disabled={isLoadingModel || loadedModels.includes(model.path)}
                              className="btn btn-sm"
                            >
                              {loadedModels.includes(model.path) ? 'Loaded' : 'Load'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Database className="w-12 h-12 text-palenight-comment mx-auto mb-3" />
                        <p className="text-palenight-comment mb-3">No models found</p>
                        <p className="text-sm text-palenight-text">
                          Download models using:
                        </p>
                        <code className="block mt-2 p-2 bg-palenight-bg rounded text-xs text-palenight-green">
                          python download_models.py --model sd15
                        </code>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-palenight-yellow mx-auto mb-3" />
                  <p className="text-palenight-text mb-2">Python service is disabled</p>
                  <p className="text-sm text-palenight-comment">
                    Enable the Python inference service in the Server tab to manage models
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-palenight-textBright">Interface Settings</h3>
              
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-palenight-text mb-2">
                  Theme
                </label>
                <select
                  value={settings.ui.theme}
                  onChange={(e) => updateSettings('ui', { theme: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="palenight">Palenight</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              {/* Show Advanced Options */}
              <label className="flex items-center justify-between">
                <span className="text-palenight-text">Show advanced options by default</span>
                <input
                  type="checkbox"
                  checked={settings.ui.showAdvancedOptions}
                  onChange={(e) => updateSettings('ui', { showAdvancedOptions: e.target.checked })}
                  className="checkbox"
                />
              </label>

              {/* Auto Save Images */}
              <label className="flex items-center justify-between">
                <span className="text-palenight-text">Auto-save generated images</span>
                <input
                  type="checkbox"
                  checked={settings.ui.autoSaveImages}
                  onChange={(e) => updateSettings('ui', { autoSaveImages: e.target.checked })}
                  className="checkbox"
                />
              </label>

              {/* Image Quality */}
              <div>
                <label className="block text-sm font-medium text-palenight-text mb-2">
                  Image Quality (1-100)
                </label>
                <input
                  type="number"
                  value={settings.ui.imageQuality}
                  onChange={(e) => updateSettings('ui', { imageQuality: parseInt(e.target.value) })}
                  className="input w-32"
                  min="1"
                  max="100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-palenight-border">
          <button
            onClick={resetSettings}
            className="btn btn-ghost text-palenight-red"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                checkConnections();
                onClose();
              }}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}