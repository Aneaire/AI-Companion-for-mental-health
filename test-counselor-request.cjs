#!/usr/bin/env node

/**
 * Test script to verify counselor request creation with userContext field
 * This tests the fix for the userContext type mismatch issue
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

// Database connection using the same method as the server
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// Import schema (we'll need to define the table structure here)
const counselorRequests = {
  id: 'id',
  userId: 'user_id',
  requestReason: 'request_reason',
  urgencyLevel: 'urgency_level',
  userContext: 'user_context',
  status: 'status',
  createdAt: 'created_at'
};

async function testCounselorRequest() {
  console.log('🧪 Testing counselor request creation with userContext...\n');

  try {
    // Test data with userContext as a JSON object
    const testRequest = {
      user_id: 1, // Assuming user ID 1 exists
      request_reason: 'Test request for userContext field verification',
      urgency_level: 'medium',
      user_context: {
        currentEmotions: ['anxious', 'overwhelmed'],
        sessionType: 'stress_management',
        preferredApproach: 'mindfulness',
        previousSessions: 2,
        currentMedications: ['none'],
        triggers: ['work_pressure', 'deadlines'],
        copingStrategies: ['deep_breathing', 'exercise'],
        additionalNotes: 'User has been experiencing increased stress at work'
      }
    };

    console.log('📝 Creating counselor request with userContext:');
    console.log(JSON.stringify(testRequest, null, 2));
    console.log('');

    // Insert the test request using raw SQL
    const insertQuery = `
      INSERT INTO counselor_requests (user_id, request_reason, urgency_level, user_context)
      VALUES ($1, $2, $3, $4)
      RETURNING id, status, created_at, user_context
    `;
    
    const result = await client.unsafe(insertQuery, [
      testRequest.user_id,
      testRequest.request_reason,
      testRequest.urgency_level,
      JSON.stringify(testRequest.user_context)
    ]);

    if (!result || result.length === 0) {
      console.error('❌ Error creating counselor request: No result returned');
      return false;
    }

    const data = result[0];
    console.log('✅ Counselor request created successfully!');
    console.log('Request ID:', data.id);
    console.log('Status:', data.status);
    console.log('Created at:', data.created_at);
    console.log('');

    // Verify the userContext was stored correctly
    console.log('🔍 Verifying userContext data...');
    
    const verifyQuery = `
      SELECT user_context FROM counselor_requests WHERE id = $1
    `;
    
    const verifyResult = await client.unsafe(verifyQuery, [data.id]);

    if (!verifyResult || verifyResult.length === 0) {
      console.error('❌ Error verifying userContext: No result returned');
      return false;
    }

    const verifyData = verifyResult[0];
    console.log('✅ userContext retrieved successfully:');
    console.log(JSON.stringify(verifyData.user_context, null, 2));
    console.log('');

    // Verify the data integrity
    const originalContext = testRequest.user_context;
    const storedContext = verifyData.user_context;

    let dataIntegrityCheck = true;
    for (const [key, value] of Object.entries(originalContext)) {
      if (JSON.stringify(storedContext[key]) !== JSON.stringify(value)) {
        console.error(`❌ Data mismatch for key "${key}":`);
        console.error('  Original:', value);
        console.error('  Stored:', storedContext[key]);
        dataIntegrityCheck = false;
      }
    }

    if (dataIntegrityCheck) {
      console.log('✅ All userContext data stored correctly!');
    } else {
      console.log('❌ Some userContext data was corrupted during storage.');
      return false;
    }

    // Test with different data types in userContext
    console.log('\n🔄 Testing with different data types...');
    
    const complexTestRequest = {
      user_id: 1,
      request_reason: 'Complex userContext test',
      urgency_level: 'high',
      user_context: {
        stringField: 'test string',
        numberField: 42,
        booleanField: true,
        arrayField: ['item1', 'item2', 'item3'],
        nestedObject: {
          level1: {
            level2: 'deep value'
          }
        },
        nullField: null,
        dateField: new Date().toISOString()
      }
    };

    const complexInsertQuery = `
      INSERT INTO counselor_requests (user_id, request_reason, urgency_level, user_context)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_context
    `;

    const complexResult = await client.unsafe(complexInsertQuery, [
      complexTestRequest.user_id,
      complexTestRequest.request_reason,
      complexTestRequest.urgency_level,
      JSON.stringify(complexTestRequest.user_context)
    ]);

    if (!complexResult || complexResult.length === 0) {
      console.error('❌ Error creating complex test request: No result returned');
      return false;
    }

    const complexData = complexResult[0];
    console.log('✅ Complex userContext test passed!');
    console.log('Stored complex data:', JSON.stringify(complexData.user_context, null, 2));

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    
    await client.unsafe('DELETE FROM counselor_requests WHERE id IN ($1, $2)', [data.id, complexData.id]);

    console.log('✅ Test data cleaned up successfully!');
    console.log('\n🎉 All tests passed! The userContext field is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Unexpected error during test:', error);
    return false;
  }
}

// Run the test
testCounselorRequest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });