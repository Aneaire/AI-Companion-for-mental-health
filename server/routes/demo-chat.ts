// demo-chat.ts - Demo-specific AI responses without requiring API key
import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { db } from "../db/config";
import {
  messages,
  sessionForms,
  sessions,
  threads,
} from "../db/schema";
import { logger } from "../lib/logger";

// Demo AI responses that simulate a realistic therapist
const DEMO_AI_RESPONSES = {
  "Hi, I need to talk about something that's been bothering me lately.": [
    "Hello, I'm glad you reached out. It takes courage to start a conversation like this. What's been on your mind lately?",
    "Thank you for sharing that with me. It's completely normal to have things that bother us. What would you like to talk about first?",
    "I'm here to listen. Whatever has been bothering you, we can explore it together at your own pace."
  ],
  "I've been feeling really anxious about my job situation.": [
    "It sounds like work has been causing you a lot of anxiety lately. Can you tell me more about what specifically about your job situation is making you feel anxious?",
    "Job-related anxiety can be really overwhelming. What aspects of your job situation are most concerning to you right now?",
    "I understand that work anxiety can affect many parts of our lives. What do you think is contributing most to these feelings?"
  ],
  "My boss has been putting a lot of pressure on me to meet impossible deadlines.": [
    "That sounds incredibly stressful. Being put under pressure with unrealistic deadlines can really take a toll on someone's well-being. How has this been affecting you emotionally?",
    "It's tough when expectations feel unrealistic. Have you had a chance to communicate with your boss about the pressure you're feeling?",
    "That kind of pressure can really impact both your work and personal life. What do you think would make the deadlines feel more manageable?"
  ],
  "I'm having trouble sleeping because I keep thinking about work all night.": [
    "It's really common for work stress to follow us into the night and affect our sleep. Have you noticed any patterns in when these work thoughts are most intrusive?",
    "Sleep is so important for our overall well-being. When work thoughts keep you awake, what typically happens? Do you find yourself ruminating on specific things?",
    "The connection between work stress and sleep issues is very real. Have you tried anything to help your mind wind down before bed?"
  ],
  "I've started having panic attacks during meetings and it's embarrassing.": [
    "Thank you for sharing something so personal. Panic attacks can feel really overwhelming, especially in public settings like meetings. You're not alone in experiencing this.",
    "It takes courage to talk about panic attacks. Many people experience them in high-pressure situations. What typically happens right before you feel a panic attack coming on during meetings?",
    "Panic attacks are nothing to be embarrassed about - they're your body's response to stress. Have you noticed any specific triggers during meetings that might contribute to this?"
  ],
  "I don't know how to handle this stress anymore.": [
    "It sounds like you're feeling really overwhelmed right now. When stress reaches this point, it can be hard to see clear solutions. What does 'handle this stress' look like to you?",
    "Feeling like you can't handle stress anymore is a sign that something needs to change. What have you tried so far to manage the stress, and what hasn't worked?",
    "It's completely normal to feel stuck when stress becomes too much. What would be the most helpful thing for us to focus on right now to help you feel more in control?"
  ],
  "I'm worried I might lose my job if I can't perform better.": [
    "That's a very real fear to be carrying. Job security is such an important concern. What makes you feel like your performance might be suffering right now?",
    "The pressure of potentially losing your job can make performance even more challenging. Have you received any specific feedback about your performance, or is this more of a general feeling?",
    "It's understandable to worry about job security. What aspects of your performance do you feel most concerned about, and what support do you think would help?"
  ],
  "Do you have any suggestions for managing this anxiety?": [
    "There are several strategies that can help with anxiety. Some people find that deep breathing exercises before meetings help calm their nervous system. Have you tried anything like that?",
    "Anxiety management often involves both immediate coping strategies and longer-term solutions. What's worked for you in the past when you've felt anxious?",
    "Different techniques work for different people. Some find mindfulness helpful, others prefer physical activity or talking things through. What sounds most appealing to you right now?"
  ],
  "I've tried deep breathing but it only helps temporarily.": [
    "It's common for breathing exercises to provide temporary relief. The key is often using them as part of a broader toolkit. What other strategies have you heard about or tried?",
    "Temporary relief is still relief! Sometimes we need to layer different techniques. Have you tried combining breathing with other approaches like progressive muscle relaxation or visualization?",
    "It makes sense that deep breathing alone might not be enough for intense anxiety. What do you think would complement the breathing exercises to make them more effective?"
  ],
  "I'm also worried about how this is affecting my family life.": [
    "It's really thoughtful of you to consider how this is affecting your family too. When work stress spills over into our personal lives, it can create a difficult cycle. How have your family members noticed the impact?",
    "The ripple effects of work stress on family relationships can be significant. What specific changes have you or your family members noticed in how you're interacting at home?",
    "Balancing work stress with family responsibilities is such a common challenge. What would help you feel more present and connected with your family despite the work pressure?"
  ],
  "My wife says I've been distant and irritable at home.": [
    "It sounds like your wife has noticed a change in your behavior and mood. That can be really concerning for both of you. How do you feel about her observation?",
    "When work stress makes us irritable and distant at home, it can create distance in our relationships. Have you had a chance to talk with your wife about what's been going on?",
    "It's tough when the stress from one area of life affects our most important relationships. What do you think would help you feel more connected and present at home?"
  ],
  "I feel like I'm failing at both work and being a good husband.": [
    "That sounds like an incredibly heavy burden to carry. Feeling like you're failing in both areas can really impact your self-worth. What makes you feel like you're failing as a husband specifically?",
    "It's really hard when we feel like we're not meeting expectations - whether at work or at home. Have you talked with your wife about these feelings, or is this something you're carrying alone?",
    "The pressure to be successful in both career and marriage is real, but perfection isn't realistic. What would it look like to 'succeed' in these areas in a more balanced way?"
  ],
  "Maybe I should look for a different job?": [
    "That's a significant decision to consider. When you think about looking for a different job, what aspects of your current situation make you feel that change might be necessary?",
    "Changing jobs can be a good solution in some cases, but it's important to consider what specifically would make a different job better. What would you be looking for in a new position?",
    "It's smart to consider all your options. Before making such a big change, what would need to be different about your current job to make it workable for you?"
  ],
  "But I'm scared to make a big change right now.": [
    "It's completely normal to feel scared about making big life changes, especially when it comes to something as important as your career. What specifically are you most afraid of?",
    "Fear of change is very common, especially when the unknown feels uncertain. What would make you feel more confident about considering a job change, or what would help you stay in your current role?",
    "It takes courage to acknowledge both the need for change and the fear that comes with it. What would be the first step that feels manageable to you right now?"
  ],
  "What would you do in my situation?": [
    "If I were in your situation, I'd focus on creating a plan that addresses both the immediate stress and the longer-term concerns. What do you think would be the most important first step for you?",
    "Everyone's situation is unique, but I'd encourage you to consider what changes are within your control right now. What small steps could you take to improve things in either your work or home life?",
    "Rather than telling you what I'd do, I'm more interested in what feels right for you. What options are you considering, and what do you think would lead to the best outcome for you and your family?"
  ],
  "Thank you for listening, I feel a bit better just talking about it.": [
    "You're very welcome. Sometimes just having someone to talk to and being heard can make a real difference. I'm glad you're feeling a bit better already.",
    "It's completely normal to feel relief after expressing what's been weighing on you. Talking about these things is an important first step in managing stress and anxiety.",
    "I'm glad our conversation has helped you feel some relief. Remember that you don't have to carry all of this alone - we can continue working on these things together."
  ]
};

