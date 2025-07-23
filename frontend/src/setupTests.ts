import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Set up environment variables for tests
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:3000';

// Mock import.meta.env for Jest
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:3000',
      },
    },
  },
});

// Set up TextEncoder/TextDecoder for tests
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
import { TextEncoder, TextDecoder } from 'util';
import 'dotenv/config';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Correct mock for import.meta.env
Object.defineProperty(globalThis, 'import.meta', {
  value: {
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000', // Match actual usage
    },
  },
});
