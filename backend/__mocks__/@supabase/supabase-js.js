const mockSupabaseClient = {
  auth: {
    admin: {
      createUser: jest.fn(),
    },
    getUser: jest.fn(),
    signInWithPassword: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

// Export the mock client so tests can access it
const createClient = jest.fn(() => mockSupabaseClient);
createClient.mockClient = mockSupabaseClient;

module.exports = {
  createClient,
};
