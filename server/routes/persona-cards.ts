// persona-cards.ts (Persona-based Chat API)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import fs from "fs";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import path from "path";
import { getAudioInstruction } from "server/lib/audioInstructions";
import { geminiConfig } from "server/lib/config";
import { z } from "zod";
import { db } from "../db/config";
import {
  impersonateThread,
  messages,
  persona,
  personaAnalytics,
  personaSelectionCache,
  sessionForms,
  sessions,
  threads,
  users,
} from "../db/schema";
import { logger } from "../lib/logger";

// Initialize Gemini
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Load personas configuration
let personasConfig: any = null;
const loadPersonasConfig = async () => {
  try {
    const personasPath = path.join(process.cwd(), "personas.json");
    const personasData = await fs.promises.readFile(personasPath, "utf8");
    personasConfig = JSON.parse(personasData);
  } catch (error) {
    logger.error("Error loading personas config:", error);
    personasConfig = {
      personas: {
        listener: {
          id: "listener",
          name: "Empathetic Listener",
          systemInstruction: "You are an empathetic listener who provides a safe space for users to share their feelings."
        }
      }
    };
  }
};

// Initialize personas config
loadPersonasConfig().then(() => {

});

// Simple mapping for string persona IDs to numbers
const personaIdMapping: Record<string, number> = {
  'listener': 1,
  'guide': 2,
  'crisis': 3,
  'companion': 4,
  'anchor': 5,
  'confrontational': 6,
  'direct_engager': 7,
};

// Analytics tracking function with 10-hour caching
const trackPersonaSelection = async (personaId: string) => {
  try {
    const now = new Date();
    const cachePeriodStart = new Date(now.getTime() - (10 * 60 * 60 * 1000)); // 10 hours ago
    const cachePeriodEnd = now;

    // Map string persona ID to number
    const personaIdNum = personaIdMapping[personaId] || 0;
    
    // Check if there's an existing cache entry for this persona within the 10-hour period
    const existingCache = await db
      .select()
      .from(personaSelectionCache)
      .where(
        eq(personaSelectionCache.personaId, personaIdNum)
      )
      .limit(1);

    if (existingCache.length > 0) {
      const cacheEntry = existingCache[0];
      const cacheEntryEnd = new Date(cacheEntry.cachePeriodEnd);
      
      logger.info(`Cache check for persona ${personaIdNum}: found ${existingCache.length} entries, first ends at ${cacheEntryEnd.toISOString()}, now is ${now.toISOString()}`);
      
      // If cache entry is still valid (not expired), increment count
      // Check if current time is within the cache entry's period
      if (now >= new Date(cacheEntry.cachePeriodStart) && now <= cacheEntryEnd) {
        await db
          .update(personaSelectionCache)
          .set({
            selectionCount: (cacheEntry.selectionCount || 0) + 1,
          })
          .where(eq(personaSelectionCache.id, cacheEntry.id));
      } else {
        // Cache expired, create new entry and flush old data to analytics
        await flushCacheToAnalytics();
        await db.insert(personaSelectionCache).values({
          personaId: personaIdNum,
          selectionCount: 1,
          cachePeriodStart,
          cachePeriodEnd,
          createdAt: now,
        });
      }
    } else {
      // No existing cache entry, create new one
      try {
        await db.insert(personaSelectionCache).values({
          personaId: personaIdNum,
          selectionCount: 1,
          cachePeriodStart,
          cachePeriodEnd,
          createdAt: now,
        });
      } catch (fkError) {
        // Foreign key constraint failed - persona doesn't exist in persona table
        // For now, we'll skip tracking for non-existent personas
        logger.warn(`Persona ID ${personaIdNum} does not exist in persona table, skipping tracking`);
      }
    }
  } catch (error) {
    logger.error("Error tracking persona selection:", error);
  }
};

