export type WorkerEventType = 'message' | 'error' | 'progress';

export interface WorkerEvent<T = unknown> {
  type: WorkerEventType;
  data?: T;
  error?: Error;
  progress?: number;
  messageId?: string;
}

export type WorkerEventListener<T = unknown> = (event: WorkerEvent<T>) => void;

export interface BackgroundWorker<TInput = unknown, TOutput = unknown> {
  readonly isReady: boolean;
  readonly setupError: Error | null;
  postMessage(message: TInput): void;
  send<T = TOutput>(message: TInput): Promise<T>;
  addEventListener(
    type: WorkerEventType,
    listener: WorkerEventListener<TOutput>
  ): void;
  removeEventListener(
    type: WorkerEventType,
    listener: WorkerEventListener<TOutput>
  ): void;
  terminate(): void;
  isTerminated(): boolean;
}

export interface BackgroundWorkerOptions<TInput = unknown, TOutput = unknown> {
  name?: string;
  setup?: () => Promise<void> | void;
  onMessage?: (message: TInput) => TOutput;
  onError?: (error: Error) => void;
}

export interface WorkerConfig {
  dedicated?: boolean;
  autoTerminateOnUnmount?: boolean;
}

export interface UseWorkerResult<TInput, TOutput> {
  run: (input: TInput) => Promise<TOutput>;
  isLoading: boolean;
  error: Error | null;
  data: TOutput | null;
  cancel: () => void;
}

export interface UseWorkerConfig {
  timeout?: number;
  dedicated?: boolean;
  name?: string;
}

export interface RegisteredWorkerInfo {
  workerName: string;
  pendingTasks: number;
}

export interface PoolSlotInfo {
  slotName: string;
  workers: RegisteredWorkerInfo[];
  totalPending: number;
}

export interface WorkerStatus {
  name: string;
  type: 'dedicated' | 'pooled';
  poolSlot: string | null;
  pendingTasks: number;
}

export interface WorkerPoolStats {
  dedicatedCount: number;
  dedicatedNames: string[];
  pooledCount: number;
  pooledMaxSize: number;
  poolSlots: PoolSlotInfo[];
  workers: WorkerStatus[];
  totalRuntimes: number;
}

export interface InferenceWorkerOptions {
  name?: string;
  loadModel: () => Promise<void> | void;
  predict: (input: unknown) => Promise<unknown> | unknown;
}

export interface ImageProcessingWorkerOptions {
  name?: string;
  setup?: () => Promise<void> | void;
  process: (image: unknown) => Promise<unknown> | unknown;
}
