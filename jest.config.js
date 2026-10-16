module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.js',
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  testTimeout: 60000,
};
