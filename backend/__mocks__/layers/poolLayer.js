const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(() => Promise.resolve(mockClient)),
  end: jest.fn(),
  on: jest.fn(),
};

// Export the mockClient so tests can access it
mockPool.mockClient = mockClient;

module.exports = {
  pool: mockPool,
  mockClient,
};
