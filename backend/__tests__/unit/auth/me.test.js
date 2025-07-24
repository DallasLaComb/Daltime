const { createClient } = require('@supabase/supabase-js');

jest.mock('/opt/nodejs/headersUtil', () => ({
  responses: {
    success: jest.fn((data, message) => ({
      statusCode: 200,
      body: JSON.stringify({ success: true, message, data }),
    })),
    unauthorized: jest.fn((message) => ({
      statusCode: 401,
      body: JSON.stringify({ success: false, error: message }),
    })),
    badRequest: jest.fn((message) => ({
      statusCode: 400,
      body: JSON.stringify({ success: false, error: message }),
    })),
    serverError: jest.fn((message) => ({
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    })),
  },
}));

const { handler } = require('../../../auth/me/handler');

let mockGetUser;
let mockFrom;
let mockSelect;
let mockEq;
let mockSingle;

beforeEach(() => {
  jest.clearAllMocks();

  // Get references to the mock functions from the existing mock
  const mockClient = createClient.mockClient;
  mockGetUser = mockClient.auth.getUser;
  mockFrom = mockClient.from;

  // Set up the chain of mocks for the from() method
  mockSingle = jest.fn();
  mockEq = jest.fn(() => ({ single: mockSingle }));
  mockSelect = jest.fn(() => ({ eq: mockEq }));

  mockFrom.mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
  });
});

describe('GET /auth/me', () => {
  const baseEvent = {
    headers: {
      authorization: 'Bearer valid-token',
    },
  };

  it('returns 401 if no auth header is present', async () => {
    const event = { headers: {} };
    const res = await handler(event);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/authorization token/i);
  });

  it('returns 401 if getUser fails due to missing user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/invalid or expired token/i);
  });

  it('returns 401 if getUser returns an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('some error'),
    });

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/invalid or expired token/i);
  });

  it('returns 500 if role query fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: new Error('query failed'),
    });

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/failed to retrieve user role/i);
  });

  it('returns 200 and user info if token and role are valid', async () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      email_confirmed_at: '2025-07-23T00:00:00Z',
      created_at: '2025-07-23T00:00:00Z',
      updated_at: '2025-07-23T01:00:00Z',
      user_metadata: { name: 'Test' },
    };

    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSingle.mockResolvedValue({
      data: { role: 'Manager' },
      error: null,
    });

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.id).toBe(mockUser.id);
    expect(body.data.user.role).toBe('Manager');
  });
});
