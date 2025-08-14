'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ServerSettings {
  backendUrl: string;
  pythonServiceUrl: string;
  enablePythonService: boolean;
  connectionTimeout: number;
}

interface GenerationSettings {
  defaultSteps: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultCfgScale: number;
  defaultSampler: string;
  defaultBatchSize: number;
  enableLCM: boolean;
  clipSkip: number;
}

interface UISettings {
  theme: 'palenight' | 'dark' | 'light';
  showAdvancedOptions: boolean;
  autoSaveImages: boolean;
  imageQuality: number;
}

interface Settings {
  server: ServerSettings;
  generation: GenerationSettings;
  ui: UISettings;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (category: keyof Settings, updates: Partial<Settings[keyof Settings]>) => void;
  resetSettings: () => void;
  saveSettings: () => void;
  loadSettings: () => void;
}

const defaultSettings: Settings = {
  server: {
    backendUrl: 'http://localhost:8080',
    pythonServiceUrl: 'http://localhost:8001',
    enablePythonService: true,
    connectionTimeout: 30000,
  },
  generation: {
    defaultSteps: 20,
    defaultWidth: 512,
    defaultHeight: 512,
    defaultCfgScale: 7.5,
    defaultSampler: 'DPM++ 2M Karras',
    defaultBatchSize: 1,
    enableLCM: false,
    clipSkip: 1,
  },
  ui: {
    theme: 'palenight',
    showAdvancedOptions: false,
    autoSaveImages: true,
    imageQuality: 95,
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const stored = localStorage.getItem('ablerefusal_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('ablerefusal_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const updateSettings = <K extends keyof Settings>(
    category: K,
    updates: Partial<Settings[K]>
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('ablerefusal_settings');
  };

  // Auto-save settings when they change
  useEffect(() => {
    saveSettings();
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        saveSettings,
        loadSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}