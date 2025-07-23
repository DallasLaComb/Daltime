import '@testing-library/jest-dom';
import 'dotenv/config';
import { TextEncoder, TextDecoder } from 'util';

// Set up TextEncoder/TextDecoder for tests if they're undefined
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Mock import.meta.env for Jest
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_BASE_URL: 'http://localhost:3000',
      },
    },
  },
});
