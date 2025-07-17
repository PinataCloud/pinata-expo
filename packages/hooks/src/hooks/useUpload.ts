import { useState, useCallback, useRef, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import {
	NetworkError,
	AuthenticationError,
	ValidationError,
	type ExtendedUploadOptions,
	type UseUploadReturn,
} from "../types";
//@ts-ignore
import Base64 from "Base64";

const BASE_CHUNK_SIZE = 50 * 1024 * 1024 + 1;

// Default retry configuration
const DEFAULT_RETRY_OPTIONS = {
	maxRetries: 3,
	initialDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
	retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export const useUpload = (): UseUploadReturn => {
	const [progress, setProgress] = useState<number>(0);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<Error | null>(null);
	const [uploadResponse, setUploadResponse] = useState<string | null>(null);
	const [retryCount, setRetryCount] = useState<number>(0);

	// Refs to manage pause/resume/cancel functionality
	const uploadUrlRef = useRef<string | null>(null);
	const pausedRef = useRef<boolean>(false);
	const cancelledRef = useRef<boolean>(false);
	const uploadOffsetRef = useRef<number>(0);
	const fileInfoRef = useRef<{
		fileUri?: string;
		base64Data?: string;
		fileSize: number;
		fileType: string;
		fileName: string;
		isBase64: boolean;
	} | null>(null);
	const optionsRef = useRef<ExtendedUploadOptions | null>(null);
	const networkRef = useRef<"public" | "private">("public");
	const headerRef = useRef<Record<string, string>>({});
	const lastResponseHeadersRef = useRef<Headers | null>(null);
	const chunkSizeRef = useRef<number>(BASE_CHUNK_SIZE);
	const retryOptionsRef = useRef<typeof DEFAULT_RETRY_OPTIONS>(
		DEFAULT_RETRY_OPTIONS,
	);

	// Reset state for new upload
	const resetState = useCallback(() => {
		setProgress(0);
		setError(null);
		setUploadResponse(null);
		setRetryCount(0);
		uploadUrlRef.current = null;
		pausedRef.current = false;
		cancelledRef.current = false;
		uploadOffsetRef.current = 0;
		fileInfoRef.current = null;
	}, []);

	// Simple retry helper
	const fetchWithRetry = useCallback(
		async (url: string, options: RequestInit): Promise<Response> => {
			const maxRetries = retryOptionsRef.current.maxRetries;
			let lastError: any;

			for (let attempt = 0; attempt <= maxRetries; attempt++) {
				// Check if upload was cancelled before each retry attempt
				if (cancelledRef.current) {
					break;
				}

				try {
					const response = await fetch(url, options);

					// If successful or non-retryable error, return
					if (response.ok || attempt === maxRetries) {
						return response;
					}

					// Check if status is retryable
					if (!retryOptionsRef.current.retryableStatuses.includes(response.status)) {
						return response;
					}

					lastError = new NetworkError(
						`HTTP error during retry: ${response.status}`,
						response.status,
						{ attempt, maxRetries }
					);
				} catch (error) {
					lastError = error;
					if (attempt === maxRetries) break;
				}

				// Wait before retry
				if (attempt < maxRetries) {
					const delay = Math.min(
						retryOptionsRef.current.initialDelay * Math.pow(2, attempt),
						retryOptionsRef.current.maxDelay,
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					setRetryCount(attempt + 1);
				}
			}

			throw lastError;
		},
		[],
	);

	// Pause upload
	const pause = useCallback(() => {
		pausedRef.current = true;
	}, []);

	// Cancel upload
	const cancel = useCallback(() => {
		cancelledRef.current = true;
		setLoading(false);
	}, []);

	// Helper function to get MIME type from base64 data URL
	const getMimeTypeFromDataUrl = (base64String: string): string => {
		if (base64String.startsWith("data:")) {
			const mimeMatch = base64String.match(/data:([^;]+)/);
			return mimeMatch ? (mimeMatch[1] as string) : "application/octet-stream";
		}
		return "application/octet-stream";
	};

	// Helper function to strip data URL prefix
	const stripDataUrlPrefix = (base64String: string): string => {
		return base64String.includes(",")
			? (base64String.split(",")[1] as string)
			: base64String;
	};

	// Continue upload from current offset
	const continueUpload = useCallback(async () => {
		if (!uploadUrlRef.current || !fileInfoRef.current) {
			return;
		}

		try {
			if (cancelledRef.current) {
				resetState();
				return;
			}

			if (pausedRef.current) {
				return;
			}

			const { fileUri, base64Data, fileSize, isBase64 } = fileInfoRef.current;
			const chunkSize = chunkSizeRef.current;
			const offset = uploadOffsetRef.current;

			if (offset >= fileSize) {
				// Upload is complete, fetch the file info
				await finalizeUpload();
				return;
			}

			const endOffset = Math.min(offset + chunkSize, fileSize);
			const chunkLength = endOffset - offset;

			let chunk: string;

			if (isBase64 && base64Data) {
				// For base64 data, we can directly slice the string
				// Note: This assumes the entire file is under chunk size
				// For larger base64 files, you'd need more complex chunking logic
				chunk = base64Data;
			} else if (fileUri) {
				// Read chunk from file (existing logic)
				chunk = await FileSystem.readAsStringAsync(fileUri, {
					encoding: FileSystem.EncodingType.Base64,
					position: offset,
					length: chunkLength,
				});
			} else {
				throw new Error("No file URI or base64 data available");
			}

			// Convert base64 to binary for upload
			const binaryString = Base64.atob(chunk);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Upload chunk with retry logic
			const uploadReq = await fetchWithRetry(uploadUrlRef.current, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/offset+octet-stream",
					"Upload-Offset": offset.toString(),
					...headerRef.current,
				},
				body: bytes,
			});

			lastResponseHeadersRef.current = uploadReq.headers;

			if (!uploadReq.ok) {
				const errorData = await uploadReq.text();
				throw new NetworkError(
					`HTTP error during chunk upload: ${errorData}`,
					uploadReq.status,
					{
						error: errorData,
						code: "HTTP_ERROR",
						metadata: {
							requestUrl: uploadReq.url,
						},
					},
				);
			}

			// Update offset and progress
			const newOffset = offset + chunkLength;
			uploadOffsetRef.current = newOffset;
			const newProgress = Math.min((newOffset / fileSize) * 100, 99.9);
			setProgress(newProgress);

			// For base64 uploads under chunk size, we're done after one iteration
			if (isBase64 && newOffset >= fileSize) {
				await finalizeUpload();
			} else {
				// Continue with next chunk for file uploads
				continueUpload();
			}
		} catch (err) {
			if (err instanceof Error) {
				setError(err);
			} else {
				setError(new Error("Unknown error during upload"));
			}
			setLoading(false);
		}
	}, [resetState, fetchWithRetry]);

	// Resume upload
	const resume = useCallback(() => {
		if (pausedRef.current && uploadUrlRef.current && fileInfoRef.current) {
			pausedRef.current = false;
			continueUpload();
		}
	}, [continueUpload]);

	// Finalize the upload and fetch file info
	const finalizeUpload = useCallback(async () => {
		if (!uploadUrlRef.current || !fileInfoRef.current) {
			return;
		}
		try {
			let cid: string | null = "";

			// Try to get the CID from the headers of the last response
			if (lastResponseHeadersRef.current) {
				const uploadCid = lastResponseHeadersRef.current.get("upload-cid");
				if (uploadCid) {
					cid = uploadCid;
				} else {
					cid = null;
				}
			}

			setUploadResponse(cid);
			setProgress(100);
			setLoading(false);
		} catch (err) {
			if (err instanceof Error) {
				setError(err);
			} else {
				setError(new Error("Unknown error during upload finalization"));
			}
			setLoading(false);
		}
	}, []);

	// Main upload function for file URIs (existing functionality)
	const upload = useCallback(
		async (
			fileUri: string,
			network: "public" | "private",
			url: string,
			options?: ExtendedUploadOptions,
		) => {
			try {
				resetState();
				setLoading(true);

				// Store references for pause/resume functionality
				optionsRef.current = options || null;
				networkRef.current = network;

				if (options?.chunkSize && options.chunkSize > 0) {
					chunkSizeRef.current = options.chunkSize;
				} else {
					chunkSizeRef.current = BASE_CHUNK_SIZE;
				}

				// Set retry options
				if (options?.retryOptions) {
					retryOptionsRef.current = {
						...DEFAULT_RETRY_OPTIONS,
						...options.retryOptions,
					};
				} else {
					retryOptionsRef.current = DEFAULT_RETRY_OPTIONS;
				}

				// Get file info from Expo FileSystem
				const fileInfo = await FileSystem.getInfoAsync(fileUri);
				if (!fileInfo.exists) {
					throw new ValidationError(`File does not exist at path: ${fileUri}`);
				}

				// Basic MIME type mapping
				const mimeTypes: Record<string, string> = {
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					png: "image/png",
					gif: "image/gif",
					pdf: "application/pdf",
					json: "application/json",
					txt: "text/plain",
					mp4: "video/mp4",
					mov: "video/mov",
					mp3: "audio/mpeg",
				};

				// Determine file type from URI extension
				const extension = (fileUri.split(".").pop()?.toLowerCase() ||
					"") as string;

				let fileType = "application/octet-stream";

				if (extension && extension in mimeTypes) {
					fileType = mimeTypes[extension] as string;
				}

				// Get filename from URI
				const fileName =
					options?.name || fileUri.split("/").pop() || "File from SDK";

				fileInfoRef.current = {
					fileUri,
					fileSize: fileInfo.size,
					fileType,
					fileName,
					isBase64: false,
				};

				await initializeAndStartUpload(network, url, options);
			} catch (err) {
				if (err instanceof Error) {
					setError(err);
				} else {
					setError(new Error("Unknown error during upload initialization"));
				}
				setLoading(false);
			}
		},
		[resetState],
	);

	// New upload function for base64 strings
	const uploadBase64 = useCallback(
		async (
			base64String: string,
			network: "public" | "private",
			url: string,
			options?: ExtendedUploadOptions,
		) => {
			try {
				resetState();
				setLoading(true);

				// Store references
				optionsRef.current = options || null;
				networkRef.current = network;

				// For base64, we typically don't need chunking, but respect the option
				if (options?.chunkSize && options.chunkSize > 0) {
					chunkSizeRef.current = options.chunkSize;
				} else {
					chunkSizeRef.current = BASE_CHUNK_SIZE;
				}

				// Set retry options
				if (options?.retryOptions) {
					retryOptionsRef.current = {
						...DEFAULT_RETRY_OPTIONS,
						...options.retryOptions,
					};
				} else {
					retryOptionsRef.current = DEFAULT_RETRY_OPTIONS;
				}

				// Clean base64 string and get metadata
				const cleanBase64 = stripDataUrlPrefix(base64String);
				const fileType =
					options?.fileType || getMimeTypeFromDataUrl(base64String);
				const fileName = options?.fileName || options?.name || "base64-file";

				// Calculate file size from base64 string
				// Base64 encoding increases size by ~33%, so we need to account for padding
				const padding = (cleanBase64.match(/=/g) || []).length;
				const fileSize = (cleanBase64.length * 3) / 4 - padding;

				// Check if file is under chunk size
				if (fileSize > chunkSizeRef.current) {
					throw new ValidationError(
						`Base64 file size (${fileSize} bytes) exceeds chunk size. Use regular upload for larger files.`,
					);
				}

				fileInfoRef.current = {
					base64Data: cleanBase64,
					fileSize,
					fileType,
					fileName,
					isBase64: true,
				};

				await initializeAndStartUpload(network, url, options);
			} catch (err) {
				if (err instanceof Error) {
					setError(err);
				} else {
					setError(
						new Error("Unknown error during base64 upload initialization"),
					);
				}
				setLoading(false);
			}
		},
		[resetState],
	);

	// Shared initialization logic
	const initializeAndStartUpload = useCallback(
		async (
			network: "public" | "private",
			url: string,
			options?: ExtendedUploadOptions,
		) => {
			if (!fileInfoRef.current) {
				throw new Error("No file info available");
			}

			const { fileSize, fileType, fileName } = fileInfoRef.current;

			// Set headers
			let headers: Record<string, string>;
			if (
				options?.customHeaders &&
				Object.keys(options?.customHeaders).length > 0
			) {
				headers = {
					...options.customHeaders,
				};
			} else {
				headers = {
					Source: "sdk/expo",
				};
			}

			headerRef.current = headers;

			// Prepare metadata for TUS upload
			let metadata = `filename ${Base64.btoa(fileName)},filetype ${Base64.btoa(fileType)},network ${Base64.btoa(network)}`;

			if (options?.groupId) {
				metadata += `,group_id ${Base64.btoa(options.groupId)}`;
			}

			if (options?.keyvalues) {
				metadata += `,keyvalues ${Base64.btoa(JSON.stringify(options.keyvalues))}`;
			}

			// Initialize upload with TUS (with retry logic)
			const urlReq = await fetchWithRetry(url, {
				method: "POST",
				headers: {
					"Upload-Length": `${fileSize}`,
					"Upload-Metadata": metadata,
					...headers,
				},
			});

			if (!urlReq.ok) {
				const errorData = await urlReq.text();
				if (urlReq.status === 401 || urlReq.status === 403) {
					throw new AuthenticationError(
						`Authentication failed: ${errorData}`,
						urlReq.status,
						{
							error: errorData,
							code: "AUTH_ERROR",
						},
					);
				}
				throw new NetworkError("Error initializing upload", urlReq.status, {
					error: errorData,
					code: "HTTP_ERROR",
				});
			}

			const uploadUrl = urlReq.headers.get("Location");
			if (!uploadUrl) {
				throw new NetworkError("Upload URL not provided", urlReq.status, {
					error: "No location header found",
					code: "HTTP_ERROR",
				});
			}

			uploadUrlRef.current = uploadUrl;

			// Start the upload process
			continueUpload();
		},
		[continueUpload, fetchWithRetry],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			cancelledRef.current = true;
		};
	}, []);

	return {
		progress,
		loading,
		error,
		uploadResponse,
		retryCount,
		upload,
		uploadBase64,
		pause,
		resume,
		cancel,
		resetState,
	};
};
