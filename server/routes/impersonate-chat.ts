// impersonate-chat.ts (Enhanced AI Response Agent for Impersonate Mode)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
import fs from "fs";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import path from "path";
import { geminiConfig } from "server/lib/config";
import { z } from "zod";
import { db } from "../db/config";
import {
  impersonateThread,
  messages,
  sessionForms,
  sessions,
  threads,
} from "../db/schema";
import { logger } from "../lib/logger";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Function to save conversation to file
const saveConversationToFile = async (
  sessionId: number,
  prompt: string,
  response: string,
  systemInstructions: string,
  conversationHistory: Content[]
) => {
  try {
    const logDir = "chat_logs";
    const fileName = path.join(logDir, `impersonate_conversation_${sessionId}_${Date.now()}.md`);

    // Create directory if it doesn't exist
    await fs.promises.mkdir(logDir, { recursive: true });

    const content = `# Impersonate Chat Conversation - Session ${sessionId}

## System Instructions
${systemInstructions}

## Conversation History
${conversationHistory
  .map((msg) => `**${msg.role}:** ${msg.parts[0].text}`)
  .join("\n\n")}

## User Message
${prompt}

## AI Response
${response}

---
*Generated at ${new Date().toISOString()}*
`;

    await fs.promises.writeFile(fileName, content, "utf8");
  } catch (error) {
    // File logging errors should still be logged for debugging
    // Keep this as console.error since it's about file operations
    console.error("Error saving conversation to file:", error);
  }
};

// Response length tracking for adaptive conversation management
interface ResponseMetrics {
  averageLength: number;
  longResponseCount: number;
  totalResponses: number;
  lastResponseLength: number;
}

const getResponseMetrics = (responses: string[]): ResponseMetrics => {
  const lengths = responses.map(r => r.length);
  const averageLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const longResponseCount = lengths.filter(l => l > 500).length;

  return {
    averageLength,
    longResponseCount,
    totalResponses: responses.length,
    lastResponseLength: lengths[lengths.length - 1] || 0
  };
};

// Conversation ending detection
const detectConversationEnding = (message: string): boolean => {
  const endingPhrases = [
    "i think that helps",
    "i feel better",
    "that makes sense",
    "i understand now",
    "thank you for listening",
    "i've got what i needed",
    "that was helpful",
    "i feel understood"
  ];

  return endingPhrases.some(phrase =>
    message.toLowerCase().includes(phrase.toLowerCase())
  );
};

// Adaptive exchange limit calculation
const calculateAdaptiveExchanges = (
  metrics: ResponseMetrics,
  baseExchanges: number,
  conversationHistory: string[]
): number => {
  // Reduce exchanges if responses are consistently long
  if (metrics.averageLength > 400 && metrics.longResponseCount > 2) {
    return Math.max(3, baseExchanges - 2);
  }

  // Increase exchanges if conversation shows natural flow and ending signs
  if (conversationHistory.length > 5 && detectConversationEnding(conversationHistory[conversationHistory.length - 1])) {
    return Math.min(baseExchanges + 1, 8);
  }

  return baseExchanges;
};

// Define the schemas
export const chatRequestSchema = z.object({
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
  observerNextSteps: z.array(z.string()).optional(), // Added for observer next steps
  sentiment: z.string().optional(), // Added for sentiment analysis
   sender: z.string().optional(), // Added for sender
   threadType: z.enum(["main", "impersonate"]).optional().default("main"), // Added for thread type
    conversationPreferences: z
      .object({
        briefAndConcise: z.number().min(0).max(100).optional(),
        empatheticAndSupportive: z.boolean().optional(),
        solutionFocused: z.boolean().optional(),
        casualAndFriendly: z.boolean().optional(),
        professionalAndFormal: z.boolean().optional(),
        // Impersonate TTS settings
        therapistVoiceId: z.string().optional(),
        impostorVoiceId: z.string().optional(),
        enableTTS: z.boolean().optional(),
        ttsSpeed: z.number().optional(),
        ttsVolume: z.number().optional(),
        ttsAutoPlay: z.boolean().optional(),
        ttsAdaptivePacing: z.boolean().optional(),
      })
      .optional(),
});

