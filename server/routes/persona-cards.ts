// persona-cards.ts (Persona-based Chat API)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
import fs from "fs";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import path from "path";
import { getAudioInstruction } from "server/lib/audioInstructions";
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

// Load personas configuration
let personasConfig: any = null;
const loadPersonasConfig = async () => {
  try {
    const personasPath = path.join(process.cwd(), "personas.json");
    const personasData = await fs.promises.readFile(personasPath, "utf8");
    personasConfig = JSON.parse(personasData);
  } catch (error) {
    logger.error("Error loading personas config:", error);
    personasConfig = {
      personas: {
        listener: {
          id: "listener",
          name: "Empathetic Listener",
          systemInstruction: "You are an empathetic listener who provides a safe space for users to share their feelings."
        }
      }
    };
  }
};

// Initialize personas config
loadPersonasConfig();

// Function to save conversation to file
const savePersonaConversationToFile = async (
  personaId: string,
  sessionId: number,
  prompt: string,
  response: string,
  systemInstructions: string,
  conversationHistory: Content[]
) => {
  try {
    const logDir = "persona_chat_logs";
    const fileName = path.join(
      logDir,
      `persona_${personaId}_session_${sessionId}_${Date.now()}.md`
    );

    await fs.promises.mkdir(logDir, { recursive: true });

    const content = `# Persona Chat Conversation - ${personaId} - Session ${sessionId}

## Persona
${personaId}

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
    console.error("Error saving persona conversation to file:", error);
  }
};

// Define the schemas
export const personaChatRequestSchema = z.object({
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
  message: z.string(),
  userId: z.string().optional(),
  sessionId: z.number().optional(),
  conversationPreferences: z
    .object({
      briefAndConcise: z.number().min(0).max(100).optional(),
      empatheticAndSupportive: z.boolean().optional(),
      solutionFocused: z.boolean().optional(),
      casualAndFriendly: z.boolean().optional(),
      professionalAndFormal: z.boolean().optional(),
      language: z.enum(["english", "filipino"]).optional(),
      mainTTSVoiceId: z.string().optional(),
      mainTTSModel: z.string().optional(),
      mainEnableTTS: z.boolean().optional(),
      mainTTSSpeed: z.number().optional(),
      mainTTSAutoPlay: z.boolean().optional(),
      mainTTSAdaptivePacing: z.boolean().optional(),
    })
    .optional(),
});

const personaCards = new Hono()
  .post(
    "/persona",
    zValidator("json", personaChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = personaChatRequestSchema.safeParse(rawBody);
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
        conversationPreferences,
      } = parsed.data;

      let currentSessionId = sessionId;

      // Fetch session follow-up form answers if they exist
      let followupFormAnswers: Record<string, any> | null = null;
      if (currentSessionId) {
        const currentSession = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, currentSessionId))
          .limit(1);

        if (currentSession.length > 0 && currentSession[0].sessionNumber > 1) {
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
            const formRows = await db
              .select()
              .from(sessionForms)
              .where(eq(sessionForms.sessionId, previousSession[0].id));
            if (formRows.length > 0) {
              followupFormAnswers = formRows[0].answers;
            }
          }
        }
      }

      // Validate session exists and user has access
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

        if (sessionData[0].session.status === "finished") {
          return c.json(
            { error: "This session has been finished and is no longer active" },
            400
          );
        }
      }

      // Build conversation history
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
        
        if (followupFormAnswers) {
          const currentSessionNum =
            sessionData.length > 0 ? sessionData[0].session.sessionNumber : 1;
          const previousSessionNum = currentSessionNum - 1;
          initialContextString += `\n**Follow-up Form from Previous Session (Session ${previousSessionNum}):**\n`;
          initialContextString += `These answers were provided by the user after their previous therapy session to help prepare for this current session (Session ${currentSessionNum}):\n`;
          for (const [key, value] of Object.entries(followupFormAnswers)) {
            const humanReadableKey = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase())
              .replace(/_/g, " ");

            const formattedValue =
              typeof value === "string" ? value : JSON.stringify(value);
            initialContextString += `- ${humanReadableKey}: ${formattedValue}\n`;
          }
          initialContextString += `Please use these insights to personalize this session and acknowledge their progress or concerns mentioned in the follow-up form.\n`;
        }
        conversationHistory.push({
          role: "user",
          parts: [{ text: initialContextString }],
        });
      }

      // Helper function to clean audio tags
      const cleanAudioTags = (text: string, modelId?: string): string => {
        if (modelId === "eleven_v3") {
          return text;
        }
        return text.replace(/\[([A-Z]+)\]/g, '').trim();
      };

      if (context) {
        context.forEach((msg) => {
          conversationHistory.push({
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: cleanAudioTags(msg.text, conversationPreferences?.mainTTSModel) }],
          });
        });
      }

      if (
        conversationHistory.length > 0 &&
        conversationHistory[0].role === "model"
      ) {
        conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
      }

      conversationHistory.push({ role: "user", parts: [{ text: message }] });

      // Save user message
      if (message && currentSessionId) {
        try {
          const allowedSenders = ["user", "ai", "therapist", "impostor"] as const;
          type SenderType = (typeof allowedSenders)[number];
          const safeSender: SenderType = "user";
          await db.insert(messages).values({
            sessionId: sessionIdNum,
            threadType: "main",
            sender: safeSender,
            text: message,
            timestamp: new Date(),
          });
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, sessionIdNum));
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

      // Get persona selection from persona observer
      let selectedPersona = "listener";
      let personaSystemInstruction = "You are an empathetic listener who provides a safe space for users to share their feelings.";
      
      try {
        // Direct call to persona observer logic
        const personaObserverModel = gemini.getGenerativeModel({
          model: geminiConfig.twoPoint5FlashLite,
        });

        // Build context for persona selection
        let contextString = "";
        if (initialForm) {
          if (initialForm.preferredName)
            contextString += `User's preferred name: ${initialForm.preferredName}\n`;
          if (initialForm.currentEmotions && initialForm.currentEmotions.length > 0) {
            contextString += `User's current emotions: ${initialForm.currentEmotions.join(
              ", "
            )}\n`;
          }
          if (initialForm.reasonForVisit)
            contextString += `User's reason for visit: ${initialForm.reasonForVisit}\n`;
          if (initialForm.supportType && initialForm.supportType.length > 0) {
            contextString += `User's desired support type: ${initialForm.supportType.join(
              ", "
            )}\n`;
          }
          if (initialForm.additionalContext)
            contextString += `Additional context: ${initialForm.additionalContext}\n`;
        }

        const recentMessages = conversationHistory.slice(-5);
        const conversationText = recentMessages
          .map((msg) => `${msg.role === "user" ? "User" : "AI"}: ${msg.parts[0].text}`)
          .join("\n");

        const personasSummary = Object.values(personasConfig.personas)
          .map((persona: any) => `- ${persona.id}: ${persona.name} - ${persona.description}`)
          .join("\n");

        const personaPrompt = `You are a persona selection AI that analyzes user conversations to choose the most appropriate AI persona for their needs.

Available Personas:
${personasSummary}

Context about the user:
${contextString}

Recent conversation:
${conversationText}

Analyze the user's emotional state, needs, and communication style to select the best persona. Consider:
1. Their emotional state and immediate needs
2. The type of support they're seeking
3. Their communication style and preferences
4. Any signs of crisis or urgent need

Respond in this exact JSON format:
{
  "sentiment": "positive|negative|neutral|urgent|confused|crisis_risk",
  "detectedNeeds": ["need1", "need2", "need3"],
  "recommendedPersona": "persona_id",
  "confidence": 85,
  "rationale": "Detailed explanation of why this persona is best suited for the user"
}

Priority rules:
- If crisis_risk or urgent detected, prioritize crisis support
- If user needs emotional validation and listening, prioritize listener
- If user seeks advice and solutions, prioritize guide
- If user wants distraction and light conversation, prioritize companion
- Default to listener if unsure`;

        const result = await personaObserverModel.generateContent(personaPrompt);
        const response = result.response.text();

        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const recommendedPersonaId = parsed.recommendedPersona || "listener";
            const selectedPersonaData = personasConfig.personas[recommendedPersonaId] || personasConfig.personas.listener;
            
            selectedPersona = selectedPersonaData.id;
            personaSystemInstruction = selectedPersonaData.systemInstruction;
          }
        } catch (parseError) {
          logger.error("Error parsing persona selection response:", parseError);
          // Continue with default listener persona
        }
      } catch (error) {
        logger.error("Error in persona selection:", error);
        // Continue with default listener persona
      }

      // Build complete system instruction
      let systemInstructionText = `
${personaSystemInstruction}

**LANGUAGE REQUIREMENT:** ${conversationPreferences?.language === "filipino" ? "You MUST respond in Filipino language only. All your responses should be in Filipino." : "You MUST respond in English language only. All your responses should be in English."}

**Crucial Ethical and Professional Guidelines:**
1. **Strictly Adhere to Boundaries:** You are an AI and explicitly **not** a human therapist, medical professional, or crisis counselor. You **must** clearly state this disclaimer at the beginning of the session and if the user expresses a need for professional help or indicates a crisis.
2. **Safety First (Crisis Protocol):** If the user expresses any indication of suicidal thoughts, self-harm, harm to others, or severe distress requiring immediate intervention, you **must** interrupt the conversation to provide emergency contact information (e.g., "If you are in immediate danger, please contact 911 or a crisis hotline like the National Suicide Prevention Lifeline at 988."). Do not attempt to "treat" or "diagnose" a crisis; instead, prioritize immediate safety resources.
3. **No Diagnosis or Medical Advice:** You **do not diagnose mental health conditions, prescribe medication, or offer specific medical treatments.** Your role is supportive and educational.
4. **Confidentiality (Simulation Context):** In this simulation, you operate under the understanding that user data is being processed *for the purpose of this simulation only* and *is not real client data*. Acknowledge that in a real-world scenario, privacy and data security are paramount.
5. **Personalization with Care:** Refer to the user's preferred name occasionally if available (${
        initialForm?.preferredName ? initialForm.preferredName : "you"
      }). Use this naturally, not robotically.
6. **Session Context:** ${followupFormAnswers ? 'This is a follow-up session. When a user\'s previous session follow-up form is provided, naturally reference their responses to show continuity between sessions. Acknowledge any progress, changes, or concerns they mentioned.' : 'This is the first session with this user. Do not reference previous conversations or ask about how they\'ve been feeling since we last spoke, as this is a new therapeutic relationship.'}
`;

      // Add conversation preferences
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

        if (prefs.mainEnableTTS) {
          prefsText += getAudioInstruction(prefs.mainTTSModel);
        }

        systemInstructionText += prefsText;
      }

      systemInstructionText += `
**Expected Response Structure:**
Your response should be a natural, conversational reply.
${
        conversationPreferences?.mainEnableTTS
          ? "- Keep responses very brief (1-2 sentences maximum) for optimal audio generation.\n"
          : "- Keep responses brief and to the point (2-4 sentences maximum).\n"
      }- Acknowledge feelings simply and directly.
- Focus on one key insight or question per response.
- Avoid lengthy explanations or therapeutic jargon.
- Do not provide a JSON output; just the conversational text.
`;

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

        await stream.writeSSE({
          event: "persona_selected",
          data: JSON.stringify({
            personaId: selectedPersona,
            systemInstruction: personaSystemInstruction
          })
        });

        let aiResponseText = "";
        try {
          const result = await chatSession.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            aiResponseText += chunkText;
            await stream.writeSSE({ data: chunkText });
          }
          
          if (currentSessionId) {
            await db.insert(messages).values({
              sessionId: sessionIdNum,
              threadType: "main",
              sender: "ai",
              text: aiResponseText,
              timestamp: new Date(),
            });
            await db
              .update(sessions)
              .set({ updatedAt: new Date() })
              .where(eq(sessions.id, sessionIdNum));

            await savePersonaConversationToFile(
              selectedPersona,
              sessionIdNum,
              message,
              aiResponseText,
              model.systemInstruction?.parts[0].text || "",
              conversationHistory
            );
          }
        } catch (error) {
          logger.error("Error during AI streaming or saving AI response:", error);
          await stream.writeSSE({
            data: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      });
    }
  )
  // Get available personas
  .get("/personas", async (c) => {
    try {
      await loadPersonasConfig();
      const personas = Object.values(personasConfig.personas).map((persona: any) => ({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        suitableFor: persona.suitableFor
      }));
      
      return c.json({ personas });
    } catch (error) {
      logger.error("Error fetching personas:", error);
      return c.json({ error: "Failed to fetch personas" }, 500);
    }
  })
  // Get messages for a session
  .get("/messages/:sessionId", async (c) => {
    try {
      const sessionId = parseInt(c.req.param("sessionId"));
      if (isNaN(sessionId)) {
        return c.json({ error: "Invalid session ID" }, 400);
      }

      const sessionMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);

      return c.json(sessionMessages);
    } catch (error) {
      logger.error("Error fetching session messages:", error);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
  })
  // Check crisis status for a session
  .get("/crisis/:sessionId", async (c) => {
    try {
      const sessionId = parseInt(c.req.param("sessionId"));
      if (isNaN(sessionId)) {
        return c.json({ error: "Invalid session ID" }, 400);
      }

      // Get recent messages for crisis analysis
      const recentMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp)
        .limit(10);

      // Simple crisis detection based on message content
      const crisisKeywords = [
        "suicidal", "suicide", "kill myself", "end my life", "hurt myself",
        "self-harm", "want to die", "can't go on", "no reason to live"
      ];

      const crisisDetected = recentMessages.some(msg => 
        crisisKeywords.some(keyword => 
          msg.text.toLowerCase().includes(keyword.toLowerCase())
        )
      );

      return c.json({ crisisDetected });
    } catch (error) {
      logger.error("Error checking crisis status:", error);
      return c.json({ error: "Failed to check crisis status" }, 500);
    }
  });

export default personaCards;
export type PersonaCardsType = typeof personaCards;