import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';

// Test the improved instructions with a simulated conversation
async function testImprovedInstructions() {
  console.log('🧪 Testing Improved Conversation Instructions...\n');

  try {
    // 1. Create a test persona (similar to the conversation log)
    console.log('1. Creating test persona (depression theme)...');
    const personaResponse = await fetch(`${BASE_URL}/api/persona-library/from-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: 2, // Major Depressive Episode template
        customizations: {
          fullName: "Gel",
          age: 23,
          problemDescription: "Persistent sadness and loss of interest in activities that used to bring joy",
          background: "Gel used to be an avid painter and hiker, but hasn't touched their art supplies in months. They find themselves staring at screens for hours and surviving on delivery food. They recently cancelled plans with friends because they 'couldn't be bothered'.",
          personality: "Introverted, pessimistic, empathetic, laid-back"
        }
      })
    });

    if (!personaResponse.ok) {
      const errorText = await personaResponse.text();
      throw new Error(`Failed to create persona: ${personaResponse.status} - ${errorText}`);
    }

    const persona = await personaResponse.json();
    console.log(`✅ Created persona: ${persona.fullName} (ID: ${persona.id})`);

    // 2. Create a test thread
    console.log('\n2. Creating test thread...');
    const threadResponse = await fetch(`${BASE_URL}/api/impostor/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 17,
        personaId: persona.id,
        reasonForVisit: "Feeling persistently down and tired, lost interest in activities",
        preferredName: "Gel"
      })
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      throw new Error(`Failed to create thread: ${threadResponse.status} - ${errorText}`);
    }

    const thread = await threadResponse.json();
    console.log(`✅ Created thread: ${thread.preferredName || thread.sessionName} (ID: ${thread.id})`);

    // 3. Test with the problematic message pattern from the log
    console.log('\n3. Testing improved response to repetitive "drained/stuck" pattern...');

    const testMessages = [
      // Simulate the repetitive pattern from the log
      "Hello Gel, thanks for coming in. It sounds like you're going through a really difficult time, and it takes courage to reach out.",
      "It sounds like you're carrying a heavy load right now, and it's understandable to feel unsure about where to begin.",
      "I hear you, Gel. That image of wading through mud really paints a picture of how stuck and heavy things must feel right now. It sounds incredibly draining not knowing the source of it all.",
      "It sounds incredibly draining to feel so stuck, Gel, and I hear how exhausting it is to even consider making a change when you're already feeling so depleted."
    ];

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`\n📝 Test ${i + 1}: Sending therapist message with banned phrases...`);
      console.log(`Message: "${message.substring(0, 80)}..."`);

      const chatResponse = await fetch(`${BASE_URL}/api/impersonate-chat/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          threadId: thread.id,
          userId: "17",
          sender: "user"
        })
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.log(`❌ Chat response failed: ${chatResponse.status} - ${errorText}`);
        continue;
      }

      const response = await chatResponse.text();
      console.log(`🤖 AI Response (${response.length} chars): ${response.substring(0, 120)}...`);

      // Check for banned phrases in the response
      const bannedPhrases = [
        "it sounds like", "that must feel", "heavy load", "draining", "exhausting",
        "overwhelming", "understandable", "takes courage", "incredibly draining"
      ];

      const foundBanned = bannedPhrases.filter(phrase =>
        response.toLowerCase().includes(phrase.toLowerCase())
      );

      if (foundBanned.length > 0) {
        console.log(`❌ STILL FOUND BANNED PHRASES: ${foundBanned.join(', ')}`);
      } else {
        console.log('✅ No banned phrases detected in response');
      }

      // Check for story-extraction focus
      const storyIndicators = ["tell me about", "what happened", "can you describe", "walk me through", "paint a picture"];
      const hasStoryFocus = storyIndicators.some(indicator =>
        response.toLowerCase().includes(indicator)
      );

      if (hasStoryFocus) {
        console.log('📖 Response focuses on extracting stories (GOOD)');
      } else {
        console.log('⚠️  Response does not focus on story extraction');
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎉 Improved instructions test completed!');
    console.log('📊 Analysis: Check if responses break the repetitive loop and extract specific stories');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testImprovedInstructions();