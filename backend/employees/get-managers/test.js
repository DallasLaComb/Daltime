const handler = require('./handler');

// Mock event for testing GET /employees/managers
const mockGetManagersEvent = {
  httpMethod: 'GET',
  headers: {
    authorization: 'Bearer mock-token-here',
  },
  queryStringParameters: null,
  body: null,
};

// Mock event for testing POST /employees/managers/connect
const mockConnectToManagerEvent = {
  httpMethod: 'POST',
  headers: {
    authorization: 'Bearer mock-token-here',
    'content-type': 'application/json',
  },
  queryStringParameters: null,
  body: JSON.stringify({
    managerId: '366995d2-1160-45cf-8a07-178983018f7a', // Sample manager ID from CSV
  }),
};

async function testGetManagers() {
  console.log('Testing GET /employees/managers...');
  try {
    const response = await handler.handler(mockGetManagersEvent);
    console.log('Status Code:', response.statusCode);
    console.log('Response Body:', JSON.parse(response.body));
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testConnectToManager() {
  console.log('\nTesting POST /employees/managers/connect...');
  try {
    const response = await handler.handler(mockConnectToManagerEvent);
    console.log('Status Code:', response.statusCode);
    console.log('Response Body:', JSON.parse(response.body));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log(
    'Note: These tests require valid authentication tokens and database connection'
  );
  console.log(
    'Update the Bearer token in the mock events with a real token to test\n'
  );

  // Uncomment to run actual tests:
  // testGetManagers();
  // testConnectToManager();
}

module.exports = {
  testGetManagers,
  testConnectToManager,
};
