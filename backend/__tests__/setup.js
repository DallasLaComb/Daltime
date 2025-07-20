// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE = 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_DB_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Global test utilities
global.mockEvent = (body = {}, headers = {}) => ({
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  httpMethod: 'POST',
});

global.mockAuthEvent = (body = {}, token = 'valid-jwt-token') => ({
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  httpMethod: 'POST',
});
