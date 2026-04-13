import { BackgroundWorkerImpl } from '../BackgroundWorker';
import type {
  BackgroundWorker,
  ImageProcessingWorkerOptions,
} from '../types';

export interface ImageProcessingWorker
  extends BackgroundWorker<unknown, unknown> {
  processImage(image: unknown): Promise<unknown>;
}

export function createImageProcessingWorker(
  options: ImageProcessingWorkerOptions
): ImageProcessingWorker {
  const worker = new BackgroundWorkerImpl({
    name: options.name ?? 'ImageProcessingWorker',
    setup: options.setup,
    onMessage: options.process,
  });

  return {
    get isReady() {
      return worker.isReady; 
    },
    get setupError() {
      return worker.setupError; 
    },
    postMessage: (msg: unknown) => worker.postMessage(msg),
    send: <T = unknown>(msg: unknown) => worker.send<T>(msg),
    addEventListener: (...args) => worker.addEventListener(...args),
    removeEventListener: (...args) => worker.removeEventListener(...args),
    terminate: () => worker.terminate(),
    isTerminated: () => worker.isTerminated(),
    processImage: (image: unknown) =>
      worker.send({ type: 'PROCESS_IMAGE', image }),
  };
}
