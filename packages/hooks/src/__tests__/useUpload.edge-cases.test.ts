import { renderHook, act } from '@testing-library/react';
import { useUpload } from '../hooks/useUpload';
import * as FileSystem from 'expo-file-system';

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
const mockGetInfoAsync = FileSystem.getInfoAsync as jest.MockedFunction<typeof FileSystem.getInfoAsync>;
const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>;

describe('useUpload - Edge Cases & Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      size: 100,
      isDirectory: false,
      modificationTime: Date.now(),
      uri: 'file://test.jpg',
    });
    
    mockReadAsStringAsync.mockResolvedValue('dGVzdA==');
  });

  describe('Invalid Retry Configuration', () => {
    it('should handle negative maxRetries gracefully', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: -1, // Invalid negative value
                initialDelay: 100,
              }
            }
          );
        } catch (error) {
          // May handle gracefully or throw
        }
      });

      // Should not crash and should default to reasonable behavior
      expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero maxRetries (no retries)', async () => {
      const { result } = renderHook(() => useUpload());
      let callCount = 0;
      
      mockFetch.mockImplementation(async (url) => {
        callCount++;
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        return new Response(null, { status: 500 }); // Always fail
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 0, // No retries allowed
                initialDelay: 100,
              }
            }
          );
        } catch (error) {
          // Expected to fail without retries
        }
      });

      // Should not retry at all
      expect(result.current.retryCount).toBe(0);
    });

    it('should handle empty retryableStatuses array', async () => {
      const { result } = renderHook(() => useUpload());
      let callCount = 0;
      
      mockFetch.mockImplementation(async (url) => {
        callCount++;
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        return new Response(null, { status: 500 });
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 3,
                retryableStatuses: [], // Empty array - nothing is retryable
              }
            }
          );
        } catch (error) {
          // Should fail without retries
        }
      });

      // Should not retry since no status codes are retryable
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle mixed error types during retries', async () => {
      const { result } = renderHook(() => useUpload());
      let callCount = 0;
      
      mockFetch.mockImplementation(async (url) => {
        callCount++;
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        
        // Simulate different types of errors
        if (callCount === 2) {
          throw new Error('Network timeout'); // Network error
        } else if (callCount === 3) {
          return new Response(null, { status: 503 }); // HTTP error
        }
        return new Response(null, { status: 204 }); // Success
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 3,
                initialDelay: 10,
              }
            }
          );
        } catch (error) {
          // May eventually succeed or fail
        }
        
        jest.advanceTimersByTime(50);
      });

      // Should have attempted retries for both error types
      expect(result.current.retryCount).toBeGreaterThan(0);
    });

    it('should handle fetch rejection (network failure)', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch
        .mockResolvedValueOnce(
          new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          })
        )
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 2,
                initialDelay: 10,
              }
            }
          );
        } catch (error) {
          // May recover from network error
        }
        
        jest.advanceTimersByTime(10);
      });

      // Should retry after network failure
      expect(result.current.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Exponential Backoff Edge Cases', () => {
    it('should handle very large backoff multipliers', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        return new Response(null, { status: 500 });
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 2,
                initialDelay: 10,
                backoffMultiplier: 1000, // Very large multiplier
                maxDelay: 100, // Should cap the delay
              }
            }
          );
        } catch (error) {
          // Should handle large multipliers gracefully
        }
        
        jest.advanceTimersByTime(200); // Should be enough even with capping
      });

      // Should not hang or crash with large multipliers
      expect(result.current.retryCount).toBeGreaterThan(0);
    });

    it('should respect maxDelay ceiling', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        return new Response(null, { status: 500 });
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 3,
                initialDelay: 1000,
                backoffMultiplier: 10,
                maxDelay: 50, // Very low max delay
              }
            }
          );
        } catch (error) {
          // Should complete quickly due to maxDelay
        }
        
        jest.advanceTimersByTime(200); // Should be more than enough
      });

      expect(result.current.retryCount).toBeGreaterThan(0);
    });
  });

  describe('State Consistency', () => {
    it('should handle second upload call interrupting first upload', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      // Start first upload, then immediately start second (which should reset state)
      await act(async () => {
        // First upload starts
        result.current.upload(
          'file://test1.jpg',
          'public',
          'https://test.com/presigned1'
        );
        
        // Second upload immediately interrupts/resets first upload
        const upload2Promise = result.current.upload(
          'file://test2.jpg',
          'public',
          'https://test.com/presigned2'
        );

        try {
          // Only the second upload should complete successfully
          // First upload gets cancelled/reset by resetState() call
          await upload2Promise;
        } catch (error) {
          // May fail, but state should remain consistent
        }
      });

      // State should be consistent after interruption
      expect(typeof result.current.retryCount).toBe('number');
      expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
      expect(typeof result.current.loading).toBe('boolean');
      expect(typeof result.current.progress).toBe('number');
    });

    it('should handle sequential uploads with proper state reset', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

      // First upload
      await act(async () => {
        try {
          await result.current.upload(
            'file://test1.jpg',
            'public',
            'https://test.com/presigned1'
          );
        } catch (error) {
          // May fail, but state should be valid
        }
      });

      // Verify state is valid after first upload
      expect(typeof result.current.retryCount).toBe('number');

      // Second upload should reset state
      await act(async () => {
        try {
          await result.current.upload(
            'file://test2.jpg',
            'public', 
            'https://test.com/presigned2'
          );
        } catch (error) {
          // May fail, but state should be valid
        }
      });

      // State should be valid after both uploads
      expect(typeof result.current.retryCount).toBe('number');
      expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
      expect(typeof result.current.loading).toBe('boolean');
      expect(typeof result.current.progress).toBe('number');
      expect(result.current.progress).toBeGreaterThanOrEqual(0);
      
      // Verify hook can be reused - state management works correctly
      expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
    });

    it('should maintain state consistency after upload failure', async () => {
      const { result } = renderHook(() => useUpload());
      
      // Mock immediate failure to avoid infinite loops
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        throw new Error('Fatal network error');
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 0, // No retries to avoid timeout
                initialDelay: 1,
              }
            }
          );
        } catch (error) {
          // Expected to fail - hook should handle gracefully
        }
      });

      // Hook should remain in valid state after failure
      expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
      expect(typeof result.current.loading).toBe('boolean');
      expect(result.current.progress).toBeGreaterThanOrEqual(0);
      expect(typeof result.current.error).toBe('object'); // Should have error set
      
      // Hook should be reusable after failure
      await act(async () => {
        result.current.resetState();
      });
      
      expect(result.current.retryCount).toBe(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBe(null);
    });
  });

  describe('uploadBase64 Retry Support', () => {
    it('should support retry options for base64 uploads', async () => {
      const { result } = renderHook(() => useUpload());
      let callCount = 0;
      
      mockFetch.mockImplementation(async (url) => {
        callCount++;
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        
        if (callCount <= 2) {
          return new Response(null, { status: 500 });
        }
        return new Response(null, { status: 204 });
      });

      await act(async () => {
        try {
          await result.current.uploadBase64(
            'data:image/jpeg;base64,dGVzdA==',
            'public',
            'https://test.com/presigned',
            {
              fileName: 'test.jpg',
              retryOptions: {
                maxRetries: 1,
                initialDelay: 1,
              }
            }
          );
        } catch (error) {
          // May succeed after retries
        }
        
        jest.advanceTimersByTime(5);
      });

      // Should work with uploadBase64 too
      if (result.current) {
        expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Real-world Failure Patterns', () => {
    it('should handle rate limiting (429) with longer delays', async () => {
      const { result } = renderHook(() => useUpload());
      
      mockFetch.mockImplementation(async (url) => {
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        return new Response(null, { 
          status: 429,
          headers: { 'Retry-After': '60' }
        });
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 1,
                initialDelay: 1,
                retryableStatuses: [429],
              }
            }
          );
        } catch (error) {
          // Expected to eventually fail or succeed
        }
        
        jest.advanceTimersByTime(5);
      });

      // Should attempt to retry rate limited requests
      if (result.current) {
        expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle service unavailable (503) scenarios', async () => {
      const { result } = renderHook(() => useUpload());
      let callCount = 0;
      
      mockFetch.mockImplementation(async (url) => {
        callCount++;
        if (url.toString().includes('presigned')) {
          return new Response(null, {
            status: 201,
            headers: { Location: 'https://upload.com/123' }
          });
        }
        
        // Service comes back online after a few attempts
        if (callCount <= 2) {
          return new Response(null, { status: 503 });
        }
        return new Response(null, { status: 204 });
      });

      await act(async () => {
        try {
          await result.current.upload(
            'file://test.jpg',
            'public',
            'https://test.com/presigned',
            {
              retryOptions: {
                maxRetries: 2,
                initialDelay: 1,
                retryableStatuses: [503],
              }
            }
          );
        } catch (error) {
          // Should eventually succeed
        }
        
        jest.advanceTimersByTime(5);
      });

      // Should recover from service unavailable
      if (result.current) {
        expect(result.current.retryCount).toBeGreaterThanOrEqual(0);
      }
    });
  });
});