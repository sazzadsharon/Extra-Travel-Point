module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { target: 'ES2022', module: 'commonjs', strict: true, esModuleInterop: true, skipLibCheck: true } }]
  }
};
