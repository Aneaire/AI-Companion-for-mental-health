// Test the demo-chat endpoint directly
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './server/db/schema.js';

// Database connection
const connectionString = process.env.DATABASE_URL || "postgresql://postgres.anihhhqfauctpckwcbfg:WVZedWvtL5eOlwIV@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function testDemoChat() {
  try {
    console.log('Testing demo-chat endpoint...');
    
    // Create a test user
    const [user] = await db.insert(schema.users).values({
      clerkId: 'demo-test-user',
      email: 'demo@test.com',
      nickname: 'DemoUser',
      firstName: 'Demo',
      lastName: 'User',
      age: 30,
    }).returning();
    
    console.log('Created user:', user.id);
    
    // Create a test thread
    const [thread] = await db.insert(schema.threads).values({
      userId: user.id,
      reasonForVisit: 'Demo test conversation',
      supportType: ['emotional'],
    }).returning();
    
    console.log('Created thread:', thread.id);
    
    // Create a test session
    const [session] = await db.insert(schema.sessions).values({
      threadId: thread.id,
      sessionNumber: 1,
      sessionName: 'Demo Session',
      status: 'active',
    }).returning();
    
    console.log('Created session:', session.id);
    
    // Test the demo-chat endpoint
    const response = await fetch('http://localhost:4000/api/demo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "I feel anxious about work",
        sessionId: session.id,
        userId: user.id,
        threadType: "main",
        conversationPreferences: {},
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log('Error response:', errorData);
      return;
    }
    
    // Test streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      console.log('No streaming reader available');
      return;
    }
    
    const decoder = new TextDecoder();
    let fullResponse = "";
    let buffer = "";
    let messageCount = 0;
    
    console.log('Starting streaming response...');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value);
      let lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const content = line.substring("data: ".length);
          if (content.trim() && !isNaN(Number(content.trim()))) {
            console.log('Session ID received:', content.trim());
          } else if (content.trim()) {
            fullResponse += content + "\n";
            messageCount++;
            console.log(`Received chunk ${messageCount}:`, content.substring(0, 100) + '...');
          }
        }
      }
    }
    
    console.log('Full response length:', fullResponse.length);
    console.log('Response preview:', fullResponse.substring(0, 200) + '...');
    
    console.log('✅ Demo-chat endpoint test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    await client.end();
  }
}

testDemoChat();