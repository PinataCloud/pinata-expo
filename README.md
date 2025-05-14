# pinata-expo

This repo contains packages that are compatible with React Native and Expo for uploading files to Pinata.

>[!WARNING]
>This package is still under development, please [contact us](mailto:team@pinata.cloud) if you have any issues!

## Usage

Install the available `pinata-expo-hooks` package with your package manage of choice

```bash
pnpm install pinata-expo-hooks
```

Inside your app import the `useUpload` hook

```typescript
import { useUpload } from "pinata-expo-hooks";
```

Then use it inside the app

```typescript
	const {
		upload, // Method to upload a file using a presigned URL
		progress, // Progress state as integer
		loading, // Boolean uploading state
		uploadResponse, // File ID used to fetch the file info server side
		error, // Error state
		pause, // Pause upload method
		resume, // Resume upload method
		cancel, // Cancel current upload method
	} = useUpload();
```

In order to upload you will need to have a server that provides a [presigned URL](https://docs.pinata.cloud/files/presigned-urls). An example of that server can be found inside this repo under `examples/expo-server`. An example of a client uploading files can be found in `examples/expo-app`.

## Development

The `pinata-expo` monorepo uses `pnpm` to manage workspaces and building packages. The structure is as follows:

```
.
├── examples
│   ├── expo-app
│   └── expo-server
├── package.json
├── packages
│   └── hooks
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

### Installation

To start clone the repo and install dependencies

```bash
git clone https://github.com/PinataCloud/pinata-expo
cd pinata-expo
pnpm install
```

### Building

Move into the `packages/hooks` package to build it

```bash
cd packages/hooks
pnpm run build
```

Building will create a `dist` folder which will be accessible to other packages through `workspace:*` as seen in the `expo-app` example.

```json
"pinata-expo-hooks": "workspace:*",
```

### Examples

The `examples` folder contains an Expo app and a Hono server you can use together for testing.

Start by setting up the server, where you will need to create a `.dev.vars` file with the following contents:

```
PINATA_JWT=YOUR_PINATA_JWT
GATEWAY_URL=yourgateway.mypinata.cloud
```

Be sure to sub out the example values with your own. Then start up the dev server:

```bash
pnpm run dev
```

To use the `expo-app` simply move into that package, install dependencies, then start up the dev server.

```bash
cd examples/expo-app
pnpm install
pnpm run start
```
