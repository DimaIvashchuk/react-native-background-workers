import { BackgroundWorkerImpl } from '../BackgroundWorker';
import type { BackgroundWorker, InferenceWorkerOptions } from '../types';

export interface InferenceWorker extends BackgroundWorker<unknown, unknown> {
  infer(input: unknown): Promise<unknown>;
}

export function createInferenceWorker(
  options: InferenceWorkerOptions
): InferenceWorker {
  const worker = new BackgroundWorkerImpl({
    name: options.name ?? 'InferenceWorker',
    setup: options.loadModel,
    onMessage: options.predict,
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
    infer: (input: unknown) =>
      worker.send({ type: 'INFER', input }),
  };
}
