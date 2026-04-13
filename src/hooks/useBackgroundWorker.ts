import { useEffect, useRef, useState } from 'react';
import { BackgroundWorkerImpl } from '../BackgroundWorker';
import { WorkerPool } from '../WorkerPool';
import type {
  BackgroundWorker,
  BackgroundWorkerOptions,
  WorkerConfig,
} from '../types';

export interface UseBackgroundWorkerResult<TInput, TOutput> {
  worker: BackgroundWorker<TInput, TOutput>;
  isReady: boolean;
  setupError: Error | null;
}

export function useBackgroundWorker<TInput = unknown, TOutput = unknown>(
  options: BackgroundWorkerOptions<TInput, TOutput>,
  config?: WorkerConfig
): UseBackgroundWorkerResult<TInput, TOutput> {
  const dedicated = config?.dedicated ?? true;
  const autoTerminate = config?.autoTerminateOnUnmount ?? true;
  const hasSetup = !!options.setup;

  const [isReady, setIsReady] = useState(!hasSetup);
  const [setupError, setSetupError] = useState<Error | null>(null);

  const workerRef = useRef<BackgroundWorkerImpl<TInput, TOutput> | null>(null);

  if (workerRef.current === null) {
    let impl: BackgroundWorkerImpl<TInput, TOutput>;
    if (dedicated) {
      impl = new BackgroundWorkerImpl(options);
    } else {
      const pool = WorkerPool.shared();
      const workerName = options.name ?? 'BackgroundWorker';
      const runtime = pool.acquire(workerName);
      impl = BackgroundWorkerImpl.withRuntime(runtime, options);
    }

    impl.onReadyCallback = (ready, error) => {
      setIsReady(ready);
      // console.log('ready', ready);
      // console.log('error', error);
      setSetupError(error);
    };

    workerRef.current = impl;
  }

  useEffect(() => {
    return () => {
      if (autoTerminate && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [autoTerminate]);

  return { worker: workerRef.current, isReady, setupError };
}
