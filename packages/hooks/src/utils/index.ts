export const getFileIdFromUrl = (url: string): string => {
	// Look for a UUID pattern in the URL
	const uuidPattern =
		/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/i;
	const match = url.match(uuidPattern);

	if (match?.[1]) {
		return match[1];
	}

	// Fallback to the old method if no UUID is found
	const parts = url.split("/");
	const lastPart = parts[parts.length - 1] as string;
	return lastPart.split(".")[0] as string;
};
