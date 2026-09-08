module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true, skipLibCheck: true } }]
  }
};
