import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getAudioInstruction } from "server/lib/audioInstructions";
import { geminiConfig } from "server/lib/config";
import { z } from "zod";
import { db } from "../db/config";
import { impersonateThread, messages, persona } from "../db/schema";

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
      userProfile: profileSchema.optional(),
      preferredName: z.string().optional(),
      personaId: z.number().optional(),
      conversationPreferences: z
        .object({
          briefAndConcise: z.number().min(0).max(100).optional(),
          empatheticAndSupportive: z.boolean().optional(),
          solutionFocused: z.boolean().optional(),
          casualAndFriendly: z.boolean().optional(),
          professionalAndFormal: z.boolean().optional(),
          language: z.enum(["english", "filipino"]).optional(),
          // Impersonate TTS settings
          therapistVoiceId: z.string().optional(),
          therapistModel: z.string().optional(),
          impostorVoiceId: z.string().optional(),
          impostorModel: z.string().optional(),
          enableTTS: z.boolean().optional(),
          ttsSpeed: z.number().optional(),
          ttsVolume: z.number().optional(),
          ttsAutoPlay: z.boolean().optional(),
          ttsAdaptivePacing: z.boolean().optional(),
        })
        .optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    const {
      message,
      userProfile,
      preferredName,
      conversationPreferences,
      personaId,
    } = parsed.data;

    // Fetch persona data if personaId is provided and userProfile is not available
    let effectiveUserProfile = userProfile;
    if (!effectiveUserProfile && personaId) {
      const personaResult = await db
        .select()
        .from(persona)
        .where(eq(persona.id, personaId))
        .limit(1);
      if (personaResult.length > 0) {
        effectiveUserProfile = {
          userId: personaResult[0].userId,
          fullName: personaResult[0].fullName,
          age: personaResult[0].age,
          problemDescription: personaResult[0].problemDescription,
          background: personaResult[0].background || undefined,
          personality: personaResult[0].personality || undefined,
        };
      }
    }

    if (!effectiveUserProfile) {
      return c.json({ error: "User profile or personaId is required" }, 400);
    }

    // Create the system prompt for the impostor
    const characterName = preferredName || effectiveUserProfile.fullName;
    let systemPrompt = `You are roleplaying as a person seeking therapy. Your name is **${characterName}**. You are **${
      effectiveUserProfile.age
    }** years old.

**LANGUAGE REQUIREMENT:** ${
      conversationPreferences?.language === "filipino"
        ? "You MUST respond in Filipino language only. All your responses should be in Filipino."
        : "You MUST respond in English language only. All your responses should be in English."
    }

**Your Current Life Situation/Core Challenge:** ${
      effectiveUserProfile.problemDescription
    }
${
  effectiveUserProfile.background
    ? `**Relevant Background Information:** ${effectiveUserProfile.background}`
    : ""
}
${
  effectiveUserProfile.personality
    ? `**Key Personality Traits:** ${effectiveUserProfile.personality}`
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

      // Add TTS instructions if enabled
      if (prefs.enableTTS) {
        prefsText += getAudioInstruction(prefs.impostorModel);
      }

      systemPrompt += prefsText;
    }

    // Check if this is the first message (no therapist input yet)
    const isFirstMessage =
      !message ||
      message.trim() === "" ||
      message ===
        "Hello, I am here for therapy. I have been struggling with some issues.";

    console.log(
      `[IMPOSTOR API] isFirstMessage: ${isFirstMessage}, message: "${message}"`
    );

    if (isFirstMessage) {
      // Generate opening statement as the patient
      systemPrompt += `
**Your Goal for this Therapy Session:** To start the conversation by introducing yourself and immediately sharing why you're here for therapy and what you're struggling with. Be genuine and vulnerable in sharing your current situation.

**CRITICAL: You MUST start the conversation - the therapist is waiting for you to speak first.**

**OPENING STATEMENT REQUIREMENTS:**
1.  **Introduce Yourself:** Start with your name and share what feels natural about who you are
2.  **State Your Problem Clearly:** Explain what brought you to therapy in your own words
3.  **Express Your Feelings:** Share how this problem is affecting you emotionally
4.  **Be Authentic:** Include details that feel genuine to your situation and personality

**IMPORTANT GUIDELINES FOR YOUR OPENING STATEMENT:**
1.  **Be Human, Not an AI:** You are a real person with emotions, vulnerabilities, and internal thoughts.
2.  **Stay Fully In Character:** Every response must come from the perspective of **${characterName}**. Do not ever break character or acknowledge being an AI.
3.  **Express Emotions and Nuances VERBALLY:** Don't just state facts. Describe how you *feel* about things, your frustrations, hopes, anxieties, or confusions. Use emotional language naturally in your spoken words.
4.  **Convey Behavior Through Dialogue/Tone:** Do NOT include explicit behavioral descriptions or stage directions. Your words alone should convey your mood, hesitation, or intensity.
5.  **Show Vulnerability:** As this is your opening statement, show appropriate vulnerability and openness about why you're seeking therapy.
6.  **Maintain Consistency:** Ensure your responses align with your given profile (age, background, personality, problem).
7.  **Natural Language and Conversational Flow:** Use contractions, common idioms, and varied sentence structure like a real person.
8.  **Keep Opening Natural:** Provide an authentic introduction that covers who you are and why you're here. Allow your personality to guide the length and style.
9.  **Avoid Generic Greetings:** Do NOT start with "Hi", "Hello", or "Thank you for seeing me". Jump directly into expressing your concerns and feelings.
10. **End Naturally:** End in a way that feels authentic and invites the therapist to respond.

