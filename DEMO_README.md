# Live Demo Feature

This document explains how to use the Live Demo feature that demonstrates the AI companion system in action.

## Overview

The Live Demo feature (`/demo`) provides an automated demonstration where:
- The AI acts as a user with various mental health problems
- The system simulates a complete conversation flow
- Sessions progress automatically when message limits are reached
- Forms are generated and can be completed by the AI
- Multi-session workflows are demonstrated

## Accessing the Demo

1. Navigate to the main application
2. Click the "Live Demo" button in the chat header
3. Or go directly to `/demo` in your browser

## Demo Controls

### Problem Selection
- Choose from 5 categories of mental health scenarios:
  - Anxiety
  - Depression  
  - Relationship Issues
  - Work Stress
  - Self-Esteem
- Each category contains multiple realistic problem scenarios

### Demo Speed Control
- Adjust the speed between messages (1000ms - 5000ms)
- Slower speeds allow better observation of AI responses
- Faster speeds provide quicker overview of the flow

### Playback Controls
- **Start Demo**: Begins the automated conversation
- **Pause**: Temporarily stops the demo
- **Resume**: Continues from where paused
- **Reset Demo**: Clears progress and allows starting over

## Demo Features

### Automated Conversation Flow
- 16 pre-written user messages that simulate a realistic therapy session
- Messages are sent automatically at the selected speed
- AI responds naturally to each message
- Progress bar shows current position in the conversation

### Session Management
- When messages reach 17+ in a session, the system automatically:
  1. Completes the current session
  2. Generates a follow-up form based on conversation history
  3. Creates a new session
  4. Continues the demo in the new session

### Form Generation & Completion
- Forms are automatically generated with relevant questions
- In demo mode, forms are auto-completed to continue the flow
- Form answers are used to personalize subsequent sessions

### Multi-Session Demonstration
- Shows how the system handles multiple sessions
- Demonstrates continuity between sessions
- Shows how form answers influence future conversations

## Demo Messages

The demo uses a realistic conversation progression about work-related anxiety:

1. Initial problem statement
2. Specific symptom descriptions  
3. Impact on daily life
4. Emotional responses
5. Coping attempts
6. Relationship effects
7. Fears and concerns
8. Help-seeking behavior
9. Treatment preferences
10. Progress acknowledgment

## Technical Implementation

### Key Components
- **Demo Control Panel** (left sidebar): Problem selection, speed control, playback controls
- **Chat Interface**: Standard chat interface with automated message sending
- **Session Management**: Automatic session progression and form handling
- **Progress Tracking**: Visual indicators of demo progress

### State Management
- Uses React state for demo controls
- Integrates with existing Zustand stores for chat/thread state
- Maintains separate demo state to avoid interference with normal operation

### API Integration
- Uses existing chat API for message sending
- Integrates with thread/session management APIs
- Handles form generation and completion automatically

## Best Practices for Demonstration

1. **Start with explanation**: Explain what the demo will show before starting
2. **Use moderate speed**: 2000-3000ms between messages works well for live demos
3. **Highlight key moments**: Point out session transitions and form generation
4. **Show multiple sessions**: Let the demo run through at least 2 sessions
5. **Explain AI behavior**: Discuss how the AI adapts based on conversation context

## Troubleshooting

### Demo Won't Start
- Ensure a problem scenario is selected
- Check that the backend server is running
- Verify user authentication

### Messages Not Sending
- Check network connectivity
- Verify backend API is responding
- Check browser console for errors

### Session Not Progressing
- Ensure sufficient messages have been sent (17+ required)
- Check that form generation is working
- Verify session management APIs are functioning

## Customization

### Adding New Problem Scenarios
Edit `DEMO_PROBLEMS` array in `/frontend/src/routes/demo.tsx`:

```typescript
const DEMO_PROBLEMS = [
  {
    category: "New Category",
    scenarios: [
      "New problem scenario 1",
      "New problem scenario 2"
    ]
  },
  // ... existing categories
];
```

### Modifying Demo Messages
Edit `DEMO_USER_MESSAGES` array to change the conversation flow.

### Adjusting Default Speed
Change the initial `demoSpeed` state value (default: 2000ms).

## Future Enhancements

Potential improvements for the demo feature:

1. **Multiple Demo Scenarios**: Different conversation flows for different problem types
2. **Interactive Mode**: Allow manual message sending during demo
3. **Analytics Dashboard**: Show conversation metrics and AI insights
4. **Export Feature**: Save demo conversations for training purposes
5. **Voice Mode**: Add text-to-speech for spoken demonstrations
6. **Language Support**: Multi-language demo scenarios