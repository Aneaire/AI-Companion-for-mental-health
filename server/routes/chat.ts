import { GoogleGenerativeAI } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Define the schemas
const chatRequestSchema = z.object({
  message: z.string().min(1),
  contextSummary: z.string().optional(),
  previousAiMessage: z.string().nullable(),
  concern: z
    .object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
    })
    .nullable(),
});

const chatResponseSchema = z.object({
  text: z.string(),
});

const chat = new Hono().post(
  "/",
  zValidator("json", chatRequestSchema),
  async (c) => {
    const { message, contextSummary, previousAiMessage, concern } =
      c.req.valid("json");
    console.log(message, contextSummary, previousAiMessage, concern);

    const instruction = `You're a therapist specializing in cognitive-behavioral therapy (CBT) and active listening. Your goal is to provide empathetic, non-judgmental, and solution-focused guidance to patients. Use open-ended questions, validation, and encouragement to help them explore their thoughts and emotions. Adapt your responses based on their concerns, and avoid diagnosing or giving medical advice. Maintain a warm and professional tone throughout the conversation.
If the user mentions ${concern?.label.toLowerCase()}, use your knowledge of the concern to provide relevant support.`;

    const prompt = `
${instruction}

Summary of the conversation so far:
${contextSummary || "None yet."}

Recent exchange:
User: ${message}
${previousAiMessage ? `AI: ${previousAiMessage}` : ""}
`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContentStream(prompt);

      // Create a streaming response
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const text = chunk.text();
              controller.enqueue(new TextEncoder().encode(text));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain",
          "Transfer-Encoding": "chunked",
        },
      });
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return c.json({ error: "Failed to generate response" }, 500);
    }
  }
);

export default chat;
export type ChatType = typeof chat;
