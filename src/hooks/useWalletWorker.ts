// src/hooks/useWalletWorker.ts
import { useEffect, useRef } from 'react';
import type { WorkerCommand, WorkerMessage, WorkerResponse } from '../types/worker';

export function useWalletWorker() {
  const workerRef = useRef<Worker | null>(null);
  
  // Track active promises by message ID
  const resolves = useRef<Record<string, (value: unknown) => void>>({});
  const rejects = useRef<Record<string, (reason?: unknown) => void>>({});

  useEffect(() => {
    // Instantiate the worker
    workerRef.current = new Worker(new URL('../workers/wallet.worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = e.data;
      
      if (success && resolves.current[id]) {
        resolves.current[id](data);
      } else if (!success && rejects.current[id]) {
        rejects.current[id](new Error(error || 'Worker execution failed'));
      }
      
      // Cleanup resolved/rejected handlers
      delete resolves.current[id];
      delete rejects.current[id];
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const sendCommand = async <T,>(command: WorkerCommand, payload?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        return reject(new Error('Worker not initialized'));
      }
      
      const id = crypto.randomUUID(); // Unique ID for request mapping
      resolves.current[id] = resolve as (value: unknown) => void;
      rejects.current[id] = reject;
      
      const message: WorkerMessage = { id, command, payload };
      workerRef.current.postMessage(message);
    });
  };

  return { sendCommand };
}