// quality.ts (Message Quality Analyzer)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { geminiConfig } from "../lib/config";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define schema for quality analysis request
export const qualityRequestSchema = z.object({
  messages: z.array(
    z.object({
      text: z.string(),
      sender: z.enum(["user", "ai"]),
      timestamp: z.number(),
    })
  ),
  initialForm: z
    .object({
      preferredName: z.string().optional(),
      currentEmotions: z.array(z.string()).optional(),
      reasonForVisit: z.string().optional(),
      supportType: z.array(z.string()).optional(),
      additionalContext: z.string().optional(),
    })
    .optional(),
});

export const qualityResponseSchema = z.object({
  overallProgress: z.number(),
  emotionalStability: z.number(),
  communicationClarity: z.number(),
  problemSolving: z.number(),
  selfAwareness: z.number(),
  qualityScores: z.array(
    z.object({
      timestamp: z.number(),
      score: z.number(),
      category: z.string(),
      message: z.string(),
    })
  ),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const quality = new Hono().post(
  "/",
  zValidator("json", qualityRequestSchema),
  async (c) => {
    const parsed = qualityRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      console.error("Zod validation error:", parsed.error.errors);
      return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
    }

    const { messages, initialForm } = parsed.data;

    try {
      const analysisResult = await analyzeMessageQuality(messages, initialForm);
      return c.json(analysisResult);
    } catch (error) {
      console.error("Error in quality analysis:", error);
      return c.json(
        {
          error: "Failed to analyze message quality",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

// --- Gemini-powered Quality Analysis ---
async function analyzeMessageQuality(
  messages: { text: string; sender: string; timestamp: number }[],
  initialForm?: {
    preferredName?: string;
    currentEmotions?: string[];
    reasonForVisit?: string;
    supportType?: string[];
    additionalContext?: string;
  }
) {
  const model = gemini.getGenerativeModel({
    model: geminiConfig.model,
  });

  // Filter only user messages for analysis
  const userMessages = messages.filter((msg) => msg.sender === "user");

  if (userMessages.length === 0) {
    return {
      overallProgress: 0,
      emotionalStability: 0,
      communicationClarity: 0,
      problemSolving: 0,
      selfAwareness: 0,
      qualityScores: [],
      insights: ["No user messages to analyze"],
      recommendations: ["Continue the conversation to enable analysis"],
    };
  }

  // Build context string from initial form
  let contextString = "";
  if (initialForm) {
    if (initialForm.preferredName)
      contextString += `User's preferred name: ${initialForm.preferredName}\n`;
    if (initialForm.currentEmotions && initialForm.currentEmotions.length > 0) {
      contextString += `User's initial emotions: ${initialForm.currentEmotions.join(
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

  // Format messages for analysis
  const conversationText = userMessages
    .map((msg, index) => `Message ${index + 1}: ${msg.text}`)
    .join("\n\n");

  const prompt = `You are an AI mental health quality analyst evaluating a user's conversation progress and communication quality.

Context about the user:
${contextString}

User Messages (in chronological order):
${conversationText}

Analyze the user's communication quality and progress across these dimensions:
1. Overall Progress (0-100): General improvement in mental health and coping
2. Emotional Stability (0-100): Consistency and regulation of emotions
3. Communication Clarity (0-100): Ability to express thoughts clearly
4. Problem Solving (0-100): Approach to challenges and solutions
5. Self Awareness (0-100): Understanding of own emotions and behaviors

For each message, provide a quality score (0-100) and categorize the primary focus.

Respond in this exact JSON format:
{
  "overallProgress": 75,
  "emotionalStability": 80,
  "communicationClarity": 85,
  "problemSolving": 70,
  "selfAwareness": 75,
  "qualityScores": [
    {
      "timestamp": 1234567890,
      "score": 75,
      "category": "emotional_expression",
      "message": "Message 1"
    }
  ],
  "insights": [
    "User shows improved emotional regulation over time",
    "Communication has become more structured and clear"
  ],
  "recommendations": [
    "Continue practicing mindfulness techniques",
    "Consider journaling to track emotional patterns"
  ]
}

Focus on constructive, supportive analysis that recognizes progress while identifying areas for growth.`;

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
      overallProgress: Math.min(100, Math.max(0, parsed.overallProgress || 0)),
      emotionalStability: Math.min(
        100,
        Math.max(0, parsed.emotionalStability || 0)
      ),
      communicationClarity: Math.min(
        100,
        Math.max(0, parsed.communicationClarity || 0)
      ),
      problemSolving: Math.min(100, Math.max(0, parsed.problemSolving || 0)),
      selfAwareness: Math.min(100, Math.max(0, parsed.selfAwareness || 0)),
      qualityScores: Array.isArray(parsed.qualityScores)
        ? parsed.qualityScores
        : [],
      insights: Array.isArray(parsed.insights)
        ? parsed.insights
        : ["Analysis completed"],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : ["Continue the conversation"],
    };
  } catch (parseError) {
    console.error("Error parsing Gemini response:", parseError);
    console.error("Raw response:", response);

    // Fallback to basic analysis
    return {
      overallProgress: 50,
      emotionalStability: 50,
      communicationClarity: 50,
      problemSolving: 50,
      selfAwareness: 50,
      qualityScores: userMessages.map((msg, index) => ({
        timestamp: msg.timestamp,
        score: 50,
        category: "general",
        message: `Message ${index + 1}`,
      })),
      insights: ["Analysis was limited due to parsing issues"],
      recommendations: ["Continue the conversation for better analysis"],
    };
  }
}

export default quality;
export type QualityType = typeof quality;
