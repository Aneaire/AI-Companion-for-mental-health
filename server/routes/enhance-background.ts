// enhance-background.ts (Background Information Enhancer)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { geminiConfig } from "../lib/config";
import { logger } from "../lib/logger";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define schema for background enhancement request
export const enhanceBackgroundRequestSchema = z.object({
  problemDescription: z.string().min(1, "Problem description is required"),
  currentBackground: z.string().optional(), // Existing background info if any
  customizationInstructions: z.string().optional(), // User's specific instructions for enhancement
});

export const enhanceBackgroundResponseSchema = z.object({
  enhancedBackground: z.string(),
  suggestions: z.array(z.string()),
});

const enhanceBackground = new Hono().post(
  "/",
  zValidator("json", enhanceBackgroundRequestSchema),
  async (c) => {
    const parsed = enhanceBackgroundRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      logger.error("Zod validation error:", parsed.error.errors);
      return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
    }

    const { problemDescription, currentBackground, customizationInstructions } = parsed.data;

    try {
      const enhancementResult = await enhanceBackgroundWithAI(problemDescription, currentBackground, customizationInstructions);
      return c.json(enhancementResult);
    } catch (error) {
      logger.error("Error in background enhancement:", error);
      return c.json(
        {
          error: "Failed to enhance background information",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

// AI-powered background enhancement
async function enhanceBackgroundWithAI(
  problemDescription: string,
  currentBackground?: string,
  customizationInstructions?: string
) {
  const model = gemini.getGenerativeModel({
    model: geminiConfig.twoPoint5FlashLite,
  });

  const systemInstructionText = `You are an expert therapeutic background information enhancer. Your role is to take a person's problem description and create comprehensive, supportive background context that helps therapists better understand their situation.

**IMPORTANT GUIDELINES:**
- Focus on creating context that enhances therapeutic understanding
- Be empathetic, professional, and non-judgmental
- Infer reasonable background details from the problem description
- Avoid making assumptions that could be harmful or stereotypical
- Keep the enhanced background concise but comprehensive (200-400 words)
- Structure the information in a way that's helpful for therapeutic assessment
- Include relevant life context, relationships, work/school situation, coping mechanisms, etc.
- Use supportive, understanding language

**OUTPUT FORMAT:**
Provide the enhanced background as a cohesive paragraph, followed by 3-5 specific suggestions for additional information that could be helpful.

Respond in this exact JSON format:
{
  "enhancedBackground": "The enhanced background information as a single cohesive paragraph...",
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
  ]
}`;

  const prompt = `Please enhance the following problem description with comprehensive background context:

**Problem Description:**
${problemDescription}

${currentBackground ? `**Current Background Information:**
${currentBackground}

**Task:** Enhance and expand upon the existing background information.` : '**Task:** Create comprehensive background context based on the problem description.'}

${customizationInstructions ? `**User's Customization Instructions:**
${customizationInstructions}

**Important:** Follow the user's specific instructions above while maintaining therapeutic appropriateness and professionalism.` : ''}

Create a detailed background that provides therapeutic context, including:
- Life circumstances and current situation
- Key relationships and support systems
- Work, school, or daily routine context
- Current coping strategies or challenges
- Any relevant history that might inform the therapeutic approach

Make the background information comprehensive yet focused on therapeutic relevance.${customizationInstructions ? ' Remember to incorporate the user\'s specific customization instructions.' : ''}`;

  const chatSession = model.startChat({
    history: [{
      role: "user",
      parts: [{ text: systemInstructionText }]
    }],
    generationConfig: {
      maxOutputTokens: 1500,
    },
  });

  try {
    const result = await chatSession.sendMessage(prompt);
    const response = result.response.text();

    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and return the response
    return {
      enhancedBackground: parsed.enhancedBackground || "Unable to generate enhanced background information.",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["Consider sharing more about your daily life", "Additional context about relationships could be helpful", "Information about work or school situation would be valuable"],
    };
  } catch (parseError) {
    logger.error("Error parsing Gemini response:", parseError);

    // Fallback response
    return {
      enhancedBackground: `Based on the description provided, this appears to be a situation involving ${problemDescription.substring(0, 100)}... The individual may benefit from exploring coping strategies and building support systems. ${currentBackground ? `Additional context includes: ${currentBackground}` : ''}`,
      suggestions: [
        "Consider sharing more about your daily routine and responsibilities",
        "Information about key relationships could provide valuable context",
        "Details about how this situation affects your work or studies would be helpful",
        "Any current coping strategies or support systems you're using",
        "Recent changes in your life that might be contributing to this situation"
      ],
    };
  }
}

export default enhanceBackground;
export type EnhanceBackgroundType = typeof enhanceBackground;