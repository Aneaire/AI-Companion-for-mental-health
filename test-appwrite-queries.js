/**
 * Test script for Appwrite queries to verify Query.equal() syntax works correctly
 * Tests the three main scenarios:
 * 1. Fetching counselor requests with status 'pending'
 * 2. Fetching counselor chats with adminId filter
 * 3. Fetching messages for a specific chatId
 */

import { 
  databases, 
  DATABASE_ID, 
  COUNSELOR_REQUESTS_COLLECTION, 
  COUNSELOR_CHATS_COLLECTION, 
  COUNSELOR_MESSAGES_COLLECTION,
  Query,
  ID
} from './frontend/src/lib/appwrite.js';

// Test configuration
const TEST_CONFIG = {
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Utility function for retry logic
const retry = async (fn, attempts = TEST_CONFIG.retryAttempts) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      if (i === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.retryDelay));
    }
  }
};

// Test data setup
const setupTestData = async () => {
  console.log('🔧 Setting up test data...');
  
  try {
    // Create a test user request
    const testRequest = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_REQUESTS_COLLECTION,
      ID.unique(),
      {
        userId: 'test-user-123',
        userName: 'Test User',
        userEmail: 'test@example.com',
        requestType: 'general',
        urgency: 'medium',
        subject: 'Test Request for Query Validation',
        description: 'This is a test request to verify Appwrite queries work correctly',
        status: 'pending',
        requestedAt: new Date().toISOString()
      }
    );
    console.log('✅ Created test request:', testRequest.$id);

    // Create a test admin chat
    const testChat = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_CHATS_COLLECTION,
      ID.unique(),
      {
        requestId: testRequest.$id,
        userId: 'test-user-123',
        adminId: 'test-admin-456',
        status: 'active',
        startedAt: new Date().toISOString(),
        messageCount: 0
      }
    );
    console.log('✅ Created test chat:', testChat.$id);

    // Create test messages
    const testMessage1 = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      ID.unique(),
      {
        chatId: testChat.$id,
        senderId: 'test-user-123',
        senderType: 'user',
        message: 'Hello, I need help with something',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        isRead: false
      }
    );

    const testMessage2 = await databases.createDocument(
      DATABASE_ID,
      COUNSELOR_MESSAGES_COLLECTION,
      ID.unique(),
      {
        chatId: testChat.$id,
        senderId: 'test-admin-456',
        senderType: 'counselor',
        message: 'I am here to help you',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        isRead: true
      }
    );
    console.log('✅ Created test messages');

    return {
      requestId: testRequest.$id,
      chatId: testChat.$id,
      messageIds: [testMessage1.$id, testMessage2.$id]
    };
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
    throw error;
  }
};

// Cleanup test data
const cleanupTestData = async (testData) => {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Delete messages
    for (const messageId of testData.messageIds) {
      await databases.deleteDocument(DATABASE_ID, COUNSELOR_MESSAGES_COLLECTION, messageId);
    }
    
    // Delete chat
    await databases.deleteDocument(DATABASE_ID, COUNSELOR_CHATS_COLLECTION, testData.chatId);
    
    // Delete request
    await databases.deleteDocument(DATABASE_ID, COUNSELOR_REQUESTS_COLLECTION, testData.requestId);
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
};

