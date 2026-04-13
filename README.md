# react-native-background-workers [WIP]

High-level, type-safe Web Workers API for React Native New Architecture.

Run heavy computations (ML inference, image processing, complex algorithms, large data parsing) in **separate background runtimes** without blocking the main JS thread or UI.

Built on top of [`react-native-worklets`](https://docs.swmansion.com/react-native-worklets/) (Software Mansion) but hides all low-level details — no `'worklet'` directives, no `makeShareable`, no `runOnRuntime` boilerplate.

## Features

- **Declarative hooks** — `useBackgroundWorker` and `useWorker`
- **Promise-based messaging** — `worker.send(msg)` returns a typed `Promise`
- **Setup lifecycle** — `isReady` / `setupError` let you guard UI until the worker is initialized
- **Event system** — `addEventListener` for `message`, `error`, `progress`
- **Worker Pool** — share runtimes across multiple hooks with `WorkerPool.configure()`
- **Babel plugin** — auto-workletizes your callbacks, zero config needed
- **Presets** — factory functions for common use-cases (ML inference, image processing)
- **TypeScript-first** — fully typed inputs, outputs, and events

## Installation

```bash
yarn add react-native-background-workers react-native-worklets
```

For iOS, install native dependencies:

```bash
cd ios && pod install
```

### Babel Plugin Setup

Add both plugins to your `babel.config.js` (order matters):

```js
module.exports = {
  // ...
  plugins: [
    'react-native-background-workers/plugin',  // must come first
    'react-native-worklets/plugin',
  ],
};
```

The background-workers plugin auto-injects `'worklet'` directives into your `setup`, `onMessage`, and task callbacks so you never need to write them manually.

## Quick Start

### useBackgroundWorker — long-lived worker

```tsx
import { useBackgroundWorker } from 'react-native-background-workers';

function MyComponent() {
  const { worker, isReady, setupError } = useBackgroundWorker({
    name: 'StatsWorker',
    setup: () => {
      globalThis.cache = new Map();
    },
    onMessage: (msg: { numbers: number[] }) => {
      const sum = msg.numbers.reduce((a, b) => a + b, 0);
      return { sum, avg: sum / msg.numbers.length };
    },
  });

  if (setupError) return <Text>Setup failed: {setupError.message}</Text>;
  if (!isReady) return <ActivityIndicator />;

  const handlePress = async () => {
    const result = await worker.send({ numbers: [1, 2, 3, 4, 5] });
    console.log(result); // { sum: 15, avg: 3 }
  };

  return <Button onPress={handlePress} title="Compute" />;
}
```

### useWorker — simple one-off task

```tsx
import { useWorker } from 'react-native-background-workers';

function MyComponent() {
  const { run, isLoading, data, error } = useWorker(
    (n: number) => {
      let total = 0;
      for (let i = 0; i < n; i++) total += Math.sqrt(i);
      return total;
    },
    [],
    { timeout: 5000 }
  );

  return (
    <>
      <Button onPress={() => run(1_000_000)} title="Run" disabled={isLoading} />
      {data != null && <Text>Result: {data}</Text>}
    </>
  );
}
```

### Pool Mode — shared runtimes

```tsx
import { WorkerPool, useBackgroundWorker } from 'react-native-background-workers';

// Call once at app startup to set the max number of shared runtimes
WorkerPool.configure(4);

function MyComponent() {
  const { worker: workerA } = useBackgroundWorker(
    { name: 'A', onMessage: (msg) => `processed: ${msg}` },
    { dedicated: false }
  );

  const { worker: workerB } = useBackgroundWorker(
    { name: 'B', onMessage: (msg) => msg.toUpperCase() },
    { dedicated: false }
  );

  // Both workers share from a pool of up to 4 runtimes
}
```

### Worker Pool Stats

```tsx
import { WorkerPool } from 'react-native-background-workers';

const stats = WorkerPool.shared().getStats();
// {
//   dedicatedCount: 2,
//   dedicatedNames: ['HeavyWorker', 'MLWorker'],
//   pooledCount: 3,
//   pooledMaxSize: 4,
//   poolSlots: [
//     { slotName: 'PoolSlot-0', workers: [...], totalPending: 1 },
//     ...
//   ],
//   workers: [
//     { name: 'A', type: 'pooled', poolSlot: 'PoolSlot-0', pendingTasks: 1 },
//     ...
//   ],
//   totalRuntimes: 5,
// }
```

## API Reference

### `useBackgroundWorker<TInput, TOutput>(options, config?)`

Creates a long-lived background worker.

**Options:**

| Property | Type | Description |
|---|---|---|
| `name` | `string?` | Debug name (shown in profilers and pool stats) |
| `setup` | `() => void \| Promise<void>` | Runs once when the runtime is created |
| `onMessage` | `(msg: TInput) => TOutput` | Message handler, return value is sent back |
| `onError` | `(error: Error) => void` | Error handler inside the worker |

**Config:**

| Property | Type | Default | Description |
|---|---|---|---|
| `dedicated` | `boolean` | `true` | `true` = own runtime, `false` = use shared pool |
| `autoTerminateOnUnmount` | `boolean` | `true` | Auto-terminate on component unmount |

**Returns `UseBackgroundWorkerResult<TInput, TOutput>`:**

| Property | Type | Description |
|---|---|---|
| `worker` | `BackgroundWorker<TInput, TOutput>` | The worker instance |
| `isReady` | `boolean` | `false` while `setup` is running; `true` when complete (or if no setup) |
| `setupError` | `Error \| null` | The error if `setup` threw; `null` otherwise |

**`worker` methods:**

| Method | Description |
|---|---|
| `send<T>(msg)` | Send message and await typed response |
| `postMessage(msg)` | Fire-and-forget send |
| `addEventListener(type, fn)` | Listen for `'message'`, `'error'`, `'progress'` |
| `removeEventListener(type, fn)` | Remove a listener |
| `terminate()` | Stop the worker and free the runtime |
| `isTerminated()` | Check if worker has been terminated |
| `isReady` | Whether setup completed successfully |
| `setupError` | The setup error, if any |

### `useWorker<TInput, TOutput>(task, deps?, config?)`

Simple hook for one-off computations.

| Parameter | Type | Description |
|---|---|---|
| `task` | `(input: TInput) => TOutput` | The function to run in background |
| `deps` | `DependencyList?` | React dependency list |

**Config:**

| Property | Type | Default | Description |
|---|---|---|---|
| `timeout` | `number?` | -- | Timeout in milliseconds |
| `dedicated` | `boolean` | `true` | `true` = own runtime, `false` = use shared pool |
| `name` | `string?` | -- | Worker name for pool stats tracking |

**Returns:**

| Property | Type | Description |
|---|---|---|
| `run(input)` | `(input: TInput) => Promise<TOutput>` | Execute the task |
| `isLoading` | `boolean` | Whether a task is running |
| `data` | `TOutput \| null` | Last successful result |
| `error` | `Error \| null` | Last error |
| `cancel()` | `() => void` | Cancel the current task |

### `WorkerPool`

Global singleton for managing shared runtimes.

| Method | Description |
|---|---|
| `WorkerPool.configure(maxSize)` | Set max pool size. Call once at app startup, before any pool workers are created. |
| `WorkerPool.shared()` | Get the singleton instance |
| `pool.getStats()` | Get live stats: dedicated/pooled counts, slot details, per-worker pending tasks |
| `pool.getWorkerStatus(name)` | Look up a specific worker by name |

### Presets

#### `createInferenceWorker(options)`

```tsx
import { createInferenceWorker } from 'react-native-background-workers';

const mlWorker = createInferenceWorker({
  name: 'TFLite',
  loadModel: () => { /* load model into globalThis */ },
  predict: (input) => { /* run inference, return result */ },
});

const result = await mlWorker.infer(tensorData);
```

#### `createImageProcessingWorker(options)`

```tsx
import { createImageProcessingWorker } from 'react-native-background-workers';

const imgWorker = createImageProcessingWorker({
  name: 'ImageProcessor',
  process: (image) => { /* process image, return result */ },
});

const result = await imgWorker.processImage(imageData);
```

## Usage with Expo

This library requires native code (`react-native-worklets` contains C++ TurboModules), so **Expo Go is not supported**. You must use a [development build](https://docs.expo.dev/develop/development-builds/introduction/).

### Setup

```bash
npx expo install react-native-background-workers react-native-worklets
```

Add the Babel plugins to your `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-background-workers/plugin',
      'react-native-worklets/plugin',
    ],
  };
};
```

Generate native projects and build:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

## Running the Example App

The repo ships with a full demo app under `example/` that showcases every API.

### Prerequisites

- Node.js >= 18
- Yarn v1 (`npm install -g yarn`)
- Xcode 16+ (for iOS)
- CocoaPods (`gem install cocoapods`)
- Android SDK / Android Studio (for Android)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/DimaIvashchuk/react-native-background-workers.git
cd react-native-background-workers

# 2. Install root dependencies
yarn install

# 3. Install example dependencies
cd example
yarn install

# 4. Install iOS native pods
cd ios
pod install
cd ../..
```

### Run on iOS

```bash
yarn ios
```

### Run on Android

```bash
yarn android
```

### Start Metro Bundler Manually

```bash
yarn start
```

### What the Example Demonstrates

| Demo | API | Description |
|---|---|---|
| **Heavy Computation** | `useBackgroundWorker` | Sums 1 billion numbers in a dedicated worker — UI stays responsive. Shows `isReady` / setup lifecycle. |
| **Setup Error** | `useBackgroundWorker` | Intentionally failing setup to demonstrate `setupError` handling and `send()` guard. |
| **Simple Task** | `useWorker` | Computes `sqrt(0) + ... + sqrt(10M)` as a one-off background task with timeout and cancel. |
| **Pool Mode** | `useBackgroundWorker` | 5 workers (prime, hash, fib, sort, collatz) sharing 3 pool slots in parallel. |
| **Worker Stats** | `WorkerPool.shared().getStats()` | Live view of all runtimes — dedicated names, pool slots, per-worker pending tasks. |

## Architecture

```
User Code (hooks)
    |
    v
useBackgroundWorker / useWorker
    |
    v
BackgroundWorkerImpl  ---- WorkerPool (when dedicated: false)
    |                           |
    v                           v
react-native-worklets APIs
    |
    v
Worker Runtime(s)  <- separate JS threads
```

**Key concepts:**

- Each `BackgroundWorkerImpl` wraps one `WorkletRuntime` created via `createWorkletRuntime()`
- `send()` uses `runOnRuntimeAsync()` for Promise-based communication
- Errors are caught **inside the worklet** (where `Error` is still intact) and returned as plain strings to avoid broken serialization across the runtime boundary
- `postMessage()` is fire-and-forget via `send().catch()`
- The **WorkerPool** lazily creates runtimes (up to configured max) and distributes work via round-robin with least-pending preference
- State sharing between `setup` and `onMessage` happens through `globalThis` of the worker runtime (each runtime has its own isolated global scope)

## Important Notes

### Worklet Runtime Limitations

Worker runtimes are bare Hermes JS engines. They do **not** have access to browser or React Native globals such as `fetch`, `setTimeout`, `XMLHttpRequest`, or the `console` object. Workers are designed for **CPU-bound** tasks only — pure computation, data transformation, and number crunching.

### State Sharing

`setup` and `onMessage` run as separate worklet invocations on the same runtime. They **cannot** share variables via JavaScript closure. Use `globalThis` instead:

```tsx
const { worker } = useBackgroundWorker({
  setup: () => {
    globalThis.model = loadModel();
  },
  onMessage: (msg) => {
    return globalThis.model.predict(msg);
  },
});
```

### Serialization

Arguments passed to `send()` / `postMessage()` must be serializable (numbers, strings, plain objects, arrays). Functions and class instances cannot be sent as messages.

## Development

```bash
# Build the library (compiles src/ -> lib/ via tsc)
yarn build

# Build in watch mode
yarn build:watch

# Type-check without emitting
yarn typecheck

# Lint source and example
yarn lint

# Auto-fix lint issues
yarn lint:fix
```

## Requirements

- React Native 0.76+ (New Architecture enabled)
- `react-native-worklets` >= 0.8.0
- Expo SDK 52+ (if using Expo, with development build)

## License

MIT
