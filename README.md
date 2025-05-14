# pinata-expo

This repo contains packages that are compatible with React Native and Expo for uploading files to Pinata.

>[!WARNING]
>This package is still under development, please [contact us](mailto:team@pinata.cloud) if you have any issues!

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