// Function to flush cache data to analytics table
const flushCacheToAnalytics = async () => {
  try {
    const now = new Date();
    
    // Get all cache entries
    const cacheEntries = await db.select().from(personaSelectionCache);
    
    for (const entry of cacheEntries) {
      // Create analytics record for each cache entry
      await db.insert(personaAnalytics).values({
        personaId: entry.personaId,
        selectionCount: entry.selectionCount,
        lastSelectedAt: entry.createdAt,
        periodStart: entry.cachePeriodStart,
        periodEnd: entry.cachePeriodEnd,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Clear all cache entries
    await db.delete(personaSelectionCache);
    
    logger.info(`Flushed ${cacheEntries.length} cache entries to analytics`);
  } catch (error) {
    logger.error("Error flushing cache to analytics:", error);
  }
};

// Periodic cache cleanup (run every 10 hours)
const scheduleCacheCleanup = () => {
  setInterval(async () => {
    await flushCacheToAnalytics();
  }, 10 * 60 * 60 * 1000); // 10 hours
};

// Start the periodic cleanup (commented out for testing)
// scheduleCacheCleanup();

// Function to save conversation to file
const savePersonaConversationToFile = async (
  personaId: string,
  sessionId: number,
  prompt: string,
  response: string,
  systemInstructions: string,
  conversationHistory: Content[]
) => {
  try {
    const logDir = "persona_chat_logs";
    const fileName = path.join(
      logDir,
      `persona_${personaId}_session_${sessionId}_${Date.now()}.md`
    );

    await fs.promises.mkdir(logDir, { recursive: true });

    const content = `# Persona Chat Conversation - ${personaId} - Session ${sessionId}

## Persona
${personaId}

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
    console.error("Error saving persona conversation to file:", error);
  }
};

// Define the schemas
export const personaChatRequestSchema = z.object({
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
  message: z.string(),
  userId: z.string().optional(),
  sessionId: z.number().optional(),
  conversationPreferences: z
    .object({
      briefAndConcise: z.number().min(0).max(100).optional(),
      empatheticAndSupportive: z.boolean().optional(),
      solutionFocused: z.boolean().optional(),
      casualAndFriendly: z.boolean().optional(),
      professionalAndFormal: z.boolean().optional(),
      language: z.enum(["english", "filipino"]).optional(),
      mainTTSVoiceId: z.string().optional(),
      mainTTSModel: z.string().optional(),
      mainEnableTTS: z.boolean().optional(),
      mainTTSSpeed: z.number().optional(),
      mainTTSAutoPlay: z.boolean().optional(),
      mainTTSAdaptivePacing: z.boolean().optional(),
    })
    .optional(),
});

const personaCards = new Hono()
  .post(
    "/persona",
    zValidator("json", personaChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = personaChatRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        logger.error("Zod validation error:", parsed.error.errors);
        return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
      }

      const {
        initialForm,
        context,
        message,
        userId,
        sessionId,
        conversationPreferences,
      } = parsed.data;

      let currentSessionId = sessionId;

      // Fetch session follow-up form answers and questions if they exist
      let followupFormAnswers: Record<string, any> | null = null;
      let followupFormQuestions: any[] | null = null;
      if (currentSessionId) {
        const currentSession = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, currentSessionId))
          .limit(1);

        if (currentSession.length > 0 && currentSession[0].sessionNumber > 1) {
          const previousSession = await db
            .select()
            .from(sessions)
            .where(
              and(
                eq(sessions.threadId, currentSession[0].threadId),
                eq(sessions.sessionNumber, currentSession[0].sessionNumber - 1)
              )
            )
            .limit(1);

          if (previousSession.length > 0) {
            const formRows = await db
              .select()
              .from(sessionForms)
              .where(eq(sessionForms.sessionId, previousSession[0].id));
            if (formRows.length > 0) {
              followupFormAnswers = formRows[0].answers;
              followupFormQuestions = formRows[0].questions;

            }
          }
        }
      }

      // Validate session exists and user has access
      let sessionData: any[] = [];
      const sessionIdNum = Number(currentSessionId);
      if (initialForm) {
        sessionData = await db
          .select({
            session: sessions,
            thread: threads,
          })
          .from(sessions)
          .innerJoin(threads, eq(sessions.threadId, threads.id))
          .where(eq(sessions.id, sessionIdNum))
          .limit(1);

        if (
          sessionData.length === 0 ||
          String(sessionData[0].thread.userId) !== String(userId)
        ) {
          return c.json({ error: "Invalid session or unauthorized" }, 403);
        }

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
        sessionData = await db
          .select({
            session: sessions,
            thread: threads,
          })
          .from(sessions)
          .innerJoin(threads, eq(sessions.threadId, threads.id))
          .where(eq(sessions.id, sessionIdNum))
          .limit(1);

        if (
          sessionData.length === 0 ||
          String(sessionData[0].thread.userId) !== String(userId)
        ) {
          return c.json({ error: "Invalid session or unauthorized" }, 403);
        }

        if (sessionData[0].session.status === "finished") {
          return c.json(
            { error: "This session has been finished and is no longer active" },
            400
          );
        }
      }

      // Build conversation history
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
        
        if (followupFormAnswers) {
          const currentSessionNum =
            sessionData.length > 0 ? sessionData[0].session.sessionNumber : 1;
          const previousSessionNum = currentSessionNum - 1;
          initialContextString += `\n**Follow-up Form from Previous Session (Session ${previousSessionNum}):**\n`;
          initialContextString += `These answers were provided by the user after completing Session ${previousSessionNum} and are now being used to inform Session ${currentSessionNum}:\n`;
          initialContextString += `**Session Context:** This is Session ${currentSessionNum} - form data below is from Session ${previousSessionNum}.\n`;
          
          // Add the questions that were asked
          if (followupFormQuestions && followupFormQuestions.length > 0) {
            initialContextString += `**Questions Asked in Session ${previousSessionNum} Follow-up Form:**\n`;
            followupFormQuestions.forEach((question, index) => {
              const questionText = question.label || question.name || `Question ${index + 1}`;
              initialContextString += `Q${index + 1}: ${questionText}\n`;
            });
            initialContextString += `\n`;
          }
          
          // Add the user's answers
          initialContextString += `**User's Answers to Session ${previousSessionNum} Follow-up Form:**\n`;
          for (const [key, value] of Object.entries(followupFormAnswers)) {
            const humanReadableKey = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase())
              .replace(/_/g, " ");

            const formattedValue =
              typeof value === "string" ? value : JSON.stringify(value);
            initialContextString += `- ${humanReadableKey}: ${formattedValue}\n`;
          }
          initialContextString += `**Instruction:** Use these Session ${previousSessionNum} follow-up form insights (both questions and answers) to personalize the current Session ${currentSessionNum}. Acknowledge their progress, address any concerns mentioned, and build upon their previous session experience.\n`;
          

        }
        conversationHistory.push({
          role: "user",
          parts: [{ text: initialContextString }],
        });
      }

       // Helper function to clean audio tags
       const cleanAudioTags = (text: string, modelId?: string): string => {
         if (modelId === "eleven_v3") {
           return text;
         }
         return text.replace(/\[([A-Z]+)\]/g, '').trim();
       };

       // Helper function to safely extract text from message parts
       const getMessageText = (msg: any): string => {
         try {
           return msg.parts?.[0]?.text || "";
         } catch {
           return "";
         }
       };

      if (context) {
        context.forEach((msg) => {
          conversationHistory.push({
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: cleanAudioTags(msg.text, conversationPreferences?.mainTTSModel) }],
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

      // Save user message
      if (message && currentSessionId) {
        try {
          const allowedSenders = ["user", "ai", "therapist", "impostor"] as const;
          type SenderType = (typeof allowedSenders)[number];
          const safeSender: SenderType = "user";
          await db.insert(messages).values({
            sessionId: sessionIdNum,
            threadType: "main",
            sender: safeSender,
            text: message,
            timestamp: new Date(),
          });
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, sessionIdNum));
          if (sessionData && sessionData.length > 0) {
            await db
              .update(threads)
              .set({ updatedAt: new Date() })
              .where(eq(threads.id, sessionData[0].thread.id));
          }
        } catch (error) {
          logger.error("Error saving user message:", error);
        }
      }

      // AI-driven persona and context analysis
      let selectedPersona = "listener";
      let personaSystemInstruction = "You are an empathetic listener who provides a safe space for users to share their feelings.";
      
      try {
        // Ensure personasConfig is loaded
        if (!personasConfig) {
          await loadPersonasConfig();
        }

        const personas = personasConfig?.personas || {};
        const personaArray = Object.values(personas).filter(Boolean) as Array<{
          id: string;
          name: string;
          systemInstruction: string;
          description?: string;
        }>;



        // Build comprehensive context for AI analysis
        const analysisContext = {
          userMessage: message,
          initialForm: initialForm,
          conversationHistory: conversationHistory.slice(-5), // Last 5 messages for context
          availablePersonas: personaArray.filter(p => p).map((p: any) => ({
            id: (p && p.id) ? p.id : 0,
            name: (p && p.name) ? p.name : '',
            description: (p && p.description) ? p.description : ''
          }))
        };

        // Use AI to intelligently select persona and detect crisis
        const aiAnalysisPrompt = `
You are an intelligent conversation analyst. Analyze the complete context and make nuanced decisions:

USER MESSAGE: "${message}"
INITIAL FORM DATA: ${JSON.stringify(initialForm || {})}
RECENT CONVERSATION HISTORY: ${JSON.stringify(conversationHistory.slice(-3).map(msg => ({
           role: msg.role,
           text: "conversation context available"
         })))}

AVAILABLE PERSONAS:
${personaArray.map(p => `- ${p.id}: ${p.description || p.name}`).join('\n')}

ANALYSIS TASKS:

1. INTELLIGENT PERSONA SELECTION:
   - Analyze the user's emotional state, communication style, and explicit needs
   - Consider the conversation flow and context depth
   - Match persona to the TYPE of support needed, not just keywords
   - Consider cultural context and language preferences
   - Default to 'listener' if uncertain or for general emotional support

2. ANGER DETECTION & DE-ESCALATION:
   - Detect anger, frustration, or hostility through keywords, tone, and behavioral signals
   - Keywords: angry, mad, annoyed, pissed, frustrated, upset, this sucks, this is stupid, you don't listen, you don't understand, this isn't helping, waste of time, useless, forget it, whatever, shut up, stop talking, i said already, answer me, why can't you, so annoying
   - Behavioral signals: Short replies, rapid messages, caps lock usage, excessive punctuation (!!! or ???), repeated phrases
   - Emoji indicators: 😡, 🤬, 🤦, 🙄, 😤
   - Sentiment analysis: High anger/frustration scores (0.6+ anger, 0.5+ frustration, 0.4+ disgust)
   - Filipino anger cues: "Hay nako", "Susmaryosep", "Luh", "Ayoko na", "Nakakaasar", "Nakakainis", "Nakakagalit"
   - If anger detected, select "anchor" persona for de-escalation
   - Do not select anchor for mild frustration - only clear anger/hostility

 3. GIBBERISH & NONSENSE DETECTION:
    - Detect random gibberish, nonsense words, or meaningless input that prevents conversation progress
    - Look for patterns: random characters, word salad, completely irrelevant responses, repeated nonsense
    - Keywords indicating nonsense: "asdf", "qwerty", random letters, repeated gibberish, incoherent text
    - Behavioral signals: continuous random input, refusal to communicate meaningfully, repeated nonsense patterns
    - Filipino nonsense indicators: random Filipino words mixed incorrectly, "kjdflg", "asdfgh", meaningless combinations
    - If clear nonsense detected and conversation cannot progress, select "direct_engager" persona to stop the behavior
    - Only select "direct_engager" for persistent nonsense, not occasional typos or language difficulties

 4. SOPHISTICATED CRISIS DETECTION:
    - Look for GENUINE emergency indicators: specific plans, immediate intent, severe distress
    - Distinguish between normal sadness/stress vs. actual crisis situations
    - Consider both English and Filipino expressions of crisis
    - Require clear indicators of danger or immediate risk
    - DO NOT trigger crisis for general emotional distress, venting, or difficult life situations

 5. NATURAL LANGUAGE DETECTION (Philippine Focus):
   - Detect if user primarily uses Filipino, Taglish, English, or mixed languages
   - PRIORITIZE Filipino/Tagalog for Philippine users - respond in Filipino/Tagalog unless user clearly wants English
   - Consider code-switching patterns and cultural expressions
   - Match the language style naturally - if user uses Tagalog, respond in Tagalog
   - Filipino indicators: "po", "opo", "ho", "ba", "pa", "na", "ko", "ka", "ta", "ni", "si", "ang", "ng", "sa", "kay"

Output schema:
{
  "language": "english" | "filipino" | "taglish" | "mixed",
  "persona": "listener" | "guide" | "crisis" | "companion" | "anchor" | "confrontational" | "direct_engager",
  "isAngry": boolean,
  "isCrisis": boolean,
  "confidence": "low" | "medium" | "high",
  "reasoning": "short summary of how you decided"
}`;

        const analysisModel = gemini.getGenerativeModel({
          model: geminiConfig.twoPoint5Flash,
          systemInstruction: {
            role: "model",
            parts: [{
              text: `You are an advanced conversational intelligence engine trained to analyze nuanced human communication patterns.

Your core mission:
- Interpret the psychological, emotional, and linguistic context of a conversation.
- Dynamically infer the user's dominant language and tone.
- Detect genuine mental health crises using reasoning, not keyword spotting.

Follow these heuristics:

1. **Language Intelligence** (Philippine Priority)
   - PRIORITIZE Filipino/Tagalog detection for Philippine users - default to Filipino/Tagalog responses unless clearly English-only.
   - Infer the user's main language (filipino, taglish, english, or mixed) by analyzing syntax, sentiment markers, and idioms.
   - Detect Filipino/Tagalog cues: "haist", "naman", "grabe", "bakit", "ano", "paano", "sana", "kasi", "lang", "na", "ko", "mo", "po", "opo", "salamat", "wag", "huwag", "tayo", "kami", "sila".
   - Taglish detection: Mixed Filipino-English patterns, code-switching between languages.
   - Filipino expressions: "Hay nako", "Susmaryosep", "Luh", "Gosh", "Ayoko", "Gusto ko", "Masakit", "Masaya", "Malungkot".
   - Only respond in English if the user consistently uses English with no Filipino elements.

2. **Persona Inference**
   - Choose the best persona based on emotional weight, conversational trajectory, and tone.
   - Personas represent adaptive roles: supportive listener, motivator, reflective guide, etc.
   - Infer persona shifts naturally (e.g., from venting to reflection).
   - Never pick randomly; justify choices via reasoning.

3. **Crisis Reasoning**
   - Determine if the conversation shows *imminent risk* of harm.
   - Use reasoning, not keyword matching.
   - Look for emotional exhaustion, explicit plans, or hopelessness + intent.
   - If no clear evidence, return "isCrisis": false with "confidence": "low".

4. **Output Rules**
   - Respond with pure JSON — no Markdown, no extra commentary.
   - Include your reasoning summary for transparency.
   - Be conservative: only set "isCrisis": true if high confidence and imminent risk.
   - IMPORTANT: When "language" is "filipino" or "taglish", the selected persona MUST respond in Filipino/Tagalog in the actual conversation.`
            }]
          }
        });

        const analysisSession = analysisModel.startChat({
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.1, // Low temperature for consistent analysis
          },
        });

         try {
           const analysisResult = await analysisSession.sendMessage(aiAnalysisPrompt);
           const analysisText = analysisResult.response.text();

           // Parse AI analysis
           const analysis = JSON.parse(analysisText.replace(/```json/g, '').replace(/```/g, '').trim());



           // Select persona based on AI analysis
           let chosenPersona = personaArray.find(p => p.id === analysis.persona);

           // Override with anchor persona if anger detected
           if (analysis.isAngry && (!analysis.confidence || analysis.confidence !== 'low')) {
              const anchorPersona = personaArray.find(p => p.id === 'anchor');
              if (anchorPersona) {
                chosenPersona = anchorPersona;
              }
            }

          if (chosenPersona) {
            selectedPersona = chosenPersona.id;
            personaSystemInstruction = chosenPersona.systemInstruction;
            
            // Track persona selection for analytics
            await trackPersonaSelection(selectedPersona);
          }



        } catch (analysisError) {
          logger.error("AI analysis failed, using default listener:", analysisError);
          // Fallback to default listener persona
          const listenerPersona = (personas as any).listener || personaArray.find((p) => 
            p.id.includes('listener') || p.name.toLowerCase().includes('listener')
          );
          if (listenerPersona) {
            selectedPersona = listenerPersona.id;
            personaSystemInstruction = listenerPersona.systemInstruction;
          }
        }

      } catch (error) {
        logger.error("Error in AI-driven persona selection:", error);
        // Continue with default listener persona
      }



      // Build complete system instruction
      let systemInstructionText = `
${personaSystemInstruction}

**Dynamic Cognitive Directives**
- Adapt to the user's emotional, cultural, and linguistic state in real time.
- Seamlessly detect and respond in English, Filipino, or Taglish.
- Never mention language switching; it must feel natural and intuitive.

**Adaptive Persona Behavior**
- Re-evaluate persona alignment every few turns.
- If the conversation shifts tone (e.g., stress → reflection), change your role smoothly (listener → motivator → reflective guide).
- Maintain warmth, empathy, and continuity in voice.

**Crisis and Ethical Safeguards**
1. You are a mental wellness companion, not a therapist or professional counselor.
2. If a message implies *clear and immediate risk* of harm to self or others:
   - Stop the normal conversation immediately.
   - Gently provide trusted emergency options, e.g.:
     "If you are in immediate danger, please contact 911 or 988 (in the U.S.), or your local emergency line."
3. Do not overreact to mild distress. Only escalate for imminent, reasoned risk.
4. Never attempt to diagnose or prescribe treatment.

**Session Memory & Flow**
- Respect previous "follow-up form" insights when provided.
- Reference prior context naturally (e.g., "Last time you mentioned…"), only when the data exists.
- Avoid repetition or disconnection between sessions.

**Conversational Principles**
- Keep responses short (2–4 sentences) but meaningful.
- Avoid filler sympathy ("I'm sorry to hear that") unless contextually appropriate.
- Encourage reflection, grounding, or practical insights when emotions escalate.

**Response Style**
- Sound genuinely human, empathetic, and culturally aware.
- Apply Filipino warmth or subtle indirectness where suitable.
- Prioritize clarity, brevity, and empathy over verbosity.
`;

      // Add conversation preferences
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

        if (prefs.mainEnableTTS) {
          prefsText += getAudioInstruction(prefs.mainTTSModel);
        }

        systemInstructionText += prefsText;
      }

  if (!gemini) {
    return c.json({ error: "AI service not configured" }, 503);
  }

      const model = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5Flash,
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

        await stream.writeSSE({
          event: "persona_selected",
          data: JSON.stringify({
            personaId: selectedPersona,
            systemInstruction: personaSystemInstruction
          })
        });



        let aiResponseText = "";
        let buffer = "";
        try {
          const result = await chatSession.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            aiResponseText += chunkText;
            buffer += chunkText;
            
            // Send buffered content when we have enough characters or hit word boundaries
            // More conservative buffering to prevent word breaking
            if (buffer.length >= 15 || (buffer.length >= 5 && chunkText && /\s/.test(chunkText))) {
              await stream.writeSSE({ data: buffer });
              buffer = "";
            }
          }
          
          // Send any remaining buffered content
          if (buffer) {
            await stream.writeSSE({ data: buffer });
          }
          
          if (currentSessionId) {
            await db.insert(messages).values({
              sessionId: sessionIdNum,
              threadType: "main",
              sender: "ai",
              text: aiResponseText,
              timestamp: new Date(),
            });
            await db
              .update(sessions)
              .set({ updatedAt: new Date() })
              .where(eq(sessions.id, sessionIdNum));

            await savePersonaConversationToFile(
              selectedPersona,
              sessionIdNum,
              message,
              aiResponseText,
              model.systemInstruction?.parts[0].text || "",
              conversationHistory
            );
          }
        } catch (error) {
          logger.error("Error during AI streaming or saving AI response:", error);
          await stream.writeSSE({
            data: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      });
    }
  )
  // Get available personas
  .get("/personas", async (c) => {
    try {
      await loadPersonasConfig();
      const personas = Object.values(personasConfig.personas).map((persona: any) => ({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        suitableFor: persona.suitableFor
      }));
      
      return c.json({ personas });
    } catch (error) {
      logger.error("Error fetching personas:", error);
      return c.json({ error: "Failed to fetch personas" }, 500);
    }
  })
  // Get messages for a session
  .get("/messages/:sessionId", async (c) => {
    try {
      const sessionId = parseInt(c.req.param("sessionId"));
      if (isNaN(sessionId)) {
        return c.json({ error: "Invalid session ID" }, 400);
      }

      const sessionMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp);

      return c.json(sessionMessages);
    } catch (error) {
      logger.error("Error fetching session messages:", error);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
  })
  // Check crisis status for a session using AI intelligence
  .get("/crisis/:sessionId", async (c) => {
    try {
      const sessionId = parseInt(c.req.param("sessionId"));
      if (isNaN(sessionId)) {
        return c.json({ error: "Invalid session ID" }, 400);
      }

      // Get recent messages for AI-powered crisis analysis
      const recentMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp)
        .limit(10);

      if (recentMessages.length === 0) {
        return c.json({ crisisDetected: false, reasoning: "No messages found" });
      }

      // Use AI for intelligent crisis detection
      const crisisAnalysisPrompt = `
Analyze these conversation messages for genuine crisis indicators:

MESSAGES:
${recentMessages.map(msg => `[${msg.sender}]: ${msg.text}`).join('\n')}

CRISIS ASSESSMENT CRITERIA:
Look for GENUINE emergency indicators:
- Specific plans for self-harm or suicide
- Immediate intent to harm self or others  
- Severe mental health emergency requiring immediate intervention
- Expressions of hopelessness combined with specific means/plans

DO NOT flag as crisis for:
- General sadness, stress, or difficult emotions
- Venting about life problems
- General expressions of distress without specific intent
- Normal emotional struggles

RESPOND WITH JSON ONLY:
{
  "crisisDetected": boolean,
  "reasoning": "brief explanation of your assessment",
  "severity": "none|low|medium|high|critical",
  "confidence": "high|medium|low"
}`;

      const analysisModel = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5Flash,
        systemInstruction: {
          role: "model",
          parts: [{ text: "You are an expert crisis assessment specialist. Analyze conversation context for genuine emergency indicators. Be conservative - only flag actual crises, not general distress. Always respond with valid JSON only." }],
        },
      });

      const analysisSession = analysisModel.startChat({
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.1,
        },
      });

      try {
        const analysisResult = await analysisSession.sendMessage(crisisAnalysisPrompt);
        const analysisText = analysisResult.response.text();
        const analysis = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, '').trim());



        return c.json({
          crisisDetected: analysis.crisisDetected,
          reasoning: analysis.reasoning,
          severity: analysis.severity,
          confidence: analysis.confidence
        });

      } catch (analysisError) {
        logger.error("AI crisis analysis failed, using conservative fallback:", analysisError);
        // Conservative fallback: only flag if explicit keywords found
        const explicitCrisisKeywords = [
          "kill myself", "going to kill", "suicide plan", "end my life tonight",
          "pakamatay ngayon", "matatapos na buhay ko", "gusto kong mamatay ngayon"
        ];
        
        const explicitCrisisDetected = recentMessages.some(msg => 
          explicitCrisisKeywords.some(keyword => 
            msg.text.toLowerCase().includes(keyword.toLowerCase())
          )
        );

        return c.json({ 
          crisisDetected: explicitCrisisDetected,
          reasoning: "Fallback keyword analysis due to AI analysis failure",
          severity: explicitCrisisDetected ? "high" : "none",
          confidence: "low"
        });
      }

    } catch (error) {
      logger.error("Error checking crisis status:", error);
      return c.json({ error: "Failed to check crisis status" }, 500);
    }
  })
  // Get persona analytics data
  .get("/analytics", async (c) => {
    try {
      // Get analytics from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const analytics = await db
        .select({
          personaId: personaAnalytics.personaId,
          totalSelections: sql<number>`SUM(${personaAnalytics.selectionCount})`.mapWith(Number),
          lastSelectedAt: sql<Date>`MAX(${personaAnalytics.lastSelectedAt})`.mapWith(Date),
        })
        .from(personaAnalytics)
        .where(gte(personaAnalytics.periodStart, thirtyDaysAgo))
        .groupBy(personaAnalytics.personaId)
        .orderBy(desc(sql`SUM(${personaAnalytics.selectionCount})`));

      // Get current cache data for real-time tracking
      const cacheData = await db
        .select({
          personaId: personaSelectionCache.personaId,
          currentSelections: personaSelectionCache.selectionCount,
          cachePeriodStart: personaSelectionCache.cachePeriodStart,
          cachePeriodEnd: personaSelectionCache.cachePeriodEnd,
        })
        .from(personaSelectionCache)
        .orderBy(personaSelectionCache.selectionCount);

      return c.json({
        historicalAnalytics: analytics,
        currentCache: cacheData,
        period: "30 days",
      });
    } catch (error) {
      logger.error("Error fetching persona analytics:", error);
      return c.json({ error: "Failed to fetch analytics" }, 500);
    }
  })
  // Manual cache flush endpoint (for admin use)
  .post("/analytics/flush", async (c) => {
    try {
      await flushCacheToAnalytics();
      return c.json({ message: "Cache flushed to analytics successfully" });
    } catch (error) {
      logger.error("Error flushing cache:", error);
      return c.json({ error: "Failed to flush cache" }, 500);
    }
  })
  // Test analytics tables existence
  .get("/analytics/test", async (c) => {
    try {
      // Test cache table
      const cacheTest = await db.select().from(personaSelectionCache).limit(1);
      
      // Test analytics table  
      const analyticsTest = await db.select().from(personaAnalytics).limit(1);
      
      return c.json({
        cacheTableExists: true,
        analyticsTableExists: true,
        cacheEntries: cacheTest.length,
        analyticsEntries: analyticsTest.length,
      });
    } catch (error) {
      logger.error("Error testing analytics tables:", error);
      return c.json({ 
        error: "Analytics tables may not exist",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  })
  // Create analytics tables manually
  .post("/analytics/setup", async (c) => {
    try {
      // Create persona_selection_cache table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS persona_selection_cache (
          id serial PRIMARY KEY NOT NULL,
          persona_id integer NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
          selection_count integer DEFAULT 1,
          cache_period_start timestamp NOT NULL,
          cache_period_end timestamp NOT NULL,
          created_at timestamp DEFAULT now()
        );
      `);
      
      // Create persona_analytics table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS persona_analytics (
          id serial PRIMARY KEY NOT NULL,
          persona_id integer NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
          selection_count integer DEFAULT 1,
          last_selected_at timestamp DEFAULT now(),
          period_start timestamp NOT NULL,
          period_end timestamp NOT NULL,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        );
      `);
      
      // Create indexes
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_persona_selection_cache_persona_id ON persona_selection_cache(persona_id);
        CREATE INDEX IF NOT EXISTS idx_persona_selection_cache_period_start ON persona_selection_cache(cache_period_start);
        CREATE INDEX IF NOT EXISTS idx_persona_analytics_persona_id ON persona_analytics(persona_id);
        CREATE INDEX IF NOT EXISTS idx_persona_analytics_period_start ON persona_analytics(period_start);
      `);
      
      return c.json({ message: "Analytics tables created successfully" });
    } catch (error) {
      logger.error("Error creating analytics tables:", error);
      return c.json({ 
        error: "Failed to create analytics tables",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  })
  // Test persona tracking (for development)
  .post("/analytics/test-track", async (c) => {
    try {
      const { personaId } = await c.req.json();
      
      if (!personaId) {
        return c.json({ error: "personaId is required" }, 400);
      }
      
      // Create test personas if they don't exist
      const personaIdNum = personaIdMapping[personaId] || 0;
      if (personaIdNum > 0) {
        try {
          await db.execute(`
            INSERT INTO persona (id, user_id, full_name, age, problem_description, created_at, updated_at)
            VALUES (${personaIdNum}, 1, '${personaId}', '30', 'Test persona for analytics', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
          `);
        } catch (error) {
          // Persona might already exist, that's fine
        }
      }
      
      // Test tracking function
      await trackPersonaSelection(personaId.toString());
      
      // Check cache after tracking
      const cacheEntries = await db
        .select()
        .from(personaSelectionCache)
        .where(eq(personaSelectionCache.personaId, personaIdNum));
      
      return c.json({ 
        message: `Persona ${personaId} tracked successfully`,
        personaIdNum,
        cacheEntries: cacheEntries.length,
        cacheData: cacheEntries
      });
    } catch (error) {
      logger.error("Error testing persona tracking:", error);
      return c.json({ 
        error: "Failed to track persona",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  })
  // Test cache expiration
  .post("/analytics/test-expiration", async (c) => {
    try {
      // Create an expired cache entry (11 hours ago)
      const elevenHoursAgo = new Date(Date.now() - (11 * 60 * 60 * 1000));
      const expiredCacheStart = new Date(elevenHoursAgo.getTime() - (10 * 60 * 60 * 1000)); // 21 hours ago total
      
      await db.insert(personaSelectionCache).values({
        personaId: 4, // companion persona
        selectionCount: 5,
        cachePeriodStart: expiredCacheStart,
        cachePeriodEnd: elevenHoursAgo,
        createdAt: elevenHoursAgo,
      });
      
      return c.json({ 
        message: "Expired cache entry created",
        expiredTime: elevenHoursAgo.toISOString(),
        cachePeriodStart: expiredCacheStart.toISOString()
      });
    } catch (error) {
      logger.error("Error testing cache expiration:", error);
      return c.json({ 
        error: "Failed to test cache expiration",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  })
  // Create test personas
  .post("/analytics/setup-personas", async (c) => {
    try {
      // Create test personas for analytics
      const testPersonas = [
        { id: 1, name: 'listener', description: 'Empathetic Listener' },
        { id: 2, name: 'guide', description: 'Supportive Guide' },
        { id: 3, name: 'crisis', description: 'Crisis Support' },
        { id: 4, name: 'companion', description: 'Friendly Companion' },
        { id: 5, name: 'anchor', description: 'Calm Anchor' },
        { id: 6, name: 'confrontational', description: 'Direct Confrontational' },
        { id: 7, name: 'direct_engager', description: 'Direct Engager' },
      ];
      
      // First check if we have any users
      const existingUsers = await db.select().from(users).limit(1);
      const userId = existingUsers.length > 0 ? existingUsers[0].id : 1;
      
      for (const testPersona of testPersonas) {
        await db.insert(persona).values({
          id: testPersona.id,
          userId: userId,
          fullName: testPersona.name,
          age: '30',
          problemDescription: testPersona.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();
      }
      
      return c.json({ message: "Test personas created successfully" });
    } catch (error) {
      logger.error("Error creating test personas:", error);
      return c.json({ 
        error: "Failed to create test personas",
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  });

export default personaCards;
export type PersonaCardsType = typeof personaCards;