// (Optional) Configure Jest to skip Angular's legacy compilation step (ngcc) and use our spec tsconfig:
globalThis.ngJest = {
  skipNgcc: true,
  tsconfig: 'tsconfig.spec.json',
};

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular', // Use Angular preset (built on ts-jest):contentReference[oaicite:3]{index=3}
  testEnvironment: 'jsdom', // Simulate browser environment for DOM (JSDOM)
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'], // Setup file to initialize Angular testing env:contentReference[oaicite:4]{index=4}
  moduleDirectories: ['node_modules', 'src'], // Allow imports from 'src' root
  transformIgnorePatterns: [
    '/node_modules/(?!.*\\.mjs$)', // Transform ESM modules (Angular packages) in node_modules:contentReference[oaicite:5]{index=5}:contentReference[oaicite:6]{index=6}
    '/node_modules/(?!flat/)', // Example: allow transforming specific lib (e.g. 'flat') if used:contentReference[oaicite:7]{index=7}:contentReference[oaicite:8]{index=8}
  ],
  // Optional: map module paths for convenience or assets
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1', // Resolve imports starting with "src/":contentReference[oaicite:9]{index=9}
    '^app/(.*)$': '<rootDir>/src/app/$1', // Resolve Angular app imports
    '^environments/(.*)$': '<rootDir>/src/environments/$1', // Resolve environment files
    '\\.(css|scss|sass|less)$': 'identity-obj-proxy', // Mock style imports (if any)
  },
  // Ignore test files in build output or node_modules
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
};