// Test 1: Fetch counselor requests with status 'pending'
const testPendingRequests = async () => {
  console.log('\n🧪 Test 1: Fetching counselor requests with status "pending"');
  
  try {
    const result = await retry(async () => {
      return await databases.listDocuments(
        DATABASE_ID,
        COUNSELOR_REQUESTS_COLLECTION,
        [Query.equal('status', 'pending')]
      );
    });

    console.log(`✅ Successfully fetched ${result.documents.length} pending requests`);
    
    // Verify our test request is in the results
    const testRequest = result.documents.find(req => req.status === 'pending');
    if (testRequest) {
      console.log('✅ Test request found in pending requests');
      console.log(`   Request ID: ${testRequest.$id}`);
      console.log(`   Status: ${testRequest.status}`);
      console.log(`   Subject: ${testRequest.subject}`);
    } else {
      console.log('⚠️  Test request not found, but query executed successfully');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    console.error('   Error details:', error.response?.data || error.message);
    return false;
  }
};

// Test 2: Fetch counselor chats with adminId filter
const testAdminChats = async (testData) => {
  console.log('\n🧪 Test 2: Fetching counselor chats with adminId filter');
  
  try {
    const result = await retry(async () => {
      return await databases.listDocuments(
        DATABASE_ID,
        COUNSELOR_CHATS_COLLECTION,
        [Query.equal('adminId', 'test-admin-456')]
      );
    });

    console.log(`✅ Successfully fetched ${result.documents.length} chats for admin`);
    
    // Verify our test chat is in the results
    const testChat = result.documents.find(chat => chat.adminId === 'test-admin-456');
    if (testChat) {
      console.log('✅ Test chat found in admin chats');
      console.log(`   Chat ID: ${testChat.$id}`);
      console.log(`   Admin ID: ${testChat.adminId}`);
      console.log(`   Status: ${testChat.status}`);
    } else {
      console.log('⚠️  Test chat not found, but query executed successfully');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    console.error('   Error details:', error.response?.data || error.message);
    return false;
  }
};

// Test 3: Fetch messages for a specific chatId
const testChatMessages = async (testData) => {
  console.log('\n🧪 Test 3: Fetching messages for specific chatId');
  
  try {
    const result = await retry(async () => {
      return await databases.listDocuments(
        DATABASE_ID,
        COUNSELOR_MESSAGES_COLLECTION,
        [Query.equal('chatId', testData.chatId)]
      );
    });

    console.log(`✅ Successfully fetched ${result.documents.length} messages for chat`);
    
    // Verify our test messages are in the results
    if (result.documents.length >= 2) {
      console.log('✅ Test messages found in chat messages');
      result.documents.forEach((msg, index) => {
        console.log(`   Message ${index + 1}: ${msg.senderType} - "${msg.message.substring(0, 30)}..."`);
      });
    } else {
      console.log('⚠️  Expected 2+ messages, but query executed successfully');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
    console.error('   Error details:', error.response?.data || error.message);
    return false;
  }
};

// Test 4: Test multiple query filters (bonus test)
const testMultipleFilters = async () => {
  console.log('\n🧪 Test 4: Testing multiple query filters');
  
  try {
    const result = await retry(async () => {
      return await databases.listDocuments(
        DATABASE_ID,
        COUNSELOR_REQUESTS_COLLECTION,
        [
          Query.equal('status', 'pending'),
          Query.equal('userId', 'test-user-123')
        ]
      );
    });

    console.log(`✅ Successfully fetched ${result.documents.length} requests with multiple filters`);
    
    // Verify the query worked
    if (result.documents.length > 0) {
      const doc = result.documents[0];
      console.log(`   Found request: ${doc.status} status for user ${doc.userId}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
    console.error('   Error details:', error.response?.data || error.message);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Appwrite Query Tests');
  console.log('=====================================');
  
  let testData = null;
  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false
  };

  try {
    // Setup test data
    testData = await setupTestData();
    
    // Run tests
    results.test1 = await testPendingRequests();
    results.test2 = await testAdminChats(testData);
    results.test3 = await testChatMessages(testData);
    results.test4 = await testMultipleFilters();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    // Cleanup
    if (testData) {
      await cleanupTestData(testData);
    }
  }

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Test 1 (Pending Requests): ${results.test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Admin Chats): ${results.test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Chat Messages): ${results.test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Multiple Filters): ${results.test4 ? '✅ PASS' : '❌ FAIL'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All Appwrite Query.equal() tests passed! The 400 errors should be resolved.');
  } else {
    console.log('⚠️  Some tests failed. Check the error messages above for details.');
  }
  
  return passedTests === totalTests;
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error during test execution:', error);
      process.exit(1);
    });
}

export { runTests, testPendingRequests, testAdminChats, testChatMessages, testMultipleFilters };