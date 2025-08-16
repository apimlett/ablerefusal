'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import CanvasEditor with no SSR
const CanvasEditor = dynamic(
  () => import('./CanvasEditorImpl'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[512px] bg-palenight-bgDark rounded-lg border border-palenight-border">
        <div className="text-palenight-comment">Loading canvas...</div>
      </div>
    )
  }
);

export default CanvasEditor;

export type { CanvasEditorProps } from './CanvasEditorImpl';