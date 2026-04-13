import type { WorkerEvent, WorkerEventListener, WorkerEventType } from '../types';

export class EventEmitter<TOutput = unknown> {
  private listeners = new Map<
    WorkerEventType,
    Set<WorkerEventListener<TOutput>>
  >();

  addEventListener(
    type: WorkerEventType,
    listener: WorkerEventListener<TOutput>
  ): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(
    type: WorkerEventType,
    listener: WorkerEventListener<TOutput>
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: WorkerEventType, event: WorkerEvent<TOutput>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors to prevent cascading failures
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
