import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { db } from "../db/config";
import { chatSessions, messages, users } from "../db/schema";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); // Corrected API Key Access

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
  userId: z.number().optional(), // Assuming userId will be passed from frontend
  sessionId: z.number().optional(), // Existing session ID for ongoing chats
});

const chatResponseSchema = z.object({
  text: z.string(),
});

const chat = new Hono()
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const parsed = chatRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      console.error("Zod validation error:", parsed.error.errors);
      return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
    }

    const { initialForm, context, message, userId, sessionId } = parsed.data;
    let currentSessionId = sessionId;

    // Handle initial form submission and create a new chat session
    if (initialForm) {
      try {
        // Check if default user exists, if not create one
        const defaultUser = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, "default_user"))
          .limit(1);

        let userId = defaultUser[0]?.id;

        if (!userId) {
          const [newUser] = await db
            .insert(users)
            .values({
              clerkId: "default_user",
              email: "default@example.com",
              nickname: "Default User",
              firstName: "Default",
              lastName: "User",
              age: 18,
              status: "active",
              hobby: "",
            })
            .returning();
          userId = newUser.id;
        }

        const [newSession] = await db
          .insert(chatSessions)
          .values({
            userId: userId,
            preferredName: initialForm.preferredName || null,
            currentEmotions: initialForm.currentEmotions || null,
            reasonForVisit: initialForm.reasonForVisit,
            supportType: initialForm.supportType || null,
            supportTypeOther: initialForm.supportTypeOther || null,
            additionalContext: initialForm.additionalContext || null,
            responseTone: initialForm.responseTone || null,
            imageResponse: initialForm.imageResponse || null,
          })
          .returning();
        currentSessionId = newSession.id;

        // Save the initial user message (from the form submission)
        // await db.insert(messages).values({
        //   sessionId: currentSessionId,
        //   sender: "user",
        //   text: message,
        //   timestamp: new Date(),
        // });
      } catch (error) {
        console.error("Error creating chat session or initial message:", error);
        return c.json(
          {
            error: `Failed to start chat session: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
          500
        );
      }
    } else if (!currentSessionId) {
      return c.json(
        { error: "Session ID is required for ongoing chats." },
        400
      );
    }

    // Prepare conversation history for the AI
    const conversationHistory: Content[] = [];

    // Add initial form context to the AI prompt if available
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

      conversationHistory.push({
        role: "user",
        parts: [{ text: initialContextString }],
      });
    }

    // Add previous messages from context
    if (context) {
      context.forEach((msg) => {
        conversationHistory.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.text }],
        });
      });
    }

    // Add the current user message
    // Ensure conversation history always starts with a user role for Gemini API
    if (
      conversationHistory.length > 0 &&
      conversationHistory[0].role === "model"
    ) {
      conversationHistory.unshift({ role: "user", parts: [{ text: "" }] }); // Prepend a dummy user message
    }

    conversationHistory.push({ role: "user", parts: [{ text: message }] });

    // Save the current user message to the database (if it's not the initial form submission message handled above)
    if (!initialForm && currentSessionId) {
      try {
        await db.insert(messages).values({
          sessionId: currentSessionId,
          sender: "user",
          text: message,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error saving user message:", error);
      }
    }

    // Do not remove any conditions in the parts[{text}]
    const model = gemini.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: {
        role: "model",
        parts: [
          {
            text: `You are a compassionate and supportive companion, designed to assist users in a conversational and empathetic manner. Your goal is to provide helpful, relevant, and concise responses that align with the user's emotional state, needs, and preferences. Use the following guidelines:
    
    1. **Personalization**: If the user provides a preferred name, use it occasionally to make responses feel personal (e.g., "I'm here for you, [Name]"). If no name is provided, use neutral but warm language.
    2. **Emotional Awareness**: Adapt your tone based on the user's stated emotions (e.g., if they're feeling "anxious," acknowledge this gently and offer calming or reassuring responses). If no emotions are provided, maintain a supportive and understanding tone.
    3. **Context-Driven Responses**: Tailor your responses to the user's reason for visit and desired support type (e.g., "emotional support," "problem-solving"). If additional context or specific support details are provided, incorporate them naturally into your response.
    4. **Tone Adjustment**: Match the user's preferred response tone (e.g., "casual," "formal," "encouraging") if specified. If no tone is provided, use a warm, conversational, and empathetic tone.
    5. **Conversational Flow**: Continue the conversation naturally, referencing prior messages in the conversation history when relevant. Do not repeat greetings, introductions, or redundant phrases unless appropriate.
    6. **Clarity and Brevity**: Keep responses clear, concise, and focused on the user's query or needs. Avoid overly long explanations unless the user requests detailed information.
    7. **Grounded Responses**: Base your responses solely on the provided conversation history and user input. Do not invent or assume information not explicitly provided.
    8. **Image Reflection**: If the user provides a reflection on an image, acknowledge it thoughtfully and connect it to their reason for visit or emotions when relevant.
    9. **Edge Cases**: If the user's message is vague or empty, gently prompt for clarification (e.g., "Could you share a bit more about what's on your mind? I'm here to help.") while maintaining a supportive tone.
    
    Example response structure:
    - Acknowledge the user's input or emotions briefly.
    - Provide a relevant, empathetic response or suggestion.
    - Optionally, ask a gentle follow-up question to deepen the conversation.
    
    Always aim to make the user feel heard, supported, and understood.`,
          },
        ],
      },
    });

    const chatSession = model.startChat({
      history: conversationHistory,
      generationConfig: {
        maxOutputTokens: 2000,
      },
    });

    return streamSSE(c, async (stream) => {
      // Send session ID as the first event if it's a new session
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
        // Save AI's full response to the database
        if (currentSessionId) {
          await db.insert(messages).values({
            sessionId: currentSessionId,
            sender: "ai",
            text: aiResponseText,
            timestamp: new Date(),
          });
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
            role: msg.sender === "ai" ? "model" : "user",
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
          })) as { role: "user" | "model"; text: string; timestamp: number }[]
        );
      } catch (error) {
        console.error("Error fetching chat session messages:", error);
        return c.json({ error: "Failed to fetch chat session messages." }, 500);
      }
    }
  );

export default chat;
export type ChatType = typeof chat;
