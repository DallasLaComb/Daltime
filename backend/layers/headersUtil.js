// Standard headers for API responses
const getStandardHeaders = () => {
  const corsOrigin = process.env.CORS_ORIGIN || '*';

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
};

// Helper function to create consistent API responses
const createResponse = (statusCode, body, additionalHeaders = {}) => {
  return {
    statusCode,
    headers: {
      ...getStandardHeaders(),
      ...additionalHeaders,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
};

// Pre-configured response helpers
const responses = {
  success: (data, message = 'Success') =>
    createResponse(200, { success: true, message, data }),
  created: (data, message = 'Created successfully') =>
    createResponse(201, { success: true, message, data }),
  badRequest: (error) => createResponse(400, { success: false, error }),
  unauthorized: (error = 'Unauthorized') =>
    createResponse(401, { success: false, error }),
  forbidden: (error = 'Forbidden') =>
    createResponse(403, { success: false, error }),
  notFound: (error = 'Not found') =>
    createResponse(404, { success: false, error }),
  serverError: (error = 'Internal server error') =>
    createResponse(500, { success: false, error }),
};

module.exports = {
  getStandardHeaders,
  createResponse,
  responses,
};
