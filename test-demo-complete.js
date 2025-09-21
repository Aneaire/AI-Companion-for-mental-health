// Test complete demo flow including session creation
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { sessions, users } from './server/db/schema.js';
import { demoChatHandler } from './server/routes/demo-chat.js';

// Create in-memory database for testing
const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

// Create test user and session
async function createTestSession() {
  try {
    // Insert test user
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
      clerkId: 'test-clerk-id',
    }).returning();
    
    // Insert test session
    const [session] = await db.insert(sessions).values({
      userId: user.id,
      status: 'active',
      threadId: 'test-thread-id',
    }).returning();
    
    console.log('Created test session:', session.id);
    return session.id;
  } catch (error) {
    console.error('Error creating test session:', error);
    throw error;
  }
}

// Test demo-chat endpoint
async function testDemoChat() {
  console.log('Testing complete demo flow...');
  
  try {
    // Create test session
    const sessionId = await createTestSession();
    console.log('Session ID:', sessionId);
    
    // Test demo-chat endpoint
    const response = await fetch('http://localhost:4000/api/demo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "I feel anxious about work",
        sessionId: sessionId,
      }),
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Demo-chat endpoint test passed!');
    } else {
      console.log('❌ Demo-chat endpoint test failed:', data.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDemoChat();