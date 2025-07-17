export const EncodingType = {
  Base64: 'base64',
  UTF8: 'utf8',
};

export const getInfoAsync = jest.fn().mockResolvedValue({
  exists: true,
  size: 1024 * 1024, // 1MB
  isDirectory: false,
});

export const readAsStringAsync = jest.fn().mockImplementation(
  (uri: string, options?: any) => {
    // Mock base64 content for tests
    return Promise.resolve('dGVzdCBkYXRh'); // "test data" in base64
  }
);