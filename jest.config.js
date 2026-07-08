export default {
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',
  setupFilesAfterEnv: ['./tests/jest.setup.js'],
  testTimeout: 20000
};
