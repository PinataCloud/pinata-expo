import '@testing-library/jest-dom';
import 'whatwg-fetch'; // Polyfill for fetch

// Mock global fetch
global.fetch = jest.fn();

// Mock Response constructor
global.Response = Response;
global.Headers = Headers;

// Mock setTimeout for controlling timing in tests
jest.useFakeTimers();

// Mock expo-file-system globally
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));

// Mock Base64 globally
jest.mock('Base64', () => ({
  __esModule: true,
  default: {
    btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
  },
}));

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});