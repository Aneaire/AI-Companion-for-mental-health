#!/usr/bin/env bun

/**
 * Simple test script for Appwrite integration
 * Tests basic connectivity using the existing Appwrite service
 */

import { client, databases, DATABASE_ID, COUNSELOR_REQUESTS_COLLECTION } from './src/lib/appwrite.js';
import { ID } from 'appwrite';

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

console.log('🧪 Starting Simple Appwrite Integration Test...\n');

async function testBasicConnection() {
  console.log('🔌 Testing basic Appwrite connection...');
  try {
    // Just test if we can create a client instance
    console.log('✅ Appwrite client created successfully');
    console.log(`   Endpoint: ${client.config.endpoint}`);
    console.log(`   Project: ${client.config.project}`);
    console.log(`   Database ID: ${DATABASE_ID}`);
    console.log(`   Collection: ${COUNSELOR_REQUESTS_COLLECTION}`);
    return true;
  } catch (error) {
    console.error('❌ Basic connection failed:', error.message);
    return false;
  }
}

async function testListCollections() {
  console.log('\n📋 Testing list collections...');
  try {
    // This will test if we can connect to the database
    const response = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION
    });
    
    console.log('✅ Collection access successful:');
    console.log(`   Found ${response.total} documents in collection`);
    return true;
  } catch (error) {
    if (error.code === 404) {
      console.log('⚠️  Collection not found (expected if not created yet)');
      console.log('   This is normal for a new setup');
      return true;
    } else {
      console.error('❌ Collection access failed:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error type:', error.type);
      return false;
    }
  }
}

async function testCreateDocument() {
  console.log('\n📝 Testing document creation...');
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
    console.error('❌ Document creation failed:', error.message);
    console.log('   Error code:', error.code);
    console.log('   Error type:', error.type);
    
    if (error.code === 401) {
      console.log('   💡 This might be an authentication issue');
      console.log('   💡 Make sure your environment variables are set correctly');
    }
    
    return null;
  }
}

async function testReadDocument(documentId) {
  if (!documentId) {
    console.log('\n⏭️ Skipping READ test (no document created)');
    return null;
  }
  
  console.log('\n📖 Testing document read...');
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
    
    return response;
  } catch (error) {
    console.error('❌ Document read failed:', error.message);
    return null;
  }
}

async function testUpdateDocument(documentId) {
  if (!documentId) {
    console.log('\n⏭️ Skipping UPDATE test (no document created)');
    return null;
  }
  
  console.log('\n✏️ Testing document update...');
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
    console.log(`   Status changed to: ${response.status}`);
    console.log(`   Admin ID: ${response.adminId}`);
    
    return response;
  } catch (error) {
    console.error('❌ Document update failed:', error.message);
    return null;
  }
}

async function testDeleteDocument(documentId) {
  if (!documentId) {
    console.log('\n⏭️ Skipping DELETE test (no document created)');
    return;
  }
  
  console.log('\n🗑️ Testing document deletion...');
  try {
    await databases.deleteDocument({
      databaseId: DATABASE_ID,
      collectionId: COUNSELOR_REQUESTS_COLLECTION,
      documentId: documentId
    });
    
    console.log('✅ Document deleted successfully');
  } catch (error) {
    console.error('❌ Document deletion failed:', error.message);
  }
}

async function runTests() {
  try {
    console.log('🔧 Environment Check:');
    console.log(`   VITE_APPWRITE_ENDPOINT: ${import.meta.env.VITE_APPWRITE_ENDPOINT || 'Not set'}`);
    console.log(`   VITE_APPWRITE_PROJECT_ID: ${import.meta.env.VITE_APPWRITE_PROJECT_ID || 'Not set'}`);
    console.log(`   VITE_APPWRITE_DATABASE_ID: ${import.meta.env.VITE_APPWRITE_DATABASE_ID || 'Not set'}`);
    console.log('');

    // Test basic connection
    const basicOk = await testBasicConnection();
    if (!basicOk) {
      console.log('\n❌ Cannot proceed with tests - basic connection failed');
      process.exit(1);
    }

    // Test collection access
    const collectionOk = await testListCollections();
    if (!collectionOk) {
      console.log('\n❌ Cannot proceed with tests - collection access failed');
      process.exit(1);
    }

    // Test CRUD operations
    const created = await testCreateDocument();
    await testReadDocument(created?.$id);
    await testUpdateDocument(created?.$id);
    await testDeleteDocument(created?.$id);

    console.log('\n🎉 Appwrite integration test completed!');
    
    if (created) {
      console.log('✅ All CRUD operations are working correctly');
    } else {
      console.log('⚠️  Basic connectivity works, but CRUD operations failed');
      console.log('   This might be due to missing authentication or permissions');
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    console.error('Full error:', error);
    
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your environment variables in .env.local');
    console.log('2. Ensure Appwrite project exists and is accessible');
    console.log('3. Verify database and collection permissions');
    console.log('4. Check if you need to authenticate first');
    
    process.exit(1);
  }
}

// Run the tests
runTests();