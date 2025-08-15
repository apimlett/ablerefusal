import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, ChevronDown } from 'lucide-react';
import sdApi, { Model } from '../lib/api';

interface ModelSelectorProps {
  models: Model[];
  currentModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}

export default function ModelSelector({ 
  models, 
  currentModel, 
  onModelChange,
  className = ''
}: ModelSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const currentModelData = models.find(m => m.id === currentModel);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Model
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left flex items-center justify-between"
        >
          <div className="flex items-center">
            {currentModelData && (
              <>
                <span className="mr-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </span>
                <span className="text-sm">{currentModelData.name}</span>
              </>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
            {models.map((model) => {
              const isSelected = model.id === currentModel;
              
              return (
                <div
                  key={model.id}
                  className={`px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer ${
                    isSelected ? 'bg-gray-50 dark:bg-gray-600' : ''
                  } ${!model.ready ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (model.ready) {
                      onModelChange(model.id);
                      setShowDropdown(false);
                    }
                  }}
                >
                  <div className="flex items-center">
                    <span className="mr-2">
                      {isSelected ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-400" />
                      )}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{model.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {model.description}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}