**EXAMPLE OPENING:**
"My name is ${characterName}, and I'm ${
        effectiveUserProfile.age
      } years old. I've been really struggling with ${effectiveUserProfile.problemDescription.toLowerCase()} lately, and it's been affecting my daily life. I feel overwhelmed and don't know how to handle it anymore."

**Now start the conversation naturally as **${characterName}** by introducing yourself and explaining why you're here for therapy.**
`;
    } else {
      // Respond to therapist's message
      systemPrompt += `
**Your Goal for this Therapy Session (Implicit):** To explore your feelings, gain some insight, and possibly find coping strategies for your situation. You are genuinely seeking help.

**IMPORTANT GUIDELINES FOR YOUR RESPONSES:**
1.  **Be Human, Not an AI:** You are a real person with emotions, vulnerabilities, and internal thoughts.
2.  **Stay Fully In Character:** Every response must come from the perspective of **${characterName}**. Do not ever break character or acknowledge being an AI.
3.  **Express Emotions and Nuances VERBALLY:** Don't just state facts. Describe how you *feel* about things, your frustrations, hopes, anxieties, or confusions. Use emotional language naturally in your spoken words.
4.  **Convey Behavior Through Dialogue/Tone:** Do NOT include explicit behavioral descriptions or stage directions. Your words alone should convey your mood, hesitation, or intensity.
5.  **Use Natural Conversational Fillers:** Feel free to use common conversational elements like "yeah," "you know," "I mean," "well," etc. Use them naturally as a real person would.
6.  **Show Internal Conflict (if applicable):** If your problem involves conflicting feelings or thoughts, express them in your dialogue naturally.
7.  **Be Responsive and Reflective:** Respond thoughtfully to the therapist's questions and insights. Show that you are processing what they say.
8.  **Maintain Consistency:** Ensure your responses align with your given profile (age, background, personality, problem).
9.  **Natural Language and Conversational Flow:** Use contractions, common idioms, and varied sentence structure like a real person in conversation.
10. **Don't "Solve" Too Quickly:** Therapy is a process. Allow for natural exploration and back-and-forth.
  11. **Natural Response Length:** ${
    conversationPreferences?.enableTTS
      ? "Keep responses conversational and natural - aim for 1-3 sentences for optimal audio generation, but allow more if the emotion or thought requires it."
      : "Keep responses conversational and natural - aim for 2-5 sentences. Allow the emotion and thought process to guide length rather than strict limits. Express yourself fully when needed."
  }
12. **Avoid Repetitive Greetings:** Do NOT start responses with "Hi", "Hello", "Hey", or similar greetings once the conversation has begun.
  13. **Express Yourself Authentically:** Use emotional expressions that feel natural to you. Don't force variety - let your genuine feelings guide your words.
   14. **Natural Conversation Flow:** End responses at natural stopping points that feel authentic to your character. Allow your thoughts to flow naturally.

  Example: "In the ancient land of Eldoria, where skies shimmered and forests whispered secrets to the wind, lived a dragon named Zephyros. [sarcastically] Not the 'burn it all down' kind... [giggles] but he was gentle, wise, with eyes like old stars. [whispers] Even the birds fell silent when he passed."

  Your therapist just said: "${message}"

  Respond naturally as **${
    effectiveUserProfile.fullName
  }** with your thoughts and feelings. Do not simply repeat or echo what the therapist said. Always provide a unique response as the patient.
`;
    }

    try {
      // Get response from Gemini (streaming) with flexible token limits for natural conversation
      const model = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5FlashLite,
        generationConfig: {
          maxOutputTokens: 800, // Allow more substantial responses while maintaining conversational flow
        },
      });
      const chatStream = await model.generateContentStream(systemPrompt);
      return streamSSE(c, async (stream) => {
        let responseLength = 0;
        const maxResponseLength = 1000; // Increased character limit for more natural responses

        for await (const chunk of chatStream.stream) {
          const chunkText = chunk.text();
          responseLength += chunkText.length;

          // Early truncation if response is getting too long
          if (responseLength > maxResponseLength) {
            break;
          }

          await stream.writeSSE({ data: chunkText });
        }
      });
    } catch (error) {
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
          threadType === "impersonate"
            ? eq(messages.threadId, parseInt(sessionId)) // For impersonate threads, sessionId param is actually threadId
            : eq(messages.sessionId, parseInt(sessionId)),
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
        ...(parsed.data.threadType === "impersonate"
          ? { threadId: parsed.data.sessionId } // For impersonate threads, sessionId param is actually threadId
          : { sessionId: parsed.data.sessionId }),
        threadType: parsed.data.threadType,
        sender: parsed.data.sender,
        text: parsed.data.text,
      })
      .returning();
    return c.json(msg);
  });

export default impostorRoute;
