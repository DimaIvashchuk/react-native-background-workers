# Background Workers Example

Demo app for [`react-native-background-workers`](https://github.com/DimaIvashchuk/react-native-background-workers).

## Setup

Make sure you have installed root dependencies first (see the [main README](../README.md)).

```sh
# From the example/ directory
yarn install

# Install iOS pods
cd ios && pod install && cd ..
```

## Running

```sh
# Start Metro
yarn start

# iOS
yarn ios

# Android
yarn android
```

## What's inside

| Demo | Description |
|---|---|
| **Heavy Computation** | `useBackgroundWorker` with `setup` lifecycle, `isReady` guard |
| **Setup Error** | Intentionally failing setup to show `setupError` handling |
| **Simple Task** | `useWorker` one-off task with timeout and cancel |
| **Pool Mode** | 5 pooled workers sharing 3 runtime slots |
| **Worker Stats** | Live `WorkerPool.getStats()` display |

Source: [`src/App.tsx`](./src/App.tsx)
