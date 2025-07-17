export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)', '**/*.(test|spec).(ts|tsx|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**/*',
  ],
  preset: 'ts-jest',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'node',
      },
    },
  },
  moduleNameMapper: {
    '^expo-file-system$': '<rootDir>/src/__tests__/mocks/expo-file-system.ts',
    '^Base64$': '<rootDir>/src/__tests__/mocks/Base64.ts',
  },
};