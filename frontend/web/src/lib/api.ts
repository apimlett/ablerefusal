import axios from 'axios';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface GenerationRequest {
  prompt: string;
  negative_prompt?: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  batch_size?: number;
  sampler?: string;
}

export interface GenerationResponse {
  id: string;
  status: string;
  position?: number;
  message?: string;
}

export interface GenerationStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step?: number;
  total_steps?: number;
  results?: GenerationResult[];
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface GenerationResult {
  image_path: string;
  image_url: string;
  seed: number;
  width: number;
  height: number;
  metadata: Record<string, string>;
}

export interface Model {
  id: string;
  name: string;
  type: string;
  version: string;
  description: string;
  ready: boolean;
}

export interface QueueStatus {
  queue: QueueItem[];
  count: number;
}

export interface QueueItem {
  request: GenerationRequest & { id: string };
  status: GenerationStatus;
  position: number;
}

// API methods
export const sdApi = {
  // Health check
  async health(): Promise<{ status: string }> {
    const response = await api.get('/health');
    return response.data;
  },

  // Ready check
  async ready(): Promise<any> {
    const response = await api.get('/ready');
    return response.data;
  },

  // Generate image
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const response = await api.post('/generate', request);
    return response.data;
  },

  // Get generation status
  async getStatus(id: string): Promise<GenerationStatus> {
    const response = await api.get(`/generate/${id}`);
    return response.data;
  },

  // Cancel generation
  async cancel(id: string): Promise<{ id: string; status: string; message: string }> {
    const response = await api.post(`/generate/${id}/cancel`);
    return response.data;
  },

  // Get queue status
  async getQueue(): Promise<QueueStatus> {
    const response = await api.get('/queue');
    return response.data;
  },

  // Get models
  async getModels(): Promise<{ models: Model[] }> {
    const response = await api.get('/models');
    return response.data;
  },

  // Get image URL
  getImageUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    if (path.startsWith('/')) {
      return `${API_BASE_URL}${path}`;
    }
    return `${API_BASE_URL}/${path}`;
  },
};

// Hook for polling generation status
export function useGenerationStatus(id: string | null, interval = 1000) {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!id) {
      setStatus(null);
      setError(null);
      return;
    }

    setIsPolling(true);
    const pollStatus = async () => {
      try {
        const newStatus = await sdApi.getStatus(id);
        setStatus(newStatus);
        setError(null);

        // Stop polling if generation is complete, failed, or cancelled
        if (['completed', 'failed', 'cancelled'].includes(newStatus.status)) {
          setIsPolling(false);
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch status');
        setIsPolling(false);
      }
    };

    // Initial fetch
    pollStatus();

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (isPolling) {
        pollStatus();
      }
    }, interval);

    return () => {
      clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [id, interval]);

  return { status, error, isPolling };
}

// Import React hooks (these would normally be imported at the top)
import { useState, useEffect } from 'react';

export default sdApi;