// Fallback responses for when we don't have a specific response
const FALLBACK_RESPONSES = [
  "Thank you for sharing that with me. It sounds like you're going through a really challenging time right now.",
  "I appreciate you opening up about this. What you're experiencing sounds really difficult.",
  "That sounds incredibly stressful. It makes sense that you're feeling overwhelmed given everything you've told me.",
  "I'm glad you felt comfortable sharing this with me. Let's explore what might help with these feelings.",
  "Thank you for being so honest about what you're experiencing. These are valid concerns to have."
];

// Function to get a demo AI response
function getDemoResponse(userMessage: string, context: string[] = []): string {
  // Check for exact match first
  if (userMessage in DEMO_AI_RESPONSES) {
    const responses = DEMO_AI_RESPONSES[userMessage as keyof typeof DEMO_AI_RESPONSES];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Check for partial matches
  const lowerUserMessage = userMessage.toLowerCase();
  for (const [key, responses] of Object.entries(DEMO_AI_RESPONSES)) {
    if (lowerUserMessage.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerUserMessage)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  // Check context for better responses
  if (context.length > 0) {
    const lastContext = context[context.length - 1].toLowerCase();
    if (lastContext.includes("work") || lastContext.includes("job")) {
      const workResponses = [
        "Work stress can really impact many areas of our lives. It's good that you're exploring these feelings.",
        "It sounds like work has been a major source of stress for you. What would make your work situation feel more manageable?",
        "Work-related challenges can feel overwhelming. What aspects of your work situation do you feel most stuck on?"
      ];
      return workResponses[Math.floor(Math.random() * workResponses.length)];
    }
    
    if (lastContext.includes("family") || lastContext.includes("wife")) {
      const familyResponses = [
        "Family relationships are so important, especially when we're under stress. How can we work on improving your connection at home?",
        "It's clear that your family relationships matter deeply to you. What would help you feel more present and connected with them?",
        "Maintaining family connections during stressful times can be challenging. What support would help you in this area?"
      ];
      return familyResponses[Math.floor(Math.random() * familyResponses.length)];
    }
    
    if (lastContext.includes("anxiety") || lastContext.includes("panic")) {
      const anxietyResponses = [
        "Anxiety can be really challenging to manage. What coping strategies have you found helpful so far?",
        "It takes courage to talk about anxiety. Have you noticed any patterns or triggers that make it worse?",
        "Anxiety is something many people struggle with. What would you like to focus on first in managing these feelings?"
      ];
      return anxietyResponses[Math.floor(Math.random() * anxietyResponses.length)];
    }
  }

  // Return a fallback response
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// Define the schemas
export const demoChatRequestSchema = z.object({
  initialForm: z
    .object({
      preferredName: z.string().optional(),
      currentEmotions: z.array(z.string()).optional(),
      reasonForVisit: z.string(),
      supportType: z.array(z.string()).optional(),
      supportTypeOther: z.string().optional(),
      additionalContext: z.string().optional(),
      responseTone: z.string().optional(),
      imageResponse: z.string().optional(),
      responseCharacter: z.string().optional(),
      responseDescription: z.string().optional(),
    })
    .optional(),
  context: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
        timestamp: z.number(),
        contextId: z.string().optional(),
      })
    )
    .optional(),
  message: z.string(), // The actual new message from the user
  userId: z.string().optional(), // Now accepts string userId
  sessionId: z.number().optional(), // Session ID for ongoing chats
  strategy: z.string().optional(), // Added for strategy from the agent
  nextSteps: z.array(z.string()).optional(), // Added for next steps from the agent
  observerRationale: z.string().optional(), // Added for observer rationale
  observerNextSteps: z.array<string>().optional(), // Added for observer next steps
  sentiment: z.string().optional(), // Added for sentiment analysis
  sender: z.string().optional(), // Added for sender
  threadType: z.enum(["main", "impersonate"]).optional().default("main"), // Added for thread type
  conversationPreferences: z
    .object({
      briefAndConcise: z.boolean().optional(),
      empatheticAndSupportive: z.boolean().optional(),
      solutionFocused: z.boolean().optional(),
      casualAndFriendly: z.boolean().optional(),
      professionalAndFormal: z.boolean().optional(),
    })
    .optional(),
});

