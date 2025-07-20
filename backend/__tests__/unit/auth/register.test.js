// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('/opt/nodejs/poolLayer', () =>
  require('../../../__mocks__/layers/poolLayer')
);
jest.mock('/opt/nodejs/headersUtil', () =>
  require('../../../__mocks__/layers/headersUtil')
);

// Import modules after mocks are set up
const { createClient } = require('@supabase/supabase-js');
const { pool, mockClient } = require('/opt/nodejs/poolLayer');
const { responses } = require('/opt/nodejs/headersUtil');
const { handler } = require('../../../auth/register/handler');

describe('Register Handler', () => {
  // Access the mocked client from the createClient function
  const mockSupabaseClient = createClient.mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock implementations
    pool.connect.mockResolvedValue(mockClient);
    responses.created.mockReturnValue({ statusCode: 201 });
    responses.badRequest.mockReturnValue({ statusCode: 400 });
    responses.serverError.mockReturnValue({ statusCode: 500 });
  });

  describe('simple test', () => {
    it('should pass', () => {
      expect(true).toBe(true);
    });
  });

  describe('successful registration', () => {
    it('should register a new user successfully', async () => {
      const event = {
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '1234567890',
          role: 'employee',
          companyId: 1,
        }),
      };

      const mockAuthData = {
        user: { id: 'auth-user-id-123' },
      };

      const mockAppUser = {
        userid: 'auth-user-id-123',
        companyid: 1,
        firstname: 'John',
        lastname: 'Doe',
        phonenumber: 1234567890,
        email: 'test@example.com',
        role: 'employee',
      };

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: mockAuthData,
        error: null,
      });

      mockClient.query.mockResolvedValue({
        rows: [mockAppUser],
      });

      await handler(event);

      expect(mockSupabaseClient.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        email_confirm: true,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.appuser'),
        [
          'auth-user-id-123',
          1,
          'John',
          'Doe',
          1234567890,
          'test@example.com',
          'employee',
        ]
      );

      expect(responses.created).toHaveBeenCalledWith(
        mockAppUser,
        'User registered successfully'
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('authentication errors', () => {
    it('should handle Supabase auth errors', async () => {
      const event = {
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '1234567890',
          role: 'employee',
          companyId: 1,
        }),
      };

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'Email already exists' },
      });

      await handler(event);

      expect(responses.badRequest).toHaveBeenCalledWith('Email already exists');
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe('database errors', () => {
    it('should handle database connection errors', async () => {
      const event = {
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '1234567890',
          role: 'employee',
          companyId: 1,
        }),
      };

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-user-id-123' } },
        error: null,
      });

      pool.connect.mockRejectedValue(new Error('Database connection failed'));

      await handler(event);

      expect(responses.serverError).toHaveBeenCalledWith(
        'Database connection failed'
      );
    });

    it('should release client on database query error', async () => {
      const event = {
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '1234567890',
          role: 'employee',
          companyId: 1,
        }),
      };

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-user-id-123' } },
        error: null,
      });

      mockClient.query.mockRejectedValue(new Error('Query failed'));

      await handler(event);

      expect(mockClient.release).toHaveBeenCalled();
      expect(responses.serverError).toHaveBeenCalledWith('Query failed');
    });
  });

  describe('input validation', () => {
    it('should handle empty request body', async () => {
      const event = { body: null };

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-user-id-123' } },
        error: null,
      });

      mockClient.query.mockRejectedValue(new Error('Query failed'));

      await handler(event);

      expect(responses.serverError).toHaveBeenCalledWith('Query failed');
    });

    it('should handle malformed JSON', async () => {
      const event = { body: 'invalid json' };

      await handler(event);

      expect(responses.serverError).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected token')
      );
    });
  });
});
