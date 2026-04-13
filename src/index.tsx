// Core class
export { BackgroundWorkerImpl } from './BackgroundWorker';

// Hooks
export { useBackgroundWorker } from './hooks/useBackgroundWorker';
export type { UseBackgroundWorkerResult } from './hooks/useBackgroundWorker';
export { useWorker } from './hooks/useWorker';

// Pool
export { WorkerPool } from './WorkerPool';

// Presets
export { createInferenceWorker } from './presets/inference';
export { createImageProcessingWorker } from './presets/imageProcessing';

// Types
export type {
  BackgroundWorker,
  BackgroundWorkerOptions,
  WorkerConfig,
  WorkerEvent,
  WorkerEventType,
  WorkerEventListener,
  UseWorkerResult,
  UseWorkerConfig,
  WorkerPoolStats,
  PoolSlotInfo,
  RegisteredWorkerInfo,
  WorkerStatus,
  InferenceWorkerOptions,
  ImageProcessingWorkerOptions
} from './types';

export type {
  InferenceWorker
} from './presets/inference';

export type {
  ImageProcessingWorker
} from './presets/imageProcessing';