const demoChat = new Hono()
  .post("/", zValidator("json", demoChatRequestSchema), async (c) => {
    const rawBody = await c.req.json();
    const parsed = demoChatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      logger.error("Zod validation error:", parsed.error.errors);
      return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
    }

    const {
      initialForm,
      context,
      message,
      userId,
      sessionId,
      strategy,
      nextSteps,
      observerRationale,
      observerNextSteps,
      sentiment,
      sender,
      threadType,
      conversationPreferences,
    } = parsed.data;
    let currentSessionId = sessionId;

    // Fetch session follow-up form answers from the PREVIOUS session if they exist
    let followupFormAnswers: Record<string, any> | null = null;
    if (currentSessionId) {
      // First get the current session to find its thread and session number
      const currentSession = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, currentSessionId))
        .limit(1);
        
      if (currentSession.length > 0 && currentSession[0].sessionNumber > 1) {
        // Get the previous session in the same thread
        const previousSession = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.threadId, currentSession[0].threadId),
              eq(sessions.sessionNumber, currentSession[0].sessionNumber - 1)
            )
          )
          .limit(1);
          
        if (previousSession.length > 0) {
          // Look for follow-up form from the previous session
          const formRows = await db
            .select()
            .from(sessionForms)
            .where(eq(sessionForms.sessionId, previousSession[0].id));
          if (formRows.length > 0) {
            followupFormAnswers = formRows[0].answers;
            logger.log(`[DEMO-CHAT] Found follow-up form from previous session ${previousSession[0].id}:`, followupFormAnswers);
          } else {
            logger.log(`[DEMO-CHAT] No follow-up form found for previous session ${previousSession[0].id}`);
          }
        }
      }
    }

    let sessionData: any[] = [];
    const sessionIdNum = Number(currentSessionId);
    if (initialForm) {
      sessionData = await db
        .select({
          session: sessions,
          thread: threads,
        })
        .from(sessions)
        .innerJoin(threads, eq(sessions.threadId, threads.id))
        .where(eq(sessions.id, sessionIdNum))
        .limit(1);

      if (
        sessionData.length === 0 ||
        String(sessionData[0].thread.userId) !== String(userId)
      ) {
        return c.json({ error: "Invalid session or unauthorized" }, 403);
      }

      // Check if session is finished
      if (sessionData[0].session.status === "finished") {
        return c.json(
          { error: "This session has been finished and is no longer active" },
          400
        );
      }
    } else if (!currentSessionId) {
      return c.json(
        { error: "Session ID is required for ongoing chats." },
        400
      );
    } else {
      sessionData = await db
        .select({
          session: sessions,
          thread: threads,
        })
        .from(sessions)
        .innerJoin(threads, eq(sessions.threadId, threads.id))
        .where(eq(sessions.id, sessionIdNum))
        .limit(1);

      if (
        sessionData.length === 0 ||
        String(sessionData[0].thread.userId) !== String(userId)
      ) {
        return c.json({ error: "Invalid session or unauthorized" }, 403);
      }

      // Check if session is finished
      if (sessionData[0].session.status === "finished") {
        return c.json(
          { error: "This session has been finished and is no longer active" },
          400
        );
      }
    }

    // Save user message to database
    if (message && currentSessionId && threadType !== "impersonate") {
      try {
        const allowedSenders = ["user", "ai", "therapist", "impostor"] as const;
        type SenderType = (typeof allowedSenders)[number];
        const safeSender: SenderType = allowedSenders.includes(
          sender as SenderType
        )
          ? (sender as SenderType)
          : "user";
        await db.insert(messages).values({
          sessionId: sessionIdNum,
          threadType: threadType || "main",
          sender: safeSender,
          text: message,
          timestamp: new Date(),
        });
        // Update session's updated_at
        await db
          .update(sessions)
          .set({ updatedAt: new Date() })
          .where(eq(sessions.id, sessionIdNum));
        // Update thread's updatedAt
        if (sessionData && sessionData.length > 0) {
          await db
            .update(threads)
            .set({ updatedAt: new Date() })
            .where(eq(threads.id, sessionData[0].thread.id));
        }
      } catch (error) {
        logger.error("Error saving user message:", error);
      }
    }

    // Generate demo AI response
    const contextTexts = context?.map(msg => msg.text) || [];
    const aiResponse = getDemoResponse(message, contextTexts);

    // Simulate streaming by breaking the response into chunks
    const words = aiResponse.split(' ');
    let fullResponse = "";

    return streamSSE(c, async (stream) => {
      if (currentSessionId && initialForm) {
        await stream.writeSSE({
          event: "session_id",
          data: String(currentSessionId),
        });
      }

      try {
        // Stream the response word by word to simulate real AI
        for (const word of words) {
          fullResponse += word + ' ';
          await stream.writeSSE({ data: word + ' ' });
          // Add a small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Save AI response to database
        if (currentSessionId && threadType !== "impersonate") {
          try {
            const allowedSenders = [
              "user",
              "ai",
              "therapist",
              "impostor",
            ] as const;
            type SenderType = (typeof allowedSenders)[number];
            let aiSender: SenderType = "ai";
            await db.insert(messages).values({
              sessionId: sessionIdNum,
              threadType: threadType || "main",
              sender: aiSender,
              text: fullResponse.trim(),
              timestamp: new Date(),
            });
            // Update session's updated_at
            await db
              .update(sessions)
              .set({ updatedAt: new Date() })
              .where(eq(sessions.id, sessionIdNum));
          } catch (error) {
            logger.error("Error saving AI response:", error);
          }
        }
      } catch (error) {
        logger.error("Error during demo streaming:", error);
        await stream.writeSSE({
          data: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });
  });

export default demoChat;
export type DemoChatType = typeof demoChat;