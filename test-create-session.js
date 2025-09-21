// Test script to create a valid session and test demo-chat
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { db } from './server/db/config.js';
import { users, threads, sessions } from './server/db/schema.js';

async function createTestSession() {
  try {
    console.log('Creating test session...');
    
    // Insert test user
    const [user] = await db.insert(users).values({
      clerkId: 'test-clerk-id',
      email: 'test@example.com',
      nickname: 'TestUser',
      firstName: 'Test',
      lastName: 'User',
      age: 25,
    }).returning();
    
    console.log('Created user:', user.id);
    
    // Insert test thread
    const [thread] = await db.insert(threads).values({
      userId: user.id,
      reasonForVisit: 'Test session',
      supportType: ['emotional'],
    }).returning();
    
    console.log('Created thread:', thread.id);
    
    // Insert test session
    const [session] = await db.insert(sessions).values({
      threadId: thread.id,
      sessionNumber: 1,
      sessionName: 'Test Demo Session',
      status: 'active',
    }).returning();
    
    console.log('Created session:', session.id);
    return session.id;
    
  } catch (error) {
    console.error('Error creating test session:', error);
    throw error;
  }
}

async function testDemoChat() {
  try {
    const sessionId = await createTestSession();
    console.log('Testing demo-chat with session ID:', sessionId);
    
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
      console.log('✅ Demo-chat test passed!');
    } else {
      console.log('❌ Demo-chat test failed:', data.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDemoChat();