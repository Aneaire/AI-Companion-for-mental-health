import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/config";
import { impostorProfiles } from "../db/schema";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const profileSchema = z.object({
  userId: z.number(),
  fullName: z.string(),
  age: z.string(),
  problemDescription: z.string(),
  background: z.string().optional(),
  personality: z.string().optional(),
});

export const impostorRoute = new Hono()
  // Get profile by userId
  .get("/profile", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId is required" }, 400);
    const profile = await db
      .select()
      .from(impostorProfiles)
      .where(eq(impostorProfiles.userId, parseInt(userId)));
    if (!profile.length) return c.json(null);
    return c.json(profile[0]);
  })
  // Create or update profile
  .post("/profile", async (c) => {
    const body = await c.req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }
    // Upsert: if exists, update; else, insert
    const existing = await db
      .select()
      .from(impostorProfiles)
      .where(eq(impostorProfiles.userId, parsed.data.userId));
    let result;
    if (existing.length) {
      result = await db
        .update(impostorProfiles)
        .set({
          fullName: parsed.data.fullName,
          age: parsed.data.age,
          problemDescription: parsed.data.problemDescription,
          background: parsed.data.background,
          personality: parsed.data.personality,
          updatedAt: new Date(),
        })
        .where(eq(impostorProfiles.userId, parsed.data.userId))
        .returning();
    } else {
      result = await db
        .insert(impostorProfiles)
        .values({
          userId: parsed.data.userId,
          fullName: parsed.data.fullName,
          age: parsed.data.age,
          problemDescription: parsed.data.problemDescription,
          background: parsed.data.background,
          personality: parsed.data.personality,
        })
        .returning();
    }
    return c.json(result[0]);
  })
  // Impostor chat endpoint
  .post("/chat", async (c) => {
    const body = await c.req.json();
    const schema = z.object({
      sessionId: z.number(),
      message: z.string(),
      userProfile: profileSchema,
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    const { message, userProfile } = parsed.data;

    // Create the system prompt for the impostor
    const systemPrompt = `You are roleplaying as a person seeking therapy. Here is your profile:

Name: ${userProfile.fullName}
Age: ${userProfile.age}
Current Situation: ${userProfile.problemDescription}
${userProfile.background ? `Background: ${userProfile.background}` : ""}
${
  userProfile.personality
    ? `Personality Traits: ${userProfile.personality}`
    : ""
}

IMPORTANT GUIDELINES:
1. Stay completely in character as ${userProfile.fullName}
2. Express thoughts and feelings naturally, as someone seeking therapy would
3. Respond to the therapist's questions and insights thoughtfully
4. Show appropriate emotional depth based on your background
5. Maintain consistency with your profile details
6. Use natural, conversational language
7. NEVER break character or acknowledge being an AI

The following is a message from your therapist. Respond as ${
      userProfile.fullName
    }:

${message}`;

    try {
      // Get response from Gemini
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(systemPrompt);
      const response = result.response.text();

      // Return the response
      return c.json({ response });
    } catch (error) {
      console.error("Error generating impostor response:", error);
      return c.json({ error: "Failed to generate response" }, 500);
    }
  });

export default impostorRoute;
