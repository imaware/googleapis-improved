const base = require('./jest.config.js');
module.exports = {
  ...base,
  setupFiles: ['<rootDir>/src/__tests__/env/integration.ts'],
  testMatch: ['**/?(*.)+(spec).ts'],
  testTimeout: 20000,
};
