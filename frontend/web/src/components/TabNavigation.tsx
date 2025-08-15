import React from 'react';
import { ImageIcon, Wand2 } from 'lucide-react';

interface TabNavigationProps {
  activeTab: 'txt2img' | 'img2img';
  onTabChange: (tab: 'txt2img' | 'img2img') => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex border-b border-palenight-border mb-6">
      <button
        onClick={() => onTabChange('txt2img')}
        className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
          activeTab === 'txt2img'
            ? 'text-palenight-purple border-b-2 border-palenight-purple bg-palenight-bgDark/50'
            : 'text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgDark/30'
        }`}
      >
        <Wand2 className="w-5 h-5" />
        Text to Image
      </button>
      <button
        onClick={() => onTabChange('img2img')}
        className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
          activeTab === 'img2img'
            ? 'text-palenight-purple border-b-2 border-palenight-purple bg-palenight-bgDark/50'
            : 'text-palenight-text hover:text-palenight-purple hover:bg-palenight-bgDark/30'
        }`}
      >
        <ImageIcon className="w-5 h-5" />
        Image to Image
      </button>
    </div>
  );
}