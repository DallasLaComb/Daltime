// Test file for employee get-schedule Lambda function
// Run this with: node test.js

const handler = require('./handler');

// Mock event for testing
const createTestEvent = (queryParams = {}) => ({
  httpMethod: 'GET',
  headers: {
    Authorization: 'Bearer YOUR_EMPLOYEE_JWT_TOKEN_HERE',
  },
  queryStringParameters: queryParams,
  body: null,
});

// Test cases
const testCases = [
  {
    name: 'Get all assigned shifts (default)',
    event: createTestEvent(),
  },
  {
    name: 'Get schedule for date range',
    event: createTestEvent({
      startDate: '2025-06-01',
      endDate: '2025-06-30',
    }),
  },
  {
    name: 'Get past and future assignments',
    event: createTestEvent({
      includePast: 'true',
      status: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
    }),
  },
  {
    name: 'Get only completed assignments',
    event: createTestEvent({
      status: 'completed',
      sortBy: 'assignedat',
      sortOrder: 'desc',
    }),
  },
  {
    name: 'Get upcoming week schedule',
    event: createTestEvent({
      startDate: '2025-06-16',
      endDate: '2025-06-23',
      sortBy: 'starttime',
    }),
  },
];

// Run tests
async function runTests() {
  console.log('\n🧪 Testing Employee Get Schedule Lambda Function\n');

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(
      'Query params:',
      testCase.event.queryStringParameters || 'None'
    );

    try {
      const result = await handler.handler(testCase.event);
      console.log('✅ Status:', result.statusCode);

      if (result.statusCode === 200) {
        const data = JSON.parse(result.body).data;
        console.log('📊 Summary:');
        console.log(`   - Total assignments: ${data.summary.totalAssignments}`);
        console.log(`   - Total hours: ${data.summary.totalHours}`);
        console.log(`   - Future hours: ${data.summary.futureHours}`);
        console.log(
          `   - Upcoming week assignments: ${data.summary.upcomingWeekAssignments}`
        );
        console.log(`   - Status breakdown:`, data.summary.assignmentsByStatus);

        if (data.schedule.length > 0) {
          console.log('📅 First assignment:', {
            date: data.schedule[0].date,
            time: `${data.schedule[0].formattedStartTime} - ${data.schedule[0].formattedEndTime}`,
            location: data.schedule[0].location,
            status: data.schedule[0].status,
            hours: data.schedule[0].durationHours,
          });
        }
      } else {
        const error = JSON.parse(result.body);
        console.log('❌ Error:', error.message);
      }
    } catch (error) {
      console.log('💥 Exception:', error.message);
    }

    console.log('---');
  }

  console.log('\n✅ Test completed!\n');
}

// Test invalid parameters
async function testValidation() {
  console.log('\n🔍 Testing Parameter Validation\n');

  const invalidTests = [
    {
      name: 'Invalid sort column',
      params: { sortBy: 'invalid_column' },
    },
    {
      name: 'Invalid sort order',
      params: { sortOrder: 'invalid_order' },
    },
    {
      name: 'Invalid status',
      params: { status: 'invalid_status' },
    },
  ];

  for (const test of invalidTests) {
    console.log(`\n📋 Test: ${test.name}`);
    try {
      const result = await handler.handler(createTestEvent(test.params));
      console.log('Status:', result.statusCode);
      if (result.statusCode !== 200) {
        const error = JSON.parse(result.body);
        console.log('✅ Validation working:', error.message);
      }
    } catch (error) {
      console.log('💥 Exception:', error.message);
    }
  }
}

// Run all tests
if (require.main === module) {
  runTests().then(() => testValidation());
}

module.exports = { createTestEvent };
