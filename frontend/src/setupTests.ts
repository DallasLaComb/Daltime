import '@testing-library/jest-dom';
import 'dotenv/config';

// Conditionally require util polyfills to avoid type conflicts
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder } = require('util');
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  const { TextDecoder } = require('util');
  global.TextDecoder = TextDecoder as any; // Suppress type errors
}

// Set env variable fallback for non-Vite test environments
process.env.VITE_API_BASE_URL ||= 'http://localhost:3000';

// Mock import.meta.env for Jest
Object.defineProperty(globalThis, 'import.meta', {
  value: {
    env: {
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL,
    },
  },
});
