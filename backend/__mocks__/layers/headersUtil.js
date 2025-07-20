const mockResponse = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
  body: JSON.stringify(data),
});

const responses = {
  success: jest.fn((data, message = 'Success') =>
    mockResponse(200, { success: true, message, data })
  ),
  created: jest.fn((data, message = 'Created successfully') =>
    mockResponse(201, { success: true, message, data })
  ),
  badRequest: jest.fn((error) => mockResponse(400, { success: false, error })),
  unauthorized: jest.fn((error = 'Unauthorized') =>
    mockResponse(401, { success: false, error })
  ),
  forbidden: jest.fn((error = 'Forbidden') =>
    mockResponse(403, { success: false, error })
  ),
  notFound: jest.fn((error = 'Not found') =>
    mockResponse(404, { success: false, error })
  ),
  serverError: jest.fn((error = 'Internal server error') =>
    mockResponse(500, { success: false, error })
  ),
};

module.exports = {
  responses,
};
