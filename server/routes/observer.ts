// agent.ts (User Strategist Agent)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { geminiConfig } from "../lib/config";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define schema for agent request
export const agentRequestSchema = z.object({
  messages: z.array(
    z.object({
      text: z.string(),
      sender: z.enum(["user", "ai"]), // Ensure sender type is either 'user' or 'ai'
    })
  ),
  initialForm: z
    .object({
      // Add initial form context for richer analysis
      preferredName: z.string().optional(),
      currentEmotions: z.array(z.string()).optional(),
      reasonForVisit: z.string().optional(),
      supportType: z.array(z.string()).optional(),
      additionalContext: z.string().optional(),
    })
    .optional(),
});

export const agentResponseSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral", "urgent", "confused"]), // Expanded sentiment types
  strategy: z.string(),
  rationale: z.string(),
  next_steps: z.array(z.string()),
});

const agent = new Hono().post(
  "/",
  zValidator("json", agentRequestSchema),
  async (c) => {
    const parsed = agentRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      console.error("Zod validation error:", parsed.error.errors);
      return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
    }

    const { messages, initialForm } = parsed.data;

    try {
      // Use Gemini for sentiment and strategy analysis
      const { sentiment, strategy, rationale, next_steps } =
        await analyzeWithGemini(messages, initialForm);

      return c.json({ sentiment, strategy, rationale, next_steps });
    } catch (error) {
      console.error("Error in agent analysis:", error);
      return c.json({
        sentiment: "neutral",
        strategy: "Continue with supportive conversation",
        rationale:
          "Unable to analyze sentiment, maintaining supportive approach",
        next_steps: ["Continue listening and providing support"],
      });
    }
  }
);

// --- Gemini-powered Analysis ---
async function analyzeWithGemini(
  messages: { text: string; sender: string }[],
  initialForm?: {
    preferredName?: string;
    currentEmotions?: string[];
    reasonForVisit?: string;
    supportType?: string[];
    additionalContext?: string;
  }
): Promise<{
  sentiment: "positive" | "negative" | "neutral" | "urgent" | "confused";
  strategy: string;
  rationale: string;
  next_steps: string[];
}> {
  const model = gemini.getGenerativeModel({
    model: geminiConfig.twoPoint5FlashLite,
  });

  // Build context string from initial form
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

  // Get recent conversation (last 5 messages for context)
  const recentMessages = messages.slice(-5);
  const conversationText = recentMessages
    .map((msg) => `${msg.sender === "user" ? "User" : "AI"}: ${msg.text}`)
    .join("\n");

  const prompt = `You are an AI mental health strategist analyzing a conversation to provide guidance for the AI companion.

Context about the user:
${contextString}

Recent conversation:
${conversationText}

Analyze the user's current emotional state and provide strategic guidance for the AI companion. Consider:
1. The user's emotional state (positive, negative, neutral, urgent, confused)
2. What the user needs most right now
3. The best approach for the AI companion to take

Respond in this exact JSON format:
{
  "sentiment": "positive|negative|neutral|urgent|confused",
  "strategy": "A clear, actionable strategy for the AI companion",
  "rationale": "Why this strategy is appropriate given the user's state",
  "next_steps": ["Step 1", "Step 2", "Step 3", "Step 4"]
}

Focus on being empathetic, practical, and actionable. If the user seems in crisis or urgent need, prioritize safety and professional help.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  try {
    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and return the response
    return {
      sentiment: parsed.sentiment || "neutral",
      strategy: parsed.strategy || "Continue with supportive conversation",
      rationale: parsed.rationale || "Maintaining supportive approach",
      next_steps: Array.isArray(parsed.next_steps)
        ? parsed.next_steps
        : ["Continue listening and providing support"],
    };
  } catch (parseError) {
    console.error("Error parsing Gemini response:", parseError);
    console.error("Raw response:", response);

    // Fallback to basic analysis
    return {
      sentiment: "neutral",
      strategy: "Continue with supportive conversation",
      rationale: "Unable to parse AI analysis, maintaining supportive approach",
      next_steps: ["Continue listening and providing support"],
    };
  }
}

export default agent;
export type AgentType = typeof agent;
