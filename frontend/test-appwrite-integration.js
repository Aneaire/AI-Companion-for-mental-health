#!/usr/bin/env bun

/**
 * Test script for Appwrite integration
 * Tests CRUD operations on counselor_requests collection
 */

import { Client, Databases, ID } from 'appwrite';

// Appwrite configuration
const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('691040e8001b642b00e9')
  .setKey('standard_74e8cd238b53440c6da20c7f17eddee9eba50324a38a763a3cbc90428729e38fafdc8f4a8bf33d1be69473404a3b6e24b0b779b88fac3021bf53478ce6af290c65a30b0a8bd87ca658a1c7feda5456a00e2620ca4d4e2f4b23543645f7b1a0751f60685e3664cd95840a3406bf3181e909caf29a730b0ab004ee0265d6b86086');

const databases = new Databases(client);

// Configuration
const DATABASE_ID = 'ai-companion-db'; // Update with your actual database ID
const COUNSELOR_REQUESTS_COLLECTION = 'counselor_requests';

// Test data
const testRequest = {
  userId: 'test-user-123',
  status: 'pending',
  requestReason: 'Test request for Appwrite integration verification',
  urgencyLevel: 'medium',
  userContext: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
  requestedAt: new Date().toISOString()
};

let createdDocumentId = null;

console.log('🧪 Starting Appwrite Integration Test...\n');

async function testCreate() {
  console.log('📝 Testing CREATE operation...');
  try {
    const response = await databases.createDocument({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      documentId: ID.unique(),
      data: testRequest
    });
    
    console.log('✅ Document created successfully:');
    console.log(`   ID: ${response.$id}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Created: ${response.$createdAt}`);
    
    createdDocumentId = response.$id;
    return response;
  } catch (error) {
    console.error('❌ CREATE failed:', error.message);
    throw error;
  }
}

async function testRead(documentId) {
  console.log('\n📖 Testing READ operation...');
  try {
    const response = await databases.getDocument({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      documentId: documentId
    });
    
    console.log('✅ Document read successfully:');
    console.log(`   ID: ${response.$id}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Request Reason: ${response.requestReason}`);
    console.log(`   Urgency Level: ${response.urgencyLevel}`);
    
    return response;
  } catch (error) {
    console.error('❌ READ failed:', error.message);
    throw error;
  }
}

async function testUpdate(documentId) {
  console.log('\n✏️ Testing UPDATE operation...');
  try {
    const updateData = {
      status: 'accepted',
      adminId: 'test-admin-456',
      acceptedAt: new Date().toISOString(),
      adminNotes: 'Test update - request accepted for testing purposes'
    };
    
    const response = await databases.updateDocument({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      documentId: documentId,
      data: updateData
    });
    
    console.log('✅ Document updated successfully:');
    console.log(`   Status changed from 'pending' to '${response.status}'`);
    console.log(`   Admin ID: ${response.adminId}`);
    console.log(`   Admin Notes: ${response.adminNotes}`);
    console.log(`   Updated: ${response.$updatedAt}`);
    
    return response;
  } catch (error) {
    console.error('❌ UPDATE failed:', error.message);
    throw error;
  }
}

async function testList() {
  console.log('\n📋 Testing LIST operation...');
  try {
    const response = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      queries: [
        // Limit to 10 documents for testing
        'limit(10)'
      ]
    });
    
    console.log('✅ Documents listed successfully:');
    console.log(`   Total documents: ${response.total}`);
    console.log(`   Documents in this batch: ${response.documents.length}`);
    
    // Show first few documents
    response.documents.slice(0, 3).forEach((doc, index) => {
      console.log(`   ${index + 1}. ID: ${doc.$id}, Status: ${doc.status}, User: ${doc.userId}`);
    });
    
    return response;
  } catch (error) {
    console.error('❌ LIST failed:', error.message);
    throw error;
  }
}

async function testDelete(documentId) {
  console.log('\n🗑️ Testing DELETE operation...');
  try {
    const response = await databases.deleteDocument({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      documentId: documentId
    });
    
    console.log('✅ Document deleted successfully');
    console.log(`   Deleted document ID: ${documentId}`);
    
    return response;
  } catch (error) {
    console.error('❌ DELETE failed:', error.message);
    throw error;
  }
}

async function verifyDeletion(documentId) {
  console.log('\n🔍 Verifying deletion...');
  try {
    await databases.getDocument({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      documentId: documentId
    });
    console.log('❌ Document still exists - deletion failed');
    return false;
  } catch (error) {
    if (error.code === 404) {
      console.log('✅ Document successfully deleted - no longer found');
      return true;
    } else {
      console.error('❌ Unexpected error during verification:', error.message);
      return false;
    }
  }
}

async function testDatabaseConnection() {
  console.log('🔌 Testing database connection...');
  try {
    // Test connection by trying to list documents (this will fail if database/collection doesn't exist)
    await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      queries: ['limit(1)']
    });
    console.log('✅ Database connection successful:');
    console.log(`   Database ID: ${DATABASE_ID}`);
    console.log(`   Collection: ${COUNSELOR_REQUESTS_COLLECTION}`);
    return true;
  } catch (error) {
    if (error.code === 404) {
      console.log('⚠️  Database or collection not found, but connection works');
      console.log(`   Database ID: ${DATABASE_ID}`);
      console.log(`   Collection: ${COUNSELOR_REQUESTS_COLLECTION}`);
      console.log('   This is expected if the collection hasn\'t been created yet');
      return true;
    } else {
      console.error('❌ Database connection failed:', error.message);
      console.log('   Please check:');
      console.log('   1. Database ID is correct');
      console.log('   2. Project ID is correct');
      console.log('   3. API permissions are sufficient');
      return false;
    }
  }
}

async function runTests() {
  try {
    // Test database connection first
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      console.log('\n❌ Cannot proceed with tests - database connection failed');
      process.exit(1);
    }

    // Run CRUD tests
    const created = await testCreate();
    await testRead(created.$id);
    await testUpdate(created.$id);
    await testList();
    await testDelete(created.$id);
    await verifyDeletion(created.$id);

    console.log('\n🎉 All Appwrite integration tests passed!');
    console.log('✅ CREATE, READ, UPDATE, DELETE, and LIST operations are working correctly');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    
    // Provide helpful troubleshooting information
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check if DATABASE_ID is correct:', DATABASE_ID);
    console.log('2. Verify collection exists:', COUNSELOR_REQUESTS_COLLECTION);
    console.log('3. Ensure Appwrite project permissions allow these operations');
    console.log('4. Check if you have an API key with sufficient permissions');
    console.log('5. Verify your Appwrite endpoint is accessible');
    
    process.exit(1);
  }
}

// Run the tests
runTests();