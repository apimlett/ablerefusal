'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';

export interface CanvasEditorProps {
  width: number;
  height: number;
  backgroundImage?: string | null;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  tool: 'brush' | 'eraser';
  mode: 'sketch' | 'mask';
  onCanvasChange?: (dataUrl: string) => void;
  onMaskChange?: (dataUrl: string) => void;
}

interface LineData {
  tool: 'brush' | 'eraser';
  points: number[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

export default function CanvasEditor({
  width,
  height,
  backgroundImage,
  brushColor,
  brushSize,
  brushOpacity,
  tool,
  mode,
  onCanvasChange,
  onMaskChange
}: CanvasEditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [lines, setLines] = useState<LineData[]>([]);
  const [maskLines, setMaskLines] = useState<LineData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [history, setHistory] = useState<LineData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasId] = useState(() => `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Load from localStorage on mount
  useEffect(() => {
    const storageKey = `canvas-state-${mode}-${canvasId}`;
    const savedState = localStorage.getItem(storageKey);
    
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.lines) setLines(parsed.lines);
        if (parsed.maskLines) setMaskLines(parsed.maskLines);
        if (parsed.history) setHistory(parsed.history);
        if (typeof parsed.historyIndex === 'number') setHistoryIndex(parsed.historyIndex);
      } catch (e) {
        console.error('Failed to restore canvas state:', e);
      }
    }
  }, [canvasId, mode]);

  // Save to localStorage on changes
  useEffect(() => {
    const storageKey = `canvas-state-${mode}-${canvasId}`;
    const state = {
      lines,
      maskLines,
      history,
      historyIndex,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save canvas state:', e);
    }
  }, [lines, maskLines, history, historyIndex, mode, canvasId]);

  // Clean up old canvas states (older than 24 hours)
  useEffect(() => {
    const cleanupOldStates = () => {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      keys.forEach(key => {
        if (key.startsWith('canvas-state-')) {
          try {
            const state = JSON.parse(localStorage.getItem(key) || '{}');
            if (state.timestamp && (now - state.timestamp) > maxAge) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid state, remove it
            localStorage.removeItem(key);
          }
        }
      });
    };
    
    cleanupOldStates();
  }, []);

  // Load background image
  useEffect(() => {
    if (backgroundImage) {
      const img = new window.Image();
      img.src = backgroundImage;
      img.onload = () => {
        setBgImage(img);
      };
    } else {
      setBgImage(null);
    }
  }, [backgroundImage]);

  // Handle drawing start
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    setIsDrawing(true);
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const newLine: LineData = {
      tool,
      points: [pos.x, pos.y],
      color: mode === 'mask' ? (tool === 'brush' ? '#ffffff' : '#000000') : brushColor,
      strokeWidth: brushSize,
      opacity: mode === 'mask' ? 1 : brushOpacity
    };

    if (mode === 'mask') {
      setMaskLines([...maskLines, newLine]);
    } else {
      setLines([...lines, newLine]);
    }
  };

  // Handle drawing
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;

    if (mode === 'mask') {
      const lastLine = maskLines[maskLines.length - 1];
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      setMaskLines(maskLines.concat());
    } else {
      const lastLine = lines[lines.length - 1];
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      setLines(lines.concat());
    }
  };

  // Handle drawing end
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Save to history for undo/redo
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(mode === 'mask' ? [...maskLines] : [...lines]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Export canvas
    exportCanvas();
  };

  // Export canvas as base64
  const exportCanvas = useCallback(() => {
    if (!stageRef.current) return;

    const stage = stageRef.current;
    
    if (mode === 'mask' && onMaskChange) {
      // Export mask layer only
      const maskDataUrl = stage.toDataURL({
        pixelRatio: 1,
        mimeType: 'image/png'
      });
      onMaskChange(maskDataUrl);
    } else if (mode === 'sketch' && onCanvasChange) {
      // Export full canvas with background
      const canvasDataUrl = stage.toDataURL({
        pixelRatio: 1,
        mimeType: 'image/png'
      });
      onCanvasChange(canvasDataUrl);
    }
  }, [mode, onCanvasChange, onMaskChange]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (mode === 'mask') {
      setMaskLines([]);
    } else {
      setLines([]);
    }
    // Clear history as well
    setHistory([]);
    setHistoryIndex(-1);
    exportCanvas();
  }, [mode, exportCanvas]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (mode === 'mask') {
        setMaskLines(history[newIndex]);
      } else {
        setLines(history[newIndex]);
      }
      exportCanvas();
    }
  }, [historyIndex, history, mode, exportCanvas]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      if (mode === 'mask') {
        setMaskLines(history[newIndex]);
      } else {
        setLines(history[newIndex]);
      }
      exportCanvas();
    }
  }, [historyIndex, history, mode, exportCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const currentLines = mode === 'mask' ? maskLines : lines;

  // Download canvas as image
  const downloadCanvas = useCallback(() => {
    if (!stageRef.current) return;
    
    const dataUrl = stageRef.current.toDataURL({
      pixelRatio: 2,
      mimeType: 'image/png'
    });
    
    const link = document.createElement('a');
    link.download = `canvas-${mode}-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [mode]);

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={clearCanvas}
          className="px-3 py-1 bg-palenight-bgDark text-palenight-text rounded-lg hover:bg-palenight-highlight transition-colors text-sm"
          title="Clear canvas (removes history)"
        >
          Clear
        </button>
        <button
          onClick={undo}
          disabled={historyIndex <= 0}
          className="px-3 py-1 bg-palenight-bgDark text-palenight-text rounded-lg hover:bg-palenight-highlight transition-colors text-sm disabled:opacity-50"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="px-3 py-1 bg-palenight-bgDark text-palenight-text rounded-lg hover:bg-palenight-highlight transition-colors text-sm disabled:opacity-50"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          onClick={downloadCanvas}
          className="px-3 py-1 bg-palenight-bgDark text-palenight-text rounded-lg hover:bg-palenight-highlight transition-colors text-sm"
          title="Download canvas"
        >
          Download
        </button>
      </div>

      <div className="border border-palenight-border rounded-lg overflow-hidden bg-palenight-bgDark">
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchmove={handleMouseMove}
          onTouchend={handleMouseUp}
        >
          <Layer>
            {/* Background Image */}
            {bgImage && (
              <KonvaImage
                image={bgImage}
                width={width}
                height={height}
                listening={false}
              />
            )}
            
            {/* Checkerboard pattern for transparency (mask mode) */}
            {mode === 'mask' && !bgImage && (
              <Rect
                width={width}
                height={height}
                fill="#1e2230"
                listening={false}
              />
            )}

            {/* Drawing lines */}
            {currentLines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                opacity={line.opacity}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}