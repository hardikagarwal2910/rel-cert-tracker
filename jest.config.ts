import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Relax strict checks for test environment
        strict: false,
        esModuleInterop: true,
      },
    }],
    // Transform ESM packages that Jest can't handle natively
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        strict: false,
        esModuleInterop: true,
        allowJs: true,
      },
    }],
  },
  // Transform ESM-only packages that Jest can't handle natively
  transformIgnorePatterns: [
    '/node_modules/(?!(jose|next-auth|@auth|@panva|oidc-token-hash|openid-client|uuid)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock next/headers which doesn't work in Node test env
    '^next/headers$': '<rootDir>/src/__tests__/__mocks__/next-headers.ts',
    // Mock next/navigation
    '^next/navigation$': '<rootDir>/src/__tests__/__mocks__/next-navigation.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
      branches: 60,
    },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/__tests__/',
    '/.next/',
  ],
};

export default config;
