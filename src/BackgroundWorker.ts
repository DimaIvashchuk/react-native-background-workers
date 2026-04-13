import {
  createWorkletRuntime,
  runOnRuntimeAsync,
} from 'react-native-worklets';
import type { WorkletRuntime } from 'react-native-worklets';
import type {
  BackgroundWorker,
  BackgroundWorkerOptions,
  WorkerEventListener,
  WorkerEventType,
} from './types';
import { WorkerPool } from './WorkerPool';
import { EventEmitter } from './utils/EventEmitter';
import { uid } from './utils/uid';

export type ReadyCallback = (ready: boolean, error: Error | null) => void;

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? obj.reason;
    if (msg !== undefined) return new Error(String(msg));
  }
  const str = String(err);
  return new Error(str === '[object Object]' ? 'Unknown worker error' : str);
}

export class BackgroundWorkerImpl<TInput = unknown, TOutput = unknown>
implements BackgroundWorker<TInput, TOutput> {
  private runtime: WorkletRuntime;
  private setupPromise: Promise<void> | null = null;
  private _terminated = false;
  private _dedicated = false;
  private _name: string;
  private _ready = true;
  private _setupError: Error | null = null;
  private _onReadyCallback: ReadyCallback | null = null;
  private emitter = new EventEmitter<TOutput>();
  private onMessageHandler:
    | ((message: TInput) => TOutput)
    | undefined;
  private onErrorHandler: ((error: Error) => void) | undefined;

  get isReady(): boolean {
    return this._ready;
  }

  get setupError(): Error | null {
    return this._setupError;
  }

  set onReadyCallback(cb: ReadyCallback | null) {
    this._onReadyCallback = cb;
  }

  constructor(options: BackgroundWorkerOptions<TInput, TOutput>) {
    this._name = options.name ?? 'BackgroundWorker';
    this._dedicated = true;
    this.runtime = createWorkletRuntime({ name: this._name });
    this.onMessageHandler = options.onMessage;
    this.onErrorHandler = options.onError;

    WorkerPool.shared().registerDedicated(this._name);

    if (options.setup) {
      this._ready = false;
      this.setupPromise = this.runSetup(this.runtime, options.setup);
    }
  }

  static withRuntime<TInput = unknown, TOutput = unknown>(
    runtime: WorkletRuntime,
    options: BackgroundWorkerOptions<TInput, TOutput>
  ): BackgroundWorkerImpl<TInput, TOutput> {
    const instance = Object.create(
      BackgroundWorkerImpl.prototype
    ) as BackgroundWorkerImpl<TInput, TOutput>;
    instance._name = options.name ?? 'BackgroundWorker';
    instance._dedicated = false;
    instance.runtime = runtime;
    instance._terminated = false;
    instance._ready = true;
    instance._setupError = null;
    instance._onReadyCallback = null;
    instance.emitter = new EventEmitter<TOutput>();
    instance.onMessageHandler = options.onMessage;
    instance.onErrorHandler = options.onError;
    instance.setupPromise = null;

    if (options.setup) {
      instance._ready = false;
      instance.setupPromise = instance.runSetup(runtime, options.setup);
    }

    return instance;
  }

  private async runSetup(
    runtime: WorkletRuntime,
    setup: () => Promise<void> | void
  ): Promise<void> {
    const safeSetup = () => {
      'worklet';
      try {
        setup();
        return null;
      } catch (e: any) {
        return (e && e.message) ? String(e.message) : String(e);
      }
    };

    const errorMsg = await runOnRuntimeAsync(runtime, safeSetup);
    this.setupPromise = null;

    if (errorMsg === null) {
      this._ready = true;
      this._onReadyCallback?.(true, null);
    } else {
      this._ready = false;
      this._setupError = new Error(String(errorMsg));
      this._onReadyCallback?.(false, this._setupError);
      this.onErrorHandler?.(this._setupError);
    }
  }

  async send<T = TOutput>(message: TInput): Promise<T> {
    if (this._terminated) {
      throw new Error('Worker is terminated');
    }
    this.throwIfSetupFailed();
    if (this.setupPromise) {
      await this.setupPromise;
      this.throwIfSetupFailed();
    }

    const handler = this.onMessageHandler;
    if (!handler) {
      throw new Error('No onMessage handler defined');
    }

    const messageId = uid();
    const pool = !this._dedicated ? WorkerPool.shared() : null;
    pool?.incrementPending(this._name);

    const safeHandler = (msg: TInput) => {
      'worklet';
      try {
        const result = handler(msg);
        return { ok: true as const, value: result };
      } catch (e: any) {
        const errMsg = (e && e.message) ? String(e.message) : String(e);
        return { ok: false as const, error: errMsg };
      }
    };

    try {
      const result = await runOnRuntimeAsync(this.runtime, safeHandler, message);
      if (result && typeof result === 'object' && 'ok' in result) {
        if (result.ok) {
          const event = {
            type: 'message' as const,
            data: result.value as TOutput,
            messageId,
          };
          this.emitter.emit('message', event);
          return result.value as unknown as T;
        } else {
          const error = new Error(String(result.error));
          const event = {
            type: 'error' as const,
            error,
            messageId,
          };
          this.emitter.emit('error', event);
          this.onErrorHandler?.(error);
          throw error;
        }
      }
      const event = {
        type: 'message' as const,
        data: result as TOutput,
        messageId,
      };
      this.emitter.emit('message', event);
      return result as T;
    } catch (err) {
      const error = toError(err);
      const event = {
        type: 'error' as const,
        error,
        messageId,
      };
      this.emitter.emit('error', event);
      this.onErrorHandler?.(error);
      throw error;
    } finally {
      pool?.decrementPending(this._name);
    }
  }

  postMessage(message: TInput): void {
    if (this._terminated) {
      throw new Error('Worker is terminated');
    }
    this.send(message).catch((err: unknown) => {
      const error = toError(err);
      this.emitter.emit('error', { type: 'error', error });
    });
  }

  addEventListener(
    type: WorkerEventType,
    listener: WorkerEventListener<TOutput>
  ): void {
    this.emitter.addEventListener(type, listener);
  }

  removeEventListener(
    type: WorkerEventType,
    listener: WorkerEventListener<TOutput>
  ): void {
    this.emitter.removeEventListener(type, listener);
  }

  terminate(): void {
    this._terminated = true;
    this.emitter.removeAllListeners();
    this.onMessageHandler = undefined;
    this.onErrorHandler = undefined;
    this.setupPromise = null;
    this._onReadyCallback = null;

    if (this._dedicated) {
      WorkerPool.shared().unregisterDedicated(this._name);
    } else {
      WorkerPool.shared().unregisterPooled(this._name);
    }

    this.runtime = undefined as unknown as WorkletRuntime;
  }

  isTerminated(): boolean {
    return this._terminated;
  }

  private throwIfSetupFailed(): void {
    if (this._setupError) {
      throw new Error(`Worker setup failed: ${this._setupError.message}`);
    }
  }
}
