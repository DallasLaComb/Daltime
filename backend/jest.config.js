module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'auth/**/*.js',
    'employees/**/*.js',
    'managers/**/*.js',
    'scheduled/**/*.js',
    '!**/node_modules/**',
    '!**/package.json',
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  modulePathIgnorePatterns: ['<rootDir>/.*/package.json'],
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/layers/$1',
  },
};
