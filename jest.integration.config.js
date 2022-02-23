const base = require('./jest.config.js');
module.exports = {
  ...base,
  testMatch: ['**/?(*.)+(spec).ts'],
  testTimeout: 20000,
};
