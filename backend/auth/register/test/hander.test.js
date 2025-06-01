// test/handler.test.js

// Set environment BEFORE importing the handler
process.env.SUPABASE_URL = 'https://fake.supabase.io';
process.env.SUPABASE_SERVICE_ROLE = 'fake-service-role';

const { handler } = require('../handler'); // import AFTER setting env
const axios = require('axios');
jest.mock('axios');


describe('Register Lambda Handler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.SUPABASE_URL = 'https://fake.supabase.io';
    process.env.SUPABASE_SERVICE_ROLE = 'fake-service-role';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should return 200 on OPTIONS request', async () => {
    const event = { httpMethod: 'OPTIONS' };
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('CORS preflight success');
  });

  it('should return 400 if required fields are missing', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ email: 'a@b.com' }) // missing other fields
    };
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
    expect(body.detail).toMatch(/Missing required fields/);
  });

  it('should return 400 if employee role but no managers', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        email: 'a@b.com',
        password: 'pass',
        firstName: 'A',
        lastName: 'B',
        role: 'employee',
        company: 'TestCorp',
        managers: [] // required for employee
      })
    };
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.detail).toMatch(/Employees must have at least one manager/);
  });

  it('should create user and profile successfully', async () => {
    const fakeUserId = 'user-123';
    const fakeUserData = { id: fakeUserId, email: 'a@b.com' };

    // Mock axios calls
    axios.post.mockImplementation((url) => {
      if (url.includes('/auth/v1/admin/users')) {
        return Promise.resolve({ data: fakeUserData });
      } else if (url.includes('/rest/v1/profiles')) {
        return Promise.resolve({ data: {} });
      }
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        email: 'a@b.com',
        password: 'pass',
        firstName: 'A',
        lastName: 'B',
        role: 'employee',
        company: 'TestCorp',
        managers: ['manager-1']
      })
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('User and profile created successfully');
    expect(body.user.id).toBe(fakeUserId);
  });

  it('should handle errors from Supabase', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 500,
        data: {
          msg: 'Internal Supabase error',
          detail: 'DB down'
        }
      }
    });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        email: 'a@b.com',
        password: 'pass',
        firstName: 'A',
        lastName: 'B',
        role: 'employee',
        company: 'TestCorp',
        managers: ['manager-1']
      })
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Internal Supabase error');
    expect(body.detail.detail).toBe('DB down');
  });
});
