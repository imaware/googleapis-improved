module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
