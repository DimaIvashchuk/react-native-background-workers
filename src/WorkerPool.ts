import { createWorkletRuntime } from 'react-native-worklets';
import type { WorkletRuntime } from 'react-native-worklets';
import type {
  PoolSlotInfo,
  RegisteredWorkerInfo,
  WorkerPoolStats,
  WorkerStatus,
} from './types';

const DEFAULT_MAX_POOL_SIZE = 4;

interface WorkerRecord {
  pendingTasks: number;
}

interface PoolEntry {
  slotName: string;
  runtime: WorkletRuntime;
  workers: Map<string, WorkerRecord>;
}

export class WorkerPool {
  private static instance: WorkerPool | null = null;
  private static configuredMaxSize: number = DEFAULT_MAX_POOL_SIZE;

  private entries: PoolEntry[] = [];
  private dedicatedNames = new Set<string>();
  private workerToEntry = new Map<string, PoolEntry>();
  private maxSize: number;
  private nextIndex = 0;

  private constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Set the maximum pool size for shared (non-dedicated) runtimes.
   * Safe to call at module top level — no native work happens until
   * the first worker actually uses pool mode.
   */
  static configure(maxSize: number): void {
    WorkerPool.configuredMaxSize = maxSize;
  }

  static shared(): WorkerPool {
    if (!WorkerPool.instance) {
      WorkerPool.instance = new WorkerPool(WorkerPool.configuredMaxSize);
    }
    return WorkerPool.instance;
  }

  static reset(): void {
    if (WorkerPool.instance) {
      WorkerPool.instance.entries = [];
      WorkerPool.instance.dedicatedNames.clear();
      WorkerPool.instance.workerToEntry.clear();
      WorkerPool.instance.nextIndex = 0;
    }
    WorkerPool.instance = null;
    WorkerPool.configuredMaxSize = DEFAULT_MAX_POOL_SIZE;
  }

  acquire(workerName: string): WorkletRuntime {
    let entry: PoolEntry;

    if (this.entries.length < this.maxSize) {
      const slotName = `PoolSlot-${this.entries.length}`;
      const runtime = createWorkletRuntime({ name: slotName });
      entry = { slotName, runtime, workers: new Map() };
      this.entries.push(entry);
    } else {
      let best = this.entries[this.nextIndex % this.entries.length]!;
      let bestPending = this.totalPendingForEntry(best);
      for (const e of this.entries) {
        const p = this.totalPendingForEntry(e);
        if (p < bestPending) {
          best = e;
          bestPending = p;
        }
      }
      this.nextIndex++;
      entry = best;
    }

    entry.workers.set(workerName, { pendingTasks: 0 });
    this.workerToEntry.set(workerName, entry);
    return entry.runtime;
  }

  unregisterPooled(workerName: string): void {
    const entry = this.workerToEntry.get(workerName);
    if (entry) {
      entry.workers.delete(workerName);
      this.workerToEntry.delete(workerName);
    }
  }

  registerDedicated(name: string): void {
    this.dedicatedNames.add(name);
  }

  unregisterDedicated(name: string): void {
    this.dedicatedNames.delete(name);
  }

  incrementPending(workerName: string): void {
    const entry = this.workerToEntry.get(workerName);
    if (entry) {
      const rec = entry.workers.get(workerName);
      if (rec) rec.pendingTasks++;
    }
  }

  decrementPending(workerName: string): void {
    const entry = this.workerToEntry.get(workerName);
    if (entry) {
      const rec = entry.workers.get(workerName);
      if (rec && rec.pendingTasks > 0) rec.pendingTasks--;
    }
  }

  getWorkerStatus(workerName: string): WorkerStatus | null {
    if (this.dedicatedNames.has(workerName)) {
      return {
        name: workerName,
        type: 'dedicated',
        poolSlot: null,
        pendingTasks: 0,
      };
    }

    const entry = this.workerToEntry.get(workerName);
    if (entry) {
      const rec = entry.workers.get(workerName);
      return {
        name: workerName,
        type: 'pooled',
        poolSlot: entry.slotName,
        pendingTasks: rec?.pendingTasks ?? 0,
      };
    }

    return null;
  }

  getStats(): WorkerPoolStats {
    const poolSlots: PoolSlotInfo[] = this.entries.map((e) => {
      const workers: RegisteredWorkerInfo[] = [];
      e.workers.forEach((rec, name) => {
        workers.push({ workerName: name, pendingTasks: rec.pendingTasks });
      });
      return {
        slotName: e.slotName,
        workers,
        totalPending: this.totalPendingForEntry(e),
      };
    });

    const allWorkers: WorkerStatus[] = [];

    for (const name of this.dedicatedNames) {
      allWorkers.push({
        name,
        type: 'dedicated',
        poolSlot: null,
        pendingTasks: 0,
      });
    }

    this.workerToEntry.forEach((entry, name) => {
      const rec = entry.workers.get(name);
      allWorkers.push({
        name,
        type: 'pooled',
        poolSlot: entry.slotName,
        pendingTasks: rec?.pendingTasks ?? 0,
      });
    });

    return {
      dedicatedCount: this.dedicatedNames.size,
      dedicatedNames: [...this.dedicatedNames],
      pooledCount: this.entries.length,
      pooledMaxSize: this.maxSize,
      poolSlots,
      workers: allWorkers,
      totalRuntimes: this.dedicatedNames.size + this.entries.length,
    };
  }

  private totalPendingForEntry(entry: PoolEntry): number {
    let total = 0;
    entry.workers.forEach((rec) => {
      total += rec.pendingTasks; 
    });
    return total;
  }
}
