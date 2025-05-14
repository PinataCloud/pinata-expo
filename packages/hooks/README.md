# Pinata Expo Hooks

A collection of hooks that can be used in Expo for Uploading to Pinata

## Installation

Install with your package manager of choice

```bash
pnpm i pinata-expo-hooks@latest
```

## Usage

Import at the top of your desired page or component

```typescript
import { useUpload } from "pinata-expo-hooks";
```

Inside your page or component use the hook to extract methods and state

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

Return types for `useUpload`

```typescript
export type UseUploadReturn = {
	progress: number;
	loading: boolean;
	error: Error | null;
	uploadResponse: string | null;
	upload: (
		fileUri: string,
		network: "public" | "private",
		url: string,
		options?: UploadOptions,
	) => Promise<void>;
	pause: () => void;
	resume: () => void;
	cancel: () => void;
};
```

To upload a file you must already have a server setup that returns a [Presigned URL](https://docs.pinata.cloud/files/presigned-urls). Then you can pass it into the `upload` method like so.

```typescript
await upload(fileUri, "public", "presigned_URL", {
		name: fileName || "Upload from Expo",
		keyvalues: {
			app: "Pinata Expo Demo",
			timestamp: Date.now().toString(),
		},
	});
```

Once a file is uploaded the `uploadResponse` will contain the CID for the file

## Questions

Please [contact us](mailto:team@pinata.cloud) if you have any issues!
