// Test script for demo-chat endpoint
const testDemoChat = async () => {
  try {
    console.log('Testing demo-chat endpoint...');
    
    const response = await fetch('http://localhost:4000/api/demo-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Hi, I need to talk about something that's been bothering me lately.",
        sessionId: 1,
        userId: "1",
        threadType: "main",
        conversationPreferences: {},
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      console.log('Received chunk:', chunk);
      fullResponse += chunk;
    }

    console.log('Full response:', fullResponse);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

testDemoChat();