# Testing the Retry Functionality

This directory contains tests for the retry mechanism in the `useUpload` hook.

## Test Files

- **`useUpload.retry-focused.test.ts`** - Tests the retry mechanism configuration, state management, and behavior

## Running Tests

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test useUpload.retry.test.ts
```

## Test Coverage

The tests focus on verifying that the retry mechanism is properly configured and behaving as expected:

### ✅ Retry State Management
- Initializes with `retryCount` of 0
- Tracks retry attempts in the `retryCount` state
- Resets state properly between uploads

### ✅ Retry Configuration
- Accepts custom retry options (maxRetries, delays, status codes)
- Uses sensible defaults when no options provided
- Respects custom retryable status codes
- Only retries on configured status codes

### ✅ Cancellation Support
- Provides cancel functionality
- Stops processing when cancelled

### ✅ Integration Testing
- Tests work with the actual hook implementation
- Mock external dependencies (file system, fetch)
- Focus on behavior rather than implementation details

## Mock Setup

The tests use mocked versions of:
- `fetch` - Global fetch function for HTTP requests
- `expo-file-system` - File system operations
- `Base64` - Base64 encoding/decoding
- Timers - For controlling retry delays in tests

## Example Test Cases

```typescript
// Test retry on 500 status
it('should retry on HTTP 500 status code', async () => {
  // Mock failing then succeeding requests
  mockFetch
    .mockResolvedValueOnce(tusInitResponse)
    .mockResolvedValueOnce(failureResponse) 
    .mockResolvedValueOnce(successResponse);
    
  await upload(fileUri, 'public', url, { retryOptions: { maxRetries: 2 } });
  
  expect(mockFetch).toHaveBeenCalledTimes(3);
  expect(retryCount).toBe(1);
});
```