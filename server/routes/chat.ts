// chat.ts (AI Response Agent)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
import fs from "fs";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { geminiConfig } from "server/lib/config";
import { z } from "zod";
import { db } from "../db/config";
import { impersonateThread, messages, sessions, threads } from "../db/schema";

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
    const fileName = `chat_logs/conversation_${sessionId}_${Date.now()}.md`;
    const content = `# Chat Conversation - Session ${sessionId}

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
    console.error("Error saving conversation to file:", error);
  }
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
      briefAndConcise: z.boolean().optional(),
      empatheticAndSupportive: z.boolean().optional(),
      solutionFocused: z.boolean().optional(),
      casualAndFriendly: z.boolean().optional(),
      professionalAndFormal: z.boolean().optional(),
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
  strategy: z.string().optional(), // Added for strategy from the agent
  nextSteps: z.array(z.string()).optional(), // Added for next steps from the agent
  observerRationale: z.string().optional(), // Added for observer rationale
  observerNextSteps: z.array(z.string()).optional(), // Added for observer next steps
  sentiment: z.string().optional(), // Added for sentiment analysis
  sender: z.string().optional(), // Added for sender
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

const chat = new Hono()
  // Main chat endpoint (session-based)
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const rawBody = await c.req.json();
    const parsed = chatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.error("Zod validation error:", parsed.error.errors);
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

    if (initialForm) {
      if (!currentSessionId) {
        return c.json(
          { error: "Session ID is required for initial form submission" },
          400
        );
      }

      // Validate session exists, user has access, and session is active
      const sessionData = await db
        .select({
          session: sessions,
          thread: threads,
        })
        .from(sessions)
        .innerJoin(threads, eq(sessions.threadId, threads.id))
        .where(eq(sessions.id, currentSessionId))
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
      // For ongoing chats, validate session exists, user has access, and session is active
      const sessionData = await db
        .select({
          session: sessions,
          thread: threads,
        })
        .from(sessions)
        .innerJoin(threads, eq(sessions.threadId, threads.id))
        .where(eq(sessions.id, currentSessionId))
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
    }

    if (
      conversationHistory.length > 0 &&
      conversationHistory[0].role === "model"
    ) {
      conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
    }

    conversationHistory.push({ role: "user", parts: [{ text: message }] });

    // Always save the user message if there is a message and a session
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
          sessionId: currentSessionId,
          threadType: threadType || "main",
          sender: safeSender,
          text: message,
          timestamp: new Date(),
        });
        // Update session's updated_at
        await db
          .update(sessions)
          .set({ updatedAt: new Date() })
          .where(eq(sessions.id, currentSessionId));
      } catch (error) {
        console.error("Error saving user message:", error);
      }
      // Count messages and run summary logic if needed
      const msgCountRes = await db
        .select({ count: count() })
        .from(messages)
        .where(
          and(
            eq(messages.sessionId, currentSessionId),
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
            .where(eq(sessions.id, currentSessionId));
        } catch (err) {
          console.error("Error generating or saving summary:", err);
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
          .where(eq(sessions.id, currentSessionId));
      } catch (err) {
        console.error("Error generating or saving initial summary:", err);
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
6.  **Empathetic and Reflective Listening:** Always start by acknowledging and validating the user's expressed emotions and thoughts. Show you've truly heard them before responding. Use phrases like "It sounds like you're feeling..." or "I hear you saying..."
7.  **Guidance and Exploration:** Offer relevant, general coping strategies, gentle thought-provoking questions, and reflections to help the user explore their feelings and situations more deeply. Encourage self-discovery.
8.  **Concise, Clear, and Human-like Language:** Keep responses focused, natural, and easy to understand. Avoid jargon or overly clinical language unless specifically requested by the user's persona. Your tone should be warm, compassionate, and authentic, reflecting a human therapist's mannerisms.
9.  **Adapt to User Preferences:** Pay close attention to preferred response tone, character, or style from the initial form and subtly weave it into your communication style.
`;

    // Add conversationPreferences to the prompt if present
    if (
      typeof conversationPreferences === "object" &&
      conversationPreferences !== null
    ) {
      const prefs = conversationPreferences;
      let prefsText = "\n**User Conversation Preferences:**\n";
      if (prefs.briefAndConcise)
        prefsText += "- Keep responses brief and concise.\n";
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
      systemInstructionText += `\n**URGENT USER STATE DETECTED!**\nThe user's sentiment is **${sentiment.toUpperCase()}**. Your ABSOLUTE priority is safety.\n1.  Immediately acknowledge their distress with empathy.\n2.  State clearly: "I am an AI and cannot provide professional medical or crisis support. If you are in immediate danger or need urgent help, please contact [LOCAL EMERGENCY NUMBER, e.g., 911 in the US, or a national crisis hotline like the National Suicide Prevention Lifeline: 988 or Crisis Text Line: Text HOME to 741741 (US)]."\n3.  Gently encourage them to seek professional help.\n4.  Maintain a calm and supportive tone, but do not attempt to "treat" or "diagnose."\n5.  Do NOT end the conversation abruptly, but ensure the crisis information is provided.\n`;
    } else if (sentiment === "negative") {
      systemInstructionText += `\n**User Sentiment: Negative.** Focus on empathetic listening, validation, and gently exploring their feelings. Offer comfort and reassurance.\n`;
    } else if (sentiment === "positive") {
      systemInstructionText += `\n**User Sentiment: Positive.** Acknowledge their positive state. Reinforce positive coping, celebrate small wins, or gently explore what's working well for them.\n`;
    } else if (sentiment === "confused") {
      systemInstructionText += `\n**User Sentiment: Confused.** Provide clear, simplified responses. Offer to rephrase or break down concepts. Ask clarifying questions patiently.\n`;
    }

    systemInstructionText += `\n**Expected Response Structure:**\nYour response should be a natural, conversational reply.\n- Start by acknowledging the user's message and their emotions (if applicable).\n- Integrate the observer's strategy and next steps into your response seamlessly.\n- Offer empathetic support, a relevant insight, or a gentle follow-up question.\n- Avoid repeating information unless for emphasis.\n- Do not provide a JSON output; just the conversational text.\n`;

    // Crisis protocol: stream a crisis message before the AI response if needed
    if (sentiment === "urgent" || sentiment === "crisis_risk") {
      const crisisMessage = `\nIt sounds like you're going through an incredibly difficult time, and I want you to know that support is available. I am an AI and cannot provide professional medical or crisis support. If you are in immediate danger or need urgent help, please reach out to trained professionals:\n\n* **National Suicide Prevention Lifeline:** Call or text 988 (US and Canada)\n* **Crisis Text Line:** Text HOME to 741741 (US)\n* **Emergency Services:** Call your local emergency number (e.g., 911 in the US, 999 in UK, 112 in EU, etc.)\n\nPlease reach out to one of these resources. They are there to help you.\n`;
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({ event: "crisis", data: crisisMessage });
      });
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
            sessionId: currentSessionId,
            threadType: threadType || "main",
            sender: aiSender,
            text: aiResponseText,
            timestamp: new Date(),
          });
          // Update session's updated_at
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, currentSessionId));

          await saveConversationToFile(
            currentSessionId,
            message,
            aiResponseText,
            model.systemInstruction?.parts[0].text || "",
            conversationHistory
          );
        }
      } catch (error) {
        console.error(
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
  // Impersonate chat endpoint (thread-based)
  .post(
    "/impersonate",
    zValidator("json", impersonateChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = impersonateChatRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        console.error("Zod validation error:", parsed.error.errors);
        return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
      }

      const {
        initialForm,
        context,
        message,
        userId,
        threadId,
        strategy,
        nextSteps,
        observerRationale,
        observerNextSteps,
        sentiment,
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
      }

      if (
        conversationHistory.length > 0 &&
        conversationHistory[0].role === "model"
      ) {
        conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
      }

      conversationHistory.push({ role: "user", parts: [{ text: message }] });

      // Save the user message if there is a message
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
        } catch (error) {
          console.error("Error saving user message:", error);
        }
      }

      let systemInstructionText = `
You are an AI designed to realistically roleplay as a highly empathetic, supportive, and non-judgmental **licensed mental health therapist**. Your primary role is to listen actively, validate feelings, offer thoughtful reflections, and provide evidence-based, general coping strategies or guidance when appropriate.

**Crucial Ethical and Professional Guidelines:**
1.  **Strictly Adhere to Boundaries:** You are an AI and explicitly **not** a human therapist, medical professional, or crisis counselor. You **must** clearly state this disclaimer at the beginning of the session and if the user expresses a need for professional help or indicates a crisis.
2.  **Safety First (Crisis Protocol):** If the user expresses any indication of suicidal thoughts, self-harm, harm to others, or severe distress requiring immediate intervention, you **must** interrupt the conversation to provide emergency contact information (e.g., "If you are in immediate danger, please contact 911 or a crisis hotline like the National Suicide Prevention Lifeline at 988."). Do not attempt to "treat" or "diagnose" a crisis; instead, prioritize immediate safety resources.
3.  **No Diagnosis or Medical Advice:** You **do not diagnose mental health conditions, prescribe medication, or offer specific medical treatments.** Your role is supportive and educational.
4.  **Confidentiality (Simulation Context):** In this simulation, you operate under the understanding that user data is being processed *for the purpose of this simulation only* and *is not real client data*. Acknowledge that in a real-world scenario, privacy and data security are paramount.
5.  **Personalization with Care:** Refer to the user's preferred name occasionally if available(${
        initialForm?.preferredName ? initialForm.preferredName : "you"
      }). Use this naturally, not robotically.
6.  **Empathetic and Reflective Listening:** Always start by acknowledging and validating the user's expressed emotions and thoughts. Show you've truly heard them before responding. Use phrases like "It sounds like you're feeling..." or "I hear you saying..."
7.  **Guidance and Exploration:** Offer relevant, general coping strategies, gentle thought-provoking questions, and reflections to help the user explore their feelings and situations more deeply. Encourage self-discovery.
8.  **Concise, Clear, and Human-like Language:** Keep responses focused, natural, and easy to understand. Avoid jargon or overly clinical language unless specifically requested by the user's persona. Your tone should be warm, compassionate, and authentic, reflecting a human therapist's mannerisms.
9.  **Adapt to User Preferences:** Pay close attention to preferred response tone, character, or style from the initial form and subtly weave it into your communication style.
`;

      // Add conversationPreferences to the prompt if present
      if (
        typeof conversationPreferences === "object" &&
        conversationPreferences !== null
      ) {
        const prefs = conversationPreferences;
        let prefsText = "\n**User Conversation Preferences:**\n";
        if (prefs.briefAndConcise)
          prefsText += "- Keep responses brief and concise.\n";
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
        systemInstructionText += `\n**URGENT USER STATE DETECTED!**\nThe user's sentiment is **${sentiment.toUpperCase()}**. Your ABSOLUTE priority is safety.\n1.  Immediately acknowledge their distress with empathy.\n2.  State clearly: "I am an AI and cannot provide professional medical or crisis support. If you are in immediate danger or need urgent help, please contact [LOCAL EMERGENCY NUMBER, e.g., 911 in the US, or a national crisis hotline like the National Suicide Prevention Lifeline: 988 or Crisis Text Line: Text HOME to 741741 (US)]."\n3.  Gently encourage them to seek professional help.\n4.  Maintain a calm and supportive tone, but do not attempt to "treat" or "diagnose."\n5.  Do NOT end the conversation abruptly, but ensure the crisis information is provided.\n`;
      } else if (sentiment === "negative") {
        systemInstructionText += `\n**User Sentiment: Negative.** Focus on empathetic listening, validation, and gently exploring their feelings. Offer comfort and reassurance.\n`;
      } else if (sentiment === "positive") {
        systemInstructionText += `\n**User Sentiment: Positive.** Acknowledge their positive state. Reinforce positive coping, celebrate small wins, or gently explore what's working well for them.\n`;
      } else if (sentiment === "confused") {
        systemInstructionText += `\n**User Sentiment: Confused.** Provide clear, simplified responses. Offer to rephrase or break down concepts. Ask clarifying questions patiently.\n`;
      }

      systemInstructionText += `\n**Expected Response Structure:**\nYour response should be a natural, conversational reply.\n- Start by acknowledging the user's message and their emotions (if applicable).\n- Integrate the observer's strategy and next steps into your response seamlessly.\n- Offer empathetic support, a relevant insight, or a gentle follow-up question.\n- Avoid repeating information unless for emphasis.\n- Do not provide a JSON output; just the conversational text.\n`;

      // Crisis protocol: stream a crisis message before the AI response if needed
      if (sentiment === "urgent" || sentiment === "crisis_risk") {
        const crisisMessage = `\nIt sounds like you're going through an incredibly difficult time, and I want you to know that support is available. I am an AI and cannot provide professional medical or crisis support. If you are in immediate danger or need urgent help, please reach out to trained professionals:\n\n* **National Suicide Prevention Lifeline:** Call or text 988 (US and Canada)\n* **Crisis Text Line:** Text HOME to 741741 (US)\n* **Emergency Services:** Call your local emergency number (e.g., 911 in the US, 999 in UK, 112 in EU, etc.)\n\nPlease reach out to one of these resources. They are there to help you.\n`;
        return streamSSE(c, async (stream) => {
          await stream.writeSSE({ event: "crisis", data: crisisMessage });
        });
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
        let aiResponseText = "";
        try {
          const result = await chatSession.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
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
              let aiSender: SenderType = "ai";
              await db.insert(messages).values({
                threadId: threadId, // Use threadId for impersonate threads
                threadType: "impersonate",
                sender: aiSender,
                text: aiResponseText,
                timestamp: new Date(),
              });

              await saveConversationToFile(
                threadId, // Use threadId for file naming
                message,
                aiResponseText,
                model.systemInstruction?.parts[0].text || "",
                conversationHistory
              );
            } catch (error) {
              console.error("Error saving AI response:", error);
            }
          }
        } catch (error) {
          console.error(
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
        console.error("Error fetching chat session messages:", error);
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
        console.error("Error fetching impersonate thread messages:", error);
        return c.json(
          { error: "Failed to fetch impersonate thread messages." },
          500
        );
      }
    }
  );

export default chat;
export type ChatType = typeof chat;
