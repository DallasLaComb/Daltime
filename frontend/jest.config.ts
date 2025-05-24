import type { Config } from 'jest';
import { createEsmPreset } from 'jest-preset-angular/presets';

export default {
  ...createEsmPreset(),
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  moduleNameMapper: {
    tslib: 'tslib/tslib.es6.js',
    '^rxjs$': '<rootDir>/node_modules/rxjs/dist/bundles/rxjs.umd.js',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^app/(.*)$': '<rootDir>/src/app/$1',
    '^environments/(.*)$': '<rootDir>/src/environments/$1',
    '\\.(css|scss|sass|less)$': 'identity-obj-proxy',
  },
  transformIgnorePatterns: ['node_modules/(?!(@angular|rxjs|tslib)/)'],
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
} satisfies Config;
