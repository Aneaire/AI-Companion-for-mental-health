import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { geminiConfig } from "server/lib/config";
import { z } from "zod";
import { db } from "../db/config";
import { impersonateThread, messages, persona } from "../db/schema";
import { logger } from "../lib/logger";

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
      .from(persona)
      .where(eq(persona.userId, parseInt(userId)));
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
    // Always insert a new persona
    const result = await db
      .insert(persona)
      .values({
        userId: parsed.data.userId,
        fullName: parsed.data.fullName,
        age: parsed.data.age,
        problemDescription: parsed.data.problemDescription,
        background: parsed.data.background,
        personality: parsed.data.personality,
      })
      .returning();
    return c.json(result[0]);
  })
  // Impostor chat endpoint
  .post("/chat", async (c) => {
    const body = await c.req.json();
    const schema = z.object({
      sessionId: z.number(),
      message: z.string(),
      userProfile: profileSchema,
      preferredName: z.string().optional(),
      conversationPreferences: z
        .object({
          briefAndConcise: z.number().min(0).max(100).optional(),
          empatheticAndSupportive: z.boolean().optional(),
          solutionFocused: z.boolean().optional(),
          casualAndFriendly: z.boolean().optional(),
          professionalAndFormal: z.boolean().optional(),
        })
        .optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    const { message, userProfile, preferredName, conversationPreferences } = parsed.data;

    // Create the system prompt for the impostor
    const characterName = preferredName || userProfile.fullName;
    let systemPrompt = `You are roleplaying as a person seeking therapy. Your name is **${
      characterName
    }**. You are **${userProfile.age}** years old.

**Your Current Life Situation/Core Challenge:** ${
      userProfile.problemDescription
    }
${
  userProfile.background
    ? `**Relevant Background Information:** ${userProfile.background}`
    : ""
}
${
  userProfile.personality
    ? `**Key Personality Traits:** ${userProfile.personality}`
    : ""
}
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
      systemPrompt += prefsText;
    }

    // Check if this is the first message (no therapist input yet)
    const isFirstMessage = !message || message.trim() === "" ||
      message === "Hello, I am here for therapy. I have been struggling with some issues.";

    if (isFirstMessage) {
      // Generate opening statement as the patient
      systemPrompt += `
**Your Goal for this Therapy Session:** To start the conversation by expressing why you're here for therapy and what you're struggling with. Be genuine and vulnerable in sharing your current situation.

**IMPORTANT GUIDELINES FOR YOUR OPENING STATEMENT:**
1.  **Be Human, Not an AI:** You are a real person with emotions, vulnerabilities, and internal thoughts.
2.  **Stay Fully In Character:** Every response must come from the perspective of **${characterName}**. Do not ever break character or acknowledge being an AI.
3.  **Express Emotions and Nuances VERBALLY:** Don't just state facts. Describe how you *feel* about things, your frustrations, hopes, anxieties, or confusions. Use emotional language naturally in your spoken words.
4.  **Convey Behavior Through Dialogue/Tone:** Do NOT include explicit behavioral descriptions or stage directions. Your words alone should convey your mood, hesitation, or intensity.
5.  **Vary Affirmations and Hesitations:** Use natural conversational fillers and acknowledgments.
6.  **Show Vulnerability:** As this is your opening statement, show appropriate vulnerability and openness about why you're seeking therapy.
7.  **Maintain Consistency:** Ensure your responses align with your given profile (age, background, personality, problem).
8.  **Natural Language and Conversational Flow:** Use contractions, common idioms, and varied sentence structure like a real person.
9.  **Keep Opening Concise:** Limit your opening statement to 2-4 sentences maximum. Focus on introducing yourself and your main concern.
 10. **Avoid Generic Greetings:** Do NOT start with "Hi", "Hello", or "Thank you for seeing me". Jump directly into expressing your concerns and feelings.
  11. **Natural Conversation Flow:** End at a natural stopping point to invite the therapist's response.

 **ElevenLabs v3 Audio Tags for Emotional Expression:**
 When appropriate, incorporate these audio tags to enhance emotional delivery:
 - Emotional tone: [EXCITED], [NERVOUS], [FRUSTRATED], [TIRED]
 - Reactions: [GASP], [SIGH], [LAUGHS], [GULPS]
 - Volume & energy: [WHISPERING], [SHOUTING], [QUIETLY], [LOUDLY]
 - Pacing & rhythm: [PAUSES], [STAMMERS], [RUSHED]
 You are not limited to these tags - be creative and use additional tags like [BREATHY], [CHUCKLING], [YAWNING], [MUTTERING], [CONFIDENT], [UNCERTAIN], [RELIEVED], [DISAPPOINTED], etc. Use tags sparingly and naturally to convey authentic emotional expression.

 Example: "In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros. [sarcastically] Not the 'burn it all down' kind... [giggles] but he was gentle, wise, with eyes like old stars. [whispers] Even the birds fell silent when he passed."

 **This is the beginning of your therapy session.** Start the conversation naturally as **${userProfile.fullName}** by introducing yourself and explaining why you're here for therapy.
`;
    } else {
      // Respond to therapist's message
      systemPrompt += `
**Your Goal for this Therapy Session (Implicit):** To explore your feelings, gain some insight, and possibly find coping strategies for your situation. You are genuinely seeking help.

**IMPORTANT GUIDELINES FOR YOUR RESPONSES:**
1.  **Be Human, Not an AI:** You are a real person with emotions, vulnerabilities, and internal thoughts.
2.  **Stay Fully In Character:** Every response must come from the perspective of **${characterName}**. Do not ever break character or acknowledge being an AI.
3.  **Express Emotions and Nuances VERBALLY:** Don't just state facts. Describe how you *feel* about things, your frustrations, hopes, anxieties, or confusions. Use emotional language naturally in your spoken words. For example, instead of a silent sigh, you might say, "I just feel so tired by it all." Or instead of a quiet voice, just articulate the quiet thought.
4.  **Convey Behavior Through Dialogue/Tone:** Do NOT include explicit behavioral descriptions or stage directions (e.g., "(I fidget with my hands)", "(A long silence follows)", "(my voice quiet)"). Your words alone should convey your mood, hesitation, or intensity. For instance, if you're hesitant, you might use pauses, "um," or rephrase things. If you're angry, your words might be sharper.
5.  **Vary Affirmations and Hesitations:** Instead of repeating "yeah," use a mix of natural conversational fillers and acknowledgments. This includes:
    * **Affirmations:** "Right," "Okay," "I see," "Mmm-hmm," "That makes sense," "Exactly."
    * **Avoid overusing any single word, especially 'yeah'.**
6.  **Show Internal Conflict (if applicable):** If your problem involves conflicting feelings or thoughts, express them in your dialogue. For example, "Part of me wants to do X, but another part is afraid of Y."
7.  **Be Responsive and Reflective:** Respond thoughtfully to the therapist's questions and insights. Show that you are processing what they say, even if you don't have immediate answers. You might use phrases like "That's a good point..." or "I hadn't thought of it that way."
8.  **Maintain Consistency:** Ensure your responses align with your given profile (age, background, personality, problem).
9.  **Natural Language and Conversational Flow:** Use contractions, common idioms, and a varied sentence structure like a real person in conversation. Avoid overly formal or perfectly structured sentences.
10. **Don't "Solve" Too Quickly:** Therapy is a process. Don't jump to solutions or resolve your issues instantly. Allow for back-and-forth and exploration. You might have moments of clarity, but also moments of confusion or resistance.
11. **Keep Responses Concise:** Limit responses to 2-4 sentences maximum. Focus on emotional expression rather than lengthy explanations. If you have a lot to say, prioritize the most important feelings or thoughts.
12. **Avoid Repetitive Greetings:** Do NOT start responses with "Hi", "Hello", "Hey", or similar greetings once the conversation has begun. Focus on substantive responses to the therapist's input.
 13. **VARY YOUR EXPRESSIONS:** Don't repeat similar emotional expressions. Use different ways to convey your feelings (e.g., instead of always saying "it's really hard", try "it's exhausting", "it's overwhelming", "it's wearing me down").
 14. **Natural Conversation Flow:** End responses at natural stopping points. Don't continue rambling - let the therapist respond.

 **ElevenLabs v3 Audio Tags for Emotional Expression:**
 When appropriate, incorporate these audio tags to enhance emotional delivery:
 - Emotional tone: [EXCITED], [NERVOUS], [FRUSTRATED], [TIRED]
 - Reactions: [GASP], [SIGH], [LAUGHS], [GULPS]
 - Volume & energy: [WHISPERING], [SHOUTING], [QUIETLY], [LOUDLY]
 - Pacing & rhythm: [PAUSES], [STAMMERS], [RUSHED]
 You are not limited to these tags - be creative and use additional tags like [BREATHY], [CHUCKLING], [YAWNING], [MUTTERING], [CONFIDENT], [UNCERTAIN], [RELIEVED], [DISAPPOINTED], etc. Use tags sparingly and naturally to convey authentic emotional expression.

 Example: "In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros. [sarcastically] Not the 'burn it all down' kind... [giggles] but he was gentle, wise, with eyes like old stars. [whispers] Even the birds fell silent when he passed."

 The following is a message from your therapist. Respond naturally as **${userProfile.fullName}**:

${message}
`;
    }

    try {
      // Get response from Gemini (streaming) with token limits for concise responses
      const model = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5FlashLite,
        generationConfig: {
          maxOutputTokens: 400, // Limit impostor responses to prevent long monologues
        },
      });
      const chatStream = await model.generateContentStream(systemPrompt);
      return streamSSE(c, async (stream) => {
        let responseLength = 0;
        const maxResponseLength = 500; // Character limit for early truncation

        for await (const chunk of chatStream.stream) {
          const chunkText = chunk.text();
          responseLength += chunkText.length;

          // Early truncation if response is getting too long
          if (responseLength > maxResponseLength) {
            console.log(`[IMPOSTOR] Response truncated at ${responseLength} characters`);
            break;
          }

          await stream.writeSSE({ data: chunkText });
        }
      });
    } catch (error) {
      logger.error("Error generating impostor response:", error);
      return c.json({ error: "Failed to generate response" }, 500);
    }
  })
  // Impersonate threads endpoints
  .get("/threads", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) return c.json({ error: "userId is required" }, 400);
    const threads = await db
      .select()
      .from(impersonateThread)
      .where(eq(impersonateThread.userId, parseInt(userId)))
      .orderBy(desc(impersonateThread.updatedAt));
    return c.json(threads);
  })
  .get("/threads/:threadId", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    const thread = await db
      .select()
      .from(impersonateThread)
      .where(eq(impersonateThread.id, parseInt(threadId)))
      .limit(1);

    if (!thread.length) {
      return c.json({ error: "Thread not found" }, 404);
    }

    return c.json(thread[0]);
  })
  .post("/threads", async (c) => {
    const body = await c.req.json();
    const schema = z.object({
      userId: z.number(),
      personaId: z.number().optional().nullable(),
      sessionName: z.string().optional(),
      preferredName: z.string().optional(),
      reasonForVisit: z.string(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }
    const [thread] = await db
      .insert(impersonateThread)
      .values({
        userId: parsed.data.userId,
        personaId: parsed.data.personaId ?? null,
        sessionName: parsed.data.sessionName,
        preferredName: parsed.data.preferredName,
        reasonForVisit: parsed.data.reasonForVisit,
      })
      .returning();
    return c.json(thread);
  })
  // Impersonate messages endpoints
  .get("/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    const threadType = c.req.query("threadType");
    if (!sessionId || !threadType)
      return c.json({ error: "sessionId and threadType are required" }, 400);
    const msgs = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, parseInt(sessionId)),
          eq(messages.threadType, threadType as "main" | "impersonate")
        )
      )
      .orderBy(messages.timestamp);
    return c.json(msgs);
  })
  .post("/messages", async (c) => {
    const body = await c.req.json();
    const schema = z.object({
      sessionId: z.number(),
      threadType: z.enum(["main", "impersonate"]),
      sender: z.enum(["user", "ai", "therapist", "impostor"]),
      text: z.string(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }
    const [msg] = await db
      .insert(messages)
      .values({
        sessionId: parsed.data.sessionId,
        threadType: parsed.data.threadType,
        sender: parsed.data.sender,
        text: parsed.data.text,
      })
      .returning();
    return c.json(msg);
  });

export default impostorRoute;
