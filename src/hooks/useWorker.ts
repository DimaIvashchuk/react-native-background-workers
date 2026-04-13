import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import {
  createWorkletRuntime,
  runOnRuntimeAsync,
} from 'react-native-worklets';
import type { WorkletRuntime } from 'react-native-worklets';
import type { UseWorkerConfig, UseWorkerResult } from '../types';
import { WorkerPool } from '../WorkerPool';

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? obj.reason;
    if (msg !== undefined) return new Error(String(msg));
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return new Error(json);
    } catch (_e) { /* ignore */ }
    const keys = Object.getOwnPropertyNames(err);
    if (keys.length > 0) {
      const parts = keys.map((k) => `${k}: ${String(obj[k])}`).join(', ');
      return new Error(parts);
    }
  }
  const str = String(err);
  return new Error(str === '[object Object]' ? 'Unknown worker error' : str);
}

export function useWorker<TInput, TOutput>(
  task: (input: TInput) => TOutput,
  deps?: DependencyList,
  config?: UseWorkerConfig
): UseWorkerResult<TInput, TOutput> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TOutput | null>(null);

  const dedicated = config?.dedicated ?? true;
  const workerName = config?.name ?? `UseWorker-${Date.now()}`;

  const runtimeRef = useRef<WorkletRuntime | null>(null);
  const cancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef<string>(workerName);
  const dedicatedRef = useRef(dedicated);
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (dedicatedRef.current) {
        WorkerPool.shared().unregisterDedicated(nameRef.current);
      } else {
        WorkerPool.shared().unregisterPooled(nameRef.current);
      }
      runtimeRef.current = null;
    };
  }, []);

  const run = useCallback(
    async (input: TInput): Promise<TOutput> => {
      if (!runtimeRef.current) {
        const pool = WorkerPool.shared();
        if (dedicatedRef.current) {
          runtimeRef.current = createWorkletRuntime({ name: nameRef.current });
          pool.registerDedicated(nameRef.current);
        } else {
          runtimeRef.current = pool.acquire(nameRef.current);
        }
      }

      cancelledRef.current = false;
      setIsLoading(true);
      setError(null);

      const currentTask = taskRef.current;
      const runtime = runtimeRef.current;
      const timeoutMs = config?.timeout;
      const pool = !dedicatedRef.current ? WorkerPool.shared() : null;
      pool?.incrementPending(nameRef.current);

      try {
        const resultPromise = runOnRuntimeAsync(runtime, currentTask, input);

        let result: TOutput;
        if (timeoutMs && timeoutMs > 0) {
          result = await Promise.race([
            resultPromise,
            new Promise<never>((_resolve, reject) => {
              timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;
                reject(new Error(`Worker timeout after ${timeoutMs}ms`));
              }, timeoutMs);
            }),
          ]);
          if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        } else {
          result = (await resultPromise) as TOutput;
        }

        if (!cancelledRef.current) {
          setData(result);
          setIsLoading(false);
        }
        return result;
      } catch (err) {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        const taskError = toError(err);
        if (!cancelledRef.current) {
          setError(taskError);
          setIsLoading(false);
        }
        throw taskError;
      } finally {
        pool?.decrementPending(nameRef.current);
      }
    },
    deps ?? []
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (dedicatedRef.current) {
      WorkerPool.shared().unregisterDedicated(nameRef.current);
    } else {
      WorkerPool.shared().unregisterPooled(nameRef.current);
    }
    setIsLoading(false);
    runtimeRef.current = null;
  }, []);

  return { run, isLoading, error, data, cancel };
}
