// chat.ts (AI Response Agent)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { count, eq } from "drizzle-orm";
import fs from "fs";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import path from "path";
import { geminiConfig } from "server/lib/config";
import { z } from "zod";
import { db } from "../db/config";
import { chatSessions, messages } from "../db/schema";

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
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `chat_session_${sessionId}_${timestamp}.txt`;
  const filePath = path.join(process.cwd(), "chat_logs", fileName);

  if (!fs.existsSync(path.join(process.cwd(), "chat_logs"))) {
    fs.mkdirSync(path.join(process.cwd(), "chat_logs"));
  }

  const content = `Session ID: ${sessionId}
Timestamp: ${timestamp}

System Instructions:
${systemInstructions}

Conversation History:
${conversationHistory
  .map((msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`)
  .join("\n\n")}

User Prompt:
${prompt}

AI Response:
${response}
----------------------------------------
`;

  try {
    await fs.promises.writeFile(filePath, content, "utf8");
    console.log(`Conversation saved to ${fileName}`);
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
  sessionId: z.number().optional(), // Existing session ID for ongoing chats
  strategy: z.string().optional(), // Added for strategy from the agent
  nextSteps: z.array(z.string()).optional(), // Added for next steps from the agent
  observerRationale: z.string().optional(), // Added for observer rationale
  observerNextSteps: z.array(z.string()).optional(), // Added for observer next steps
  sentiment: z.string().optional(), // Added for sentiment analysis
  sender: z.string().optional(), // Added for sender
});

const chat = new Hono()
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
    } = parsed.data;
    let currentSessionId = sessionId;

    if (initialForm) {
      if (!currentSessionId) {
        return c.json(
          { error: "Session ID is required for initial form submission" },
          400
        );
      }

      const session = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, currentSessionId))
        .limit(1);

      if (
        session.length === 0 ||
        String(session[0].userId) !== String(userId)
      ) {
        return c.json({ error: "Invalid session or unauthorized" }, 403);
      }
    } else if (!currentSessionId) {
      return c.json(
        { error: "Session ID is required for ongoing chats." },
        400
      );
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
    if (message && currentSessionId) {
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
          sender: safeSender,
          text: message,
          timestamp: new Date(),
        });
        // Update chat session's updated_at
        await db
          .update(chatSessions)
          .set({ updatedAt: new Date() })
          .where(eq(chatSessions.id, currentSessionId));
      } catch (error) {
        console.error("Error saving user message:", error);
      }
      // Count messages and run summary logic if needed
      const msgCountRes = await db
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.sessionId, currentSessionId));
      const msgCount = msgCountRes[0]?.count || 0;
      if (msgCount > 0 && msgCount % 10 === 0) {
        try {
          const summaryPrompt =
            "Summarize the following conversation in 3-5 sentences, focusing on the main concerns, emotions, and any progress or advice given.\n\n" +
            conversationHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`)
              .join("\n\n");
          const summaryModel = gemini.getGenerativeModel({
            model: geminiConfig.model,
          });
          const summaryResult = await summaryModel.generateContent(
            summaryPrompt
          );
          const summaryText =
            summaryResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
            "";
          await db
            .update(chatSessions)
            .set({ summaryContext: summaryText })
            .where(eq(chatSessions.id, currentSessionId));
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
          .update(chatSessions)
          .set({ summaryContext: summaryText })
          .where(eq(chatSessions.id, currentSessionId));
      } catch (err) {
        console.error("Error generating or saving initial summary:", err);
      }
    }

    let systemInstructionText = `
You are a highly empathetic, supportive, and non-judgmental AI mental health companion. Your primary role is to listen actively, validate feelings, offer thoughtful reflections, and provide general coping strategies or guidance when appropriate. You are NOT a licensed therapist, medical professional, or crisis counselor, and you must clearly state this if the user expresses a need for professional help or is in crisis.

**Core Principles for Interaction:**
1.  **Empathetic Listening & Validation:** Always start by acknowledging and validating the user's feelings. Make them feel heard and understood.
2.  **Non-Judgmental & Safe Space:** Maintain a consistently safe, open, and non-judgmental environment.
3.  **Personalization:** Refer to the user's preferred name occasionally if available (${
      initialForm?.preferredName ? initialForm.preferredName : "you"
    }).
4.  **Contextual Relevance:** Integrate information from the initial form and conversation history seamlessly.
5.  **Proactive Support (when appropriate):** Offer relevant, general coping strategies, reflections, or gentle thought-provoking questions.
6.  **Concise & Clear:** Keep responses focused and easy to understand. Avoid jargon.
7.  **Ethical Boundaries:**
    * **Do not diagnose.**
    * **Do not provide medical advice or prescribe treatments.**
    * **If the user expresses suicidal thoughts, self-harm, or severe distress, immediately prioritize safety by stating that you are an AI and cannot provide professional help, and direct them to emergency services or a mental health crisis hotline.**
    * Always remind the user that you are an AI and not a substitute for professional help.
8.  **Adapt to User Preferences:** Pay attention to preferred response tone, character, or style from the initial form.
`;

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
      console.log("Crisis protocol triggered: streaming crisis message");
      const crisisMessage = `\nIt sounds like you're going through an incredibly difficult time, and I want you to know that support is available. I am an AI and cannot provide professional medical or crisis support. If you are in immediate danger or need urgent help, please reach out to trained professionals:\n\n* **National Suicide Prevention Lifeline:** Call or text 988 (US and Canada)\n* **Crisis Text Line:** Text HOME to 741741 (US)\n* **Emergency Services:** Call your local emergency number (e.g., 911 in the US, 999 in UK, 112 in EU, etc.)\n\nPlease reach out to one of these resources. They are there to help you.\n`;
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({ event: "crisis", data: crisisMessage });
      });
    }

    const model = gemini.getGenerativeModel({
      model: geminiConfig.model,
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
        if (currentSessionId) {
          // Alternate sender for AI-to-AI loop
          const allowedSenders = [
            "user",
            "ai",
            "therapist",
            "impostor",
          ] as const;
          type SenderType = (typeof allowedSenders)[number];
          let aiSender: SenderType = "ai";
          if (sender === "impostor") aiSender = "therapist";
          else if (sender === "therapist") aiSender = "impostor";
          else if (allowedSenders.includes(sender as SenderType))
            aiSender = sender as SenderType;
          await db.insert(messages).values({
            sessionId: currentSessionId,
            sender: aiSender,
            text: aiResponseText,
            timestamp: new Date(),
          });
          // Update chat session's updated_at
          await db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, currentSessionId));

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
  .get(
    "/:sessionId",
    zValidator("param", z.object({ sessionId: z.string().transform(Number) })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const existingMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.sessionId, sessionId))
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
  );

export default chat;
export type ChatType = typeof chat;