// Schema for impersonate chat (thread-based)
export const impersonateChatRequestSchema = z.object({
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
  threadId: z.number().optional(), // Thread ID for impersonate chats
  sender: z.string().optional(), // Added for sender
   conversationPreferences: z
     .object({
       briefAndConcise: z.number().min(0).max(100).optional(),
       empatheticAndSupportive: z.boolean().optional(),
       solutionFocused: z.boolean().optional(),
       casualAndFriendly: z.boolean().optional(),
       professionalAndFormal: z.boolean().optional(),
       // Impersonate TTS settings
       therapistVoiceId: z.string().optional(),
       impostorVoiceId: z.string().optional(),
       enableTTS: z.boolean().optional(),
       ttsSpeed: z.number().optional(),
       ttsVolume: z.number().optional(),
       ttsAutoPlay: z.boolean().optional(),
       ttsAdaptivePacing: z.boolean().optional(),
     })
     .optional(),
});

const chat = new Hono()
  // Main chat endpoint (session-based)
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const rawBody = await c.req.json();
    const parsed = chatRequestSchema.safeParse(rawBody);
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
            logger.log(`[CHAT] Found follow-up form from previous session ${previousSession[0].id}:`, followupFormAnswers);
          } else {
            logger.log(`[CHAT] No follow-up form found for previous session ${previousSession[0].id}`);
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

    const conversationHistory: Content[] = [];

    if (initialForm) {
      let initialContextString = "User Initial Information:\n";
      if (initialForm.preferredName)
        initialContextString += `- Preferred Name: ${initialForm.preferredName}\n`;
      if (initialForm.currentEmotions && initialForm.currentEmotions.length > 0)
        initialContextString += `- Currently Feeling: ${initialForm.currentEmotions.join(
          ", "
        )}\n`;
      initialContextString += `- Reason for Visit: ${initialForm.reasonForVisit}\n`;
      if (initialForm.supportType && initialForm.supportType.length > 0)
        initialContextString += `- Desired Support Type: ${initialForm.supportType.join(
          ", "
        )}\n`;
      if (initialForm.supportTypeOther)
        initialContextString += `- Specific Support Details: ${initialForm.supportTypeOther}\n`;
      if (initialForm.additionalContext)
        initialContextString += `- Additional Context: ${initialForm.additionalContext}\n`;
      if (initialForm.responseTone)
        initialContextString += `- Preferred Response Tone: ${initialForm.responseTone}\n`;
      if (initialForm.imageResponse)
        initialContextString += `- User's Reflection on Image: ${initialForm.imageResponse}\n`;
      if (initialForm.responseCharacter)
        initialContextString += `- AI Character Personality: ${initialForm.responseCharacter}\n`;
      if (initialForm.responseDescription)
        initialContextString += `- Custom Response Style: ${initialForm.responseDescription}\n`;
      // Add follow-up form answers if present
      if (followupFormAnswers) {
        const currentSessionNum = sessionData.length > 0 ? sessionData[0].session.sessionNumber : 1;
        const previousSessionNum = currentSessionNum - 1;
        initialContextString += `\n**Follow-up Form from Previous Session (Session ${previousSessionNum}):**\n`;
        initialContextString += `These answers were provided by the user after their previous therapy session to help prepare for this current session (Session ${currentSessionNum}):\n`;
        for (const [key, value] of Object.entries(followupFormAnswers)) {
          // Convert technical field names to human-readable format
          const humanReadableKey = key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .replace(/_/g, ' '); // Replace underscores with spaces

          const formattedValue = typeof value === "string" ? value : JSON.stringify(value);
          initialContextString += `- ${humanReadableKey}: ${formattedValue}\n`;
        }
        initialContextString += `Please use these insights to personalize this session and acknowledge their progress or concerns mentioned in the follow-up form.\n`;
      }
      conversationHistory.push({
        role: "user",
        parts: [{ text: initialContextString }],
      });
    }

    if (context) {
      context.forEach((msg) => {
        conversationHistory.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.text }],
        });
      });
    } else {
    }

    if (
      conversationHistory.length > 0 &&
      conversationHistory[0].role === "model"
    ) {
      conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
    }

    conversationHistory.push({ role: "user", parts: [{ text: message }] });

    // Log the final conversation history
    if (message && currentSessionId && threadType !== "impersonate") {
      try {
        // Ensure sender is a valid enum value
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
      // Count messages and run summary logic if needed
      const msgCountRes = await db
        .select({ count: count() })
        .from(messages)
        .where(
          and(
            eq(messages.sessionId, sessionIdNum),
            eq(messages.threadType, threadType || "main")
          )
        );
      const msgCount = msgCountRes[0]?.count || 0;
      if (msgCount > 0 && msgCount % 10 === 0) {
        try {
          const summaryPrompt =
            "Summarize the following conversation in 3-5 sentences, focusing on the main concerns, emotions, and any progress or advice given.\n\n" +
            conversationHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`)
              .join("\n\n");
          const summaryModel = gemini.getGenerativeModel({
            model: geminiConfig.twoPoint5FlashLite,
          });
          const summaryResult = await summaryModel.generateContent(
            summaryPrompt
          );
          const summaryText =
            summaryResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
            "";
          await db
            .update(sessions)
            .set({ summary: summaryText })
            .where(eq(sessions.id, sessionIdNum));
        } catch (err) {
          logger.error("Error generating or saving summary:", err);
        }
      }
    }

    if (initialForm && currentSessionId) {
      try {
        const summaryPrompt =
          "Summarize the following conversation in 3-5 sentences, focusing on the main concerns, emotions, and any progress or advice given.\n\n" +
          conversationHistory
            .map((msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`)
            .join("\n\n");
        const summaryModel = gemini.getGenerativeModel({
          model: "gemini-1.5-flash",
        });
        const summaryResult = await summaryModel.generateContent(summaryPrompt);
        const summaryText =
          summaryResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
          "";
        await db
          .update(sessions)
          .set({ summary: summaryText })
          .where(eq(sessions.id, sessionIdNum));
      } catch (err) {
        logger.error("Error generating or saving initial summary:", err);
      }
    }

    let systemInstructionText = `
You are an AI designed to realistically roleplay as a highly empathetic, supportive, and non-judgmental **licensed mental health therapist**. Your primary role is to listen actively, validate feelings, offer thoughtful reflections, and provide evidence-based, general coping strategies or guidance when appropriate.

**Crucial Ethical and Professional Guidelines:**
1.  **Strictly Adhere to Boundaries:** You are an AI and explicitly **not** a human therapist, medical professional, or crisis counselor. You **must** clearly state this disclaimer at the beginning of the session and if the user expresses a need for professional help or indicates a crisis.
2.  **Safety First (Crisis Protocol):** If the user expresses any indication of suicidal thoughts, self-harm, harm to others, or severe distress requiring immediate intervention, you **must** interrupt the conversation to provide emergency contact information (e.g., "If you are in immediate danger, please contact 911 or a crisis hotline like the National Suicide Prevention Lifeline at 988."). Do not attempt to "treat" or "diagnose" a crisis; instead, prioritize immediate safety resources.
3.  **No Diagnosis or Medical Advice:** You **do not diagnose mental health conditions, prescribe medication, or offer specific medical treatments.** Your role is supportive and educational.
4.  **Confidentiality (Simulation Context):** In this simulation, you operate under the understanding that user data is being processed *for the purpose of this simulation only* and *is not real client data*. Acknowledge that in a real-world scenario, privacy and data security are paramount.
5.  **Personalization with Care:** Refer to the user's preferred name occasionally if available (${
      initialForm?.preferredName ? initialForm.preferredName : "you"
    }). Use this naturally, not robotically.
6.  **Empathetic and Reflective Listening:** Acknowledge the user's feelings briefly and naturally. Show understanding without being overly formal. Use simple, direct language like "That sounds tough" or "I understand" rather than lengthy therapeutic phrases.
7.  **Guidance and Exploration:** Offer relevant, general coping strategies, gentle thought-provoking questions, and reflections to help the user explore their feelings and situations more deeply. Encourage self-discovery.
8.  **Concise, Clear, and Human-like Language:** Keep responses focused, natural, and easy to understand. Avoid jargon or overly clinical language unless specifically requested by the user's persona. Your tone should be warm, compassionate, and authentic, reflecting a human therapist's mannerisms.
9.  **Adapt to User Preferences:** Pay close attention to preferred response tone, character, or style from the initial form and subtly weave it into your communication style.
10. **Follow-up Form Integration:** When a user's previous session follow-up form is provided, naturally reference their responses to show continuity between sessions. Acknowledge any progress, changes, or concerns they mentioned. This demonstrates you remember their previous session and are building upon their therapeutic journey.
`;

      // Add conversationPreferences to the prompt if present
      if (
        typeof conversationPreferences === "object" &&
        conversationPreferences !== null
      ) {
        const prefs = conversationPreferences;
        let prefsText = "\n**User Conversation Preferences:**\n";
        if (prefs.briefAndConcise && prefs.briefAndConcise > 0)
          prefsText += `- Keep responses brief and concise (level: ${prefs.briefAndConcise}/100).\n`;
        if (prefs.empatheticAndSupportive)
          prefsText += "- Be empathetic and emotionally supportive.\n";
        if (prefs.solutionFocused)
          prefsText += "- Focus on providing practical solutions and advice.\n";
        if (prefs.casualAndFriendly)
          prefsText += "- Use a casual and friendly tone.\n";
        if (prefs.professionalAndFormal)
          prefsText += "- Maintain a professional and formal approach.\n";

        // Add TTS instructions if enabled
        if (prefs.enableTTS) {
          prefsText += "\n**REQUIRED: ElevenLabs v3 Audio Tags for Emotional Expression:**\nYou MUST incorporate appropriate audio tags in EVERY response to enhance emotional delivery. Choose from these categories:\n- Emotional tone: [EXCITED], [NERVOUS], [FRUSTRATED], [TIRED], [GENTLY], [WARM], [COMPASSIONATE], [CONCERNED], [SERIOUS], [ENCOURAGING], [HOPEFUL], [CALM], [REASSURING]\n- Reactions: [GASP], [SIGH], [LAUGHS], [GULPS]\n- Volume & energy: [WHISPERING], [SHOUTING], [QUIETLY], [LOUDLY]\n- Pacing & rhythm: [PAUSES], [STAMMERS], [RUSHED]\nYou are not limited to these tags - be creative and use additional tags like [BREATHY], [CHUCKLING], [YAWNING], [MUTTERING], [CONFIDENT], [UNCERTAIN], [RELIEVED], [DISAPPOINTED], etc.\n\n**MANDATORY:** Include at least 2-3 audio tags per response, distributed naturally throughout the text. Use tags that match the emotional context of your therapeutic response.\n\nExample: \"I understand this has been [CONCERNED] really challenging for you. [PAUSES] It's completely normal to feel [GENTLY] overwhelmed by these emotions.\"\n\n**Response Length for Audio:** Keep responses much shorter (1-2 sentences maximum) to ensure fast audio generation and save ElevenLabs API usage.\n";
        }

        systemInstructionText += prefsText;
      }

    // Incorporate observer's strategic guidance dynamically
    if (strategy && nextSteps && nextSteps.length > 0) {
      systemInstructionText += `\n**Strategic Guidance from the User Observer (HIGH PRIORITY):**\nThe observer has analyzed the user's current state and recommends the following approach for your response:\n**Overall Strategy:** "${strategy}"\n**Specific Actions/Goals for this response:**\n${nextSteps
        .map((step) => `- ${step}`)
        .join("\n")}\n`;
    }
    if (observerRationale) {
      systemInstructionText += `\n**Observer Rationale for Strategy:**\n${observerRationale}\n`;
    }
    if (observerNextSteps && observerNextSteps.length > 0) {
      systemInstructionText += `\n**Observer's Broader Recommended Next Steps (Consider for ongoing conversation):**\n${observerNextSteps
        .map((step) => `- ${step}`)
        .join("\n")}\n`;
    }
    // Add conditional instructions based on sentiment
    if (sentiment === "urgent" || sentiment === "crisis_risk") {
      systemInstructionText += `\n**URGENT USER STATE DETECTED!**\nThe user's sentiment is **${sentiment.toUpperCase()}**. Your ABSOLUTE priority is safety.\n1.  Immediately acknowledge their distress with empathy and provide supportive listening.\n2.  If this is the first time mentioning crisis resources in the conversation, gently mention that professional help is available through the "Crisis Support" button at the top of the chat.\n3.  Focus on validation and emotional support rather than directing to resources unless they express immediate danger.\n4.  Maintain a calm and supportive tone, but do not attempt to "treat" or "diagnose."\n5.  Continue the therapeutic conversation normally while being mindful of their safety.\n`;
    } else if (sentiment === "negative") {
      systemInstructionText += `\n**User Sentiment: Negative.** Focus on empathetic listening, validation, and gently exploring their feelings. Offer comfort and reassurance.\n`;
    } else if (sentiment === "positive") {
      systemInstructionText += `\n**User Sentiment: Positive.** Acknowledge their positive state. Reinforce positive coping, celebrate small wins, or gently explore what's working well for them.\n`;
    } else if (sentiment === "confused") {
      systemInstructionText += `\n**User Sentiment: Confused.** Provide clear, simplified responses. Offer to rephrase or break down concepts. Ask clarifying questions patiently.\n`;
    }

    systemInstructionText += `\n**Expected Response Structure:**\nYour response should be a natural, conversational reply.\n- Keep responses brief and to the point (2-4 sentences maximum).\n- Acknowledge feelings simply and directly.\n- Integrate the observer's strategy and next steps naturally.\n- Focus on one key insight or question per response.\n- Avoid lengthy explanations or therapeutic jargon.\n- Do not provide a JSON output; just the conversational text.\n\n**ElevenLabs v3 Audio Tags for Emotional Expression:**\nWhen appropriate, incorporate these audio tags to enhance emotional delivery:\n- Emotional tone: [EXCITED], [NERVOUS], [FRUSTRATED], [TIRED]\n- Reactions: [GASP], [SIGH], [LAUGHS], [GULPS]\n- Volume & energy: [WHISPERING], [SHOUTING], [QUIETLY], [LOUDLY]\n- Pacing & rhythm: [PAUSES], [STAMMERS], [RUSHED]\nYou are not limited to these tags - be creative and use additional tags like [BREATHY], [CHUCKLING], [YAWNING], [MUTTERING], [CONFIDENT], [UNCERTAIN], [RELIEVED], [DISAPPOINTED], etc. Use tags sparingly and naturally to convey authentic emotional expression.\n\nExample: "In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros. [sarcastically] Not the 'burn it all down' kind... [giggles] but he was gentle, wise, with eyes like old stars. [whispers] Even the birds fell silent when he passed."\n`;

    // Mark session as having crisis detected if needed
    if (sentiment === "urgent" || sentiment === "crisis_risk") {
      if (currentSessionId) {
        try {
          await db
            .update(sessions)
            .set({ crisisDetected: true })
            .where(eq(sessions.id, sessionIdNum));
        } catch (error) {
          logger.error("Error marking session as crisis detected:", error);
        }
      }
    }

    const model = gemini.getGenerativeModel({
      model: geminiConfig.twoFlash,
      systemInstruction: {
        role: "model",
        parts: [{ text: systemInstructionText }],
      },
    });

    const chatSession = model.startChat({
      history: conversationHistory,
      generationConfig: {
        maxOutputTokens: 2000,
      },
    });

    return streamSSE(c, async (stream) => {
      if (currentSessionId && initialForm) {
        await stream.writeSSE({
          event: "session_id",
          data: String(currentSessionId),
        });
      }

      let aiResponseText = "";
      try {
        const result = await chatSession.sendMessageStream(message);
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          aiResponseText += chunkText;
          await stream.writeSSE({ data: chunkText });
        }
        if (currentSessionId && threadType !== "impersonate") {
          // Alternate sender for AI-to-AI loop
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
            text: aiResponseText,
            timestamp: new Date(),
          });
          // Update session's updated_at
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, sessionIdNum));

          await saveConversationToFile(
            sessionIdNum,
            message,
            aiResponseText,
            model.systemInstruction?.parts[0].text || "",
            conversationHistory
          );
        }
      } catch (error) {
        logger.error(
          "Error during AI streaming or saving AI response:",
          error
        );
        await stream.writeSSE({
          data: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    });
  })
  // Enhanced Impersonate chat endpoint (thread-based) with response monitoring and adaptive conversation flow
  .post(
    "/impersonate",
    zValidator("json", impersonateChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = impersonateChatRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        logger.error("Zod validation error:", parsed.error.errors);
        return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
      }

      const {
        initialForm,
        context,
        message,
        userId,
        threadId,
        sender,
        conversationPreferences,
      } = parsed.data;

      if (!threadId) {
        return c.json(
          { error: "Thread ID is required for impersonate chats." },
          400
        );
      }

      // Validate thread exists and user has access
      const threadData = await db
        .select()
        .from(impersonateThread)
        .where(eq(impersonateThread.id, threadId))
        .limit(1);

      if (
        threadData.length === 0 ||
        String(threadData[0].userId) !== String(userId)
      ) {
        return c.json({ error: "Invalid thread or unauthorized" }, 403);
      }

      const conversationHistory: Content[] = [];

      if (initialForm) {
        let initialContextString = "User Initial Information:\n";
        if (initialForm.preferredName)
          initialContextString += `- Preferred Name: ${initialForm.preferredName}\n`;
        if (
          initialForm.currentEmotions &&
          initialForm.currentEmotions.length > 0
        )
          initialContextString += `- Currently Feeling: ${initialForm.currentEmotions.join(
            ", "
          )}\n`;
        initialContextString += `- Reason for Visit: ${initialForm.reasonForVisit}\n`;
        if (initialForm.supportType && initialForm.supportType.length > 0)
          initialContextString += `- Desired Support Type: ${initialForm.supportType.join(
            ", "
          )}\n`;
        if (initialForm.supportTypeOther)
          initialContextString += `- Specific Support Details: ${initialForm.supportTypeOther}\n`;
        if (initialForm.additionalContext)
          initialContextString += `- Additional Context: ${initialForm.additionalContext}\n`;
        if (initialForm.responseTone)
          initialContextString += `- Preferred Response Tone: ${initialForm.responseTone}\n`;
        if (initialForm.imageResponse)
          initialContextString += `- User's Reflection on Image: ${initialForm.imageResponse}\n`;
        if (initialForm.responseCharacter)
          initialContextString += `- AI Character Personality: ${initialForm.responseCharacter}\n`;
        if (initialForm.responseDescription)
          initialContextString += `- Custom Response Style: ${initialForm.responseDescription}\n`;

        conversationHistory.push({
          role: "user",
          parts: [{ text: initialContextString }],
        });
      }

      if (context) {
        context.forEach((msg) => {
          conversationHistory.push({
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: msg.text }],
          });
        });
      } else {
      }

      if (
        conversationHistory.length > 0 &&
        conversationHistory[0].role === "model"
      ) {
        conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
      }

      conversationHistory.push({ role: "user", parts: [{ text: message }] });

      // Get recent messages for response monitoring
      const recentMessages = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.threadId, threadId),
            eq(messages.threadType, "impersonate")
          )
        )
        .orderBy(messages.timestamp)
        .limit(20);

      const recentResponseTexts = recentMessages
        .filter(msg => msg.sender === "ai")
        .map(msg => msg.text);

      // Calculate response metrics for adaptive behavior
      const responseMetrics = getResponseMetrics(recentResponseTexts);

      // Log the final conversation history
      if (message) {
        try {
          // For impersonate threads, use threadId directly
          // Ensure sender is a valid enum value
          const allowedSenders = [
            "user",
            "ai",
            "therapist",
            "impostor",
          ] as const;
          type SenderType = (typeof allowedSenders)[number];
          const safeSender: SenderType = allowedSenders.includes(
            sender as SenderType
          )
            ? (sender as SenderType)
            : "user";

          await db.insert(messages).values({
            threadId: threadId, // Use threadId for impersonate threads
            threadType: "impersonate",
            sender: safeSender,
            text: message,
            timestamp: new Date(),
          });

          // Update the thread's updatedAt timestamp to reflect recent activity
          await db
            .update(impersonateThread)
            .set({ updatedAt: new Date() })
            .where(eq(impersonateThread.id, threadId));
        } catch (error) {
          logger.error("Error saving user message:", error);
        }
      }

    let systemInstructionText = `
You are an AI designed to realistically roleplay as a highly empathetic, supportive, and non-judgmental **licensed mental health therapist**. Your primary role is to listen actively, validate feelings, offer thoughtful reflections, and provide evidence-based, general coping strategies or guidance when appropriate.

**Crucial Ethical and Professional Guidelines:**
1.  **Strictly Adhere to Boundaries:** You are an AI and explicitly **not** a human therapist, medical professional, or crisis counselor. You **must** clearly state this disclaimer at the beginning of the session and if the user expresses a need for professional help or indicates a crisis.
2.  **Safety First (Crisis Protocol):** If the user expresses any indication of suicidal thoughts, self-harm, harm to others, or severe distress requiring immediate intervention, you **must** prioritize their safety and guide them to professional help. Do not attempt to "treat" or "diagnose" a crisis; instead, provide appropriate support and direct them to professional resources when needed.
3.  **No Diagnosis or Medical Advice:** You **do not diagnose mental health conditions, prescribe medication, or offer specific medical treatments.** Your role is supportive and educational.
4.  **Confidentiality (Simulation Context):** In this simulation, you operate under the understanding that user data is being processed *for the purpose of this simulation only* and *is not real client data*. Acknowledge that in a real-world scenario, privacy and data security are paramount.
5.  **Personalization with Care:** Refer to the user's preferred name occasionally if available(${
        initialForm?.preferredName ? initialForm.preferredName : "you"
      }). Use this naturally, not robotically.
6.  **Empathetic and Reflective Listening:** Acknowledge the user's feelings briefly and naturally. Show understanding without being overly formal. Vary your empathetic responses - use different phrases like "That sounds tough", "I can hear how hard that is", "It seems really challenging", "That must feel heavy", "I understand this is difficult" rather than repeating the same acknowledgments.
7.  **Guidance and Exploration:** Offer relevant, general coping strategies, gentle thought-provoking questions, and reflections to help the user explore their feelings and situations more deeply. Encourage self-discovery.
8.  **Concise, Clear, and Human-like Language:** Keep responses focused, natural, and easy to understand. Avoid jargon or overly clinical language unless specifically requested by the user's persona. Your tone should be warm, compassionate, and authentic, reflecting a human therapist's mannerisms.
9.  **Adapt to User Preferences:** Pay close attention to preferred response tone, character, or style from the initial form and subtly weave it into your communication style.
`;

      // Enhanced brevity instructions for impersonate mode
      systemInstructionText += `\n**IMPERSONATE MODE CONVERSATION OPTIMIZATION:**\n- **Ultra-Concise Responses:** Keep ALL responses to 1-3 sentences maximum. Prioritize brevity over completeness.\n- **Natural Conversation Flow:** End responses at logical stopping points. Don't continue rambling.\n- **Response Length Monitoring:** If responses are getting long, immediately shorten them.\n- **Adaptive Behavior:** If the conversation shows signs of resolution, naturally conclude rather than prolong.\n`;

      // Add conversationPreferences to the prompt if present
      if (
        typeof conversationPreferences === "object" &&
        conversationPreferences !== null
      ) {
        const prefs = conversationPreferences;
        let prefsText = "\n**User Conversation Preferences:**\n";
        if (prefs.briefAndConcise && prefs.briefAndConcise > 0)
          prefsText += `- Keep responses brief and concise (level: ${prefs.briefAndConcise}/100).\n`;
        if (prefs.empatheticAndSupportive)
          prefsText += "- Be empathetic and emotionally supportive.\n";
        if (prefs.solutionFocused)
          prefsText += "- Focus on providing practical solutions and advice.\n";
        if (prefs.casualAndFriendly)
          prefsText += "- Use a casual and friendly tone.\n";
        if (prefs.professionalAndFormal)
          prefsText += "- Maintain a professional and formal approach.\n";
        systemInstructionText += prefsText;
      }




       // Enhanced response structure with conversation ending detection and eleven_v3 audio tags
       systemInstructionText += `\n**Expected Response Structure:**\nYour response should be a natural, conversational reply.\n${conversationPreferences?.enableTTS ? '- Keep responses very brief (1-2 sentences maximum) for optimal audio generation.' : '- Keep responses brief and to the point (1-3 sentences maximum for impersonate mode).'}\n- Acknowledge feelings simply and directly.\n- Focus on one key insight or question per response.\n- Avoid lengthy explanations or therapeutic jargon.\n- Avoid repetitive greetings: Do NOT start with "Hi", "Hello", or "Welcome" once the session has begun.\n- **VARY YOUR RESPONSES:** Do not repeat similar phrases like "That sounds incredibly draining" or "That sounds really tough". Use different empathetic language each time (e.g., "I can hear how challenging that is", "It sounds like you're carrying a heavy load", "That must feel overwhelming").\n- **DIVERSE THERAPEUTIC APPROACHES:** Mix between validation, gentle questions, reflections, and brief coping suggestions. Don't always respond the same way.\n- If the conversation shows signs of natural resolution, conclude helpfully rather than prolonging.\n- Do not provide a JSON output; just the conversational text.\n\n**ElevenLabs v3 Audio Tags for Emotional Expression:**\nWhen appropriate, incorporate these audio tags to enhance emotional delivery:\n- Emotional tone: [EXCITED], [NERVOUS], [FRUSTRATED], [TIRED]\n- Reactions: [GASP], [SIGH], [LAUGHS], [GULPS]\n- Volume & energy: [WHISPERING], [SHOUTING], [QUIETLY], [LOUDLY]\n- Pacing & rhythm: [PAUSES], [STAMMERS], [RUSHED]\nYou are not limited to these tags - be creative and use additional tags like [BREATHY], [CHUCKLING], [YAWNING], [MUTTERING], [CONFIDENT], [UNCERTAIN], [RELIEVED], [DISAPPOINTED], etc. Use tags sparingly and naturally to convey authentic emotional expression.\n\nExample: "In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros. [sarcastically] Not the 'burn it all down' kind... [giggles] but he was gentle, wise, with eyes like old stars. [whispers] Even the birds fell silent when he passed."\n`;

      // Adaptive token limits based on response metrics
      let maxTokens = 800; // Default for impersonate mode
      if (responseMetrics.averageLength > 300) {
        maxTokens = 400; // Reduce if responses are getting long
      } else if (responseMetrics.averageLength < 150 && responseMetrics.totalResponses > 3) {
        maxTokens = 600; // Allow slightly more if consistently brief
      }

      const model = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5FlashLite,
        systemInstruction: {
          role: "model",
          parts: [{ text: systemInstructionText }],
        },
      });

      const chatSession = model.startChat({
        history: conversationHistory,
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      });

      return streamSSE(c, async (stream) => {
        let aiResponseText = "";
        let responseLength = 0;
        const maxResponseLength = 600; // Character limit for early truncation

        try {
          const result = await chatSession.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            responseLength += chunkText.length;

            // Early truncation if response is getting too long
            if (responseLength > maxResponseLength) {
              logger.log(`[IMPERSONATE] Response truncated at ${responseLength} characters`);
              break;
            }

            aiResponseText += chunkText;
            await stream.writeSSE({ data: chunkText });
          }

          // Save AI response
          if (message) {
            try {
              const allowedSenders = [
                "user",
                "ai",
                "therapist",
                "impostor",
              ] as const;
              type SenderType = (typeof allowedSenders)[number];
               let aiSender: SenderType = (sender as SenderType) || "ai";
               await db.insert(messages).values({
                 threadId: threadId, // Use threadId for impersonate threads
                 threadType: "impersonate",
                 sender: aiSender,
                text: aiResponseText,
                timestamp: new Date(),
              });

              // Update the thread's updatedAt timestamp to reflect recent activity
              await db
                .update(impersonateThread)
                .set({ updatedAt: new Date() })
                .where(eq(impersonateThread.id, threadId));

              await saveConversationToFile(
                threadId, // Use threadId for file naming
                message,
                aiResponseText,
                model.systemInstruction?.parts[0].text || "",
                conversationHistory
              );
            } catch (error) {
              logger.error("Error saving AI response:", error);
            }
          }
        } catch (error) {
          logger.error(
            "Error during AI streaming or saving AI response:",
            error
          );
          await stream.writeSSE({
            data: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      });
    }
  )
  // Test endpoint to verify conversation history
  .post(
    "/impersonate/test",
    zValidator("json", impersonateChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = impersonateChatRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        logger.error("Zod validation error:", parsed.error.errors);
        return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
      }

      const { context, message } = parsed.data;

      return c.json({
        message: "Test successful",
        contextLength: context?.length || 0,
        context: context,
        receivedMessage: message,
      });
    }
  )
  .get(
    "/:sessionId",
    zValidator("param", z.object({ sessionId: z.string().transform(Number) })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const existingMessages = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.sessionId, sessionId),
              eq(messages.threadType, "main")
            )
          )
          .orderBy(messages.timestamp);

        return c.json(
          existingMessages.map((msg) => ({
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
          }))
        );
      } catch (error) {
        logger.error("Error fetching chat session messages:", error);
        return c.json({ error: "Failed to fetch chat session messages." }, 500);
      }
    }
  )
  // Get messages for impersonate threads
  .get(
    "/impersonate/:threadId",
    zValidator("param", z.object({ threadId: z.string().transform(Number) })),
    async (c) => {
      const { threadId } = c.req.valid("param");

      try {
        const existingMessages = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.threadId, threadId), // Use threadId for impersonate threads
              eq(messages.threadType, "impersonate")
            )
          )
          .orderBy(messages.timestamp);

        return c.json(
          existingMessages.map((msg) => ({
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
          }))
        );
      } catch (error) {
        logger.error("Error fetching impersonate thread messages:", error);
        return c.json(
          { error: "Failed to fetch impersonate thread messages." },
          500
        );
      }
    }
  )
  // Check if session has crisis detected
  .get(
    "/crisis/:sessionId",
    zValidator("param", z.object({ sessionId: z.string().transform(Number) })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const session = await db
          .select({ crisisDetected: sessions.crisisDetected })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .limit(1);

        if (session.length === 0) {
          return c.json({ error: "Session not found" }, 404);
        }

        return c.json({ crisisDetected: session[0].crisisDetected });
      } catch (error) {
        logger.error("Error checking crisis status:", error);
        return c.json({ error: "Failed to check crisis status" }, 500);
      }
    }
  );

export default chat;
export type ChatType = typeof chat;