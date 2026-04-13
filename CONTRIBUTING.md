# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

The library source lives in the root `src/` directory. An example app in `example/` is configured to use the local source directly via Metro.

### Prerequisites

- Node.js >= 18 (see [`.nvmrc`](./.nvmrc) for the recommended version)
- Yarn v1 (`npm install -g yarn`)
- Xcode 16+ and CocoaPods (for iOS)
- Android SDK / Android Studio (for Android)

### Setup

```sh
# Install root dependencies
yarn install

# Install example app dependencies
cd example
yarn install

# Install iOS pods
cd ios
pod install
cd ../..
```

> The example app's `package.json` uses `"react-native-background-workers": "link:.."` to resolve the library from the parent directory. Metro is configured to watch `../src` and map imports directly to the source, so any changes you make to the library's TypeScript code will be reflected immediately via Fast Refresh.

### Running the example app

From the repo root:

```sh
# Start Metro bundler
yarn start

# Run on iOS
yarn ios

# Run on Android
yarn android
```

Or from the `example/` directory:

```sh
cd example
yarn start
yarn ios
yarn android
```

### Building the library

```sh
# Compile src/ -> lib/ via tsc
yarn build

# Build in watch mode (useful during development)
yarn build:watch

# Type-check without emitting files
yarn typecheck
```

### Linting

```sh
# Check for lint errors
yarn lint

# Auto-fix lint errors
yarn lint:fix
```

### Scripts reference

| Script | Description |
|---|---|
| `yarn build` | Compile `src/` to `lib/` via `tsc` |
| `yarn build:watch` | Same as build, in watch mode |
| `yarn typecheck` | Type-check without emitting |
| `yarn lint` | Lint `src/` and `example/` with ESLint |
| `yarn lint:fix` | Auto-fix lint issues |
| `yarn start` | Start Metro for the example app |
| `yarn ios` | Build and run the example on iOS |
| `yarn android` | Build and run the example on Android |

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that `yarn typecheck` and `yarn lint` pass.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
