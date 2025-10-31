// persona-cards.ts (Persona-based Chat API)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { and, count, eq } from "drizzle-orm";
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
  sessionForms,
  sessions,
  threads,
} from "../db/schema";
import { logger } from "../lib/logger";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
loadPersonasConfig();

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

      // Fetch session follow-up form answers if they exist
      let followupFormAnswers: Record<string, any> | null = null;
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
          initialContextString += `These answers were provided by the user after their previous therapy session to help prepare for this current session (Session ${currentSessionNum}):\n`;
          for (const [key, value] of Object.entries(followupFormAnswers)) {
            const humanReadableKey = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase())
              .replace(/_/g, " ");

            const formattedValue =
              typeof value === "string" ? value : JSON.stringify(value);
            initialContextString += `- ${humanReadableKey}: ${formattedValue}\n`;
          }
          initialContextString += `Please use these insights to personalize this session and acknowledge their progress or concerns mentioned in the follow-up form.\n`;
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
          availablePersonas: personaArray.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description
          }))
        };

        // Use AI to intelligently select persona and detect crisis
        const aiAnalysisPrompt = `
You are an intelligent conversation analyst. Analyze the complete context and make nuanced decisions:

USER MESSAGE: "${message}"
INITIAL FORM DATA: ${JSON.stringify(initialForm || {})}
RECENT CONVERSATION HISTORY: ${JSON.stringify(conversationHistory.slice(-3).map(msg => ({
           role: msg.role,
           text: msg.parts && msg.parts[0] && msg.parts[0].text ? (msg.parts[0].text.substring(0, 200) + (msg.parts[0].text.length > 200 ? "..." : "")) : ""
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

3. SOPHISTICATED CRISIS DETECTION:
   - Look for GENUINE emergency indicators: specific plans, immediate intent, severe distress
   - Distinguish between normal sadness/stress vs. actual crisis situations
   - Consider both English and Filipino expressions of crisis
   - Require clear indicators of danger or immediate risk
   - DO NOT trigger crisis for general emotional distress, venting, or difficult life situations

4. NATURAL LANGUAGE DETECTION (Philippine Focus):
   - Detect if user primarily uses Filipino, Taglish, English, or mixed languages
   - PRIORITIZE Filipino/Tagalog for Philippine users - respond in Filipino/Tagalog unless user clearly wants English
   - Consider code-switching patterns and cultural expressions
   - Match the language style naturally - if user uses Tagalog, respond in Tagalog
   - Filipino indicators: "po", "opo", "ho", "ba", "pa", "na", "ko", "ka", "ta", "ni", "si", "ang", "ng", "sa", "kay"

Output schema:
{
  "language": "english" | "filipino" | "taglish" | "mixed",
  "persona": "listener" | "guide" | "crisis" | "companion" | "anchor",
  "isAngry": boolean,
  "isCrisis": boolean,
  "confidence": "low" | "medium" | "high",
  "reasoning": "short summary of how you decided"
}`;

        const analysisModel = gemini.getGenerativeModel({
          model: "gemini-2.0-flash",
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

           console.log('[DEBUG] AI Analysis Result:', {
             language: analysis.language,
             persona: analysis.persona,
             isAngry: analysis.isAngry,
             isCrisis: analysis.isCrisis,
             confidence: analysis.confidence,
             reasoning: analysis.reasoning
           });

           // Select persona based on AI analysis
           let chosenPersona = personaArray.find(p => p.id === analysis.persona);

           // Override with anchor persona if anger detected
           if (analysis.isAngry && (!analysis.confidence || analysis.confidence !== 'low')) {
             console.log('[DEBUG] Anger detected with confidence:', analysis.confidence || 'undefined', '- switching to anchor persona');
             const anchorPersona = personaArray.find(p => p.id === 'anchor');
             if (anchorPersona) {
               chosenPersona = anchorPersona;
               console.log('[DEBUG] Successfully switched to anchor persona');
             } else {
               console.log('[DEBUG] Anchor persona not found in personaArray');
             }
           } else {
             console.log('[DEBUG] No anger override triggered. isAngry:', analysis.isAngry, 'confidence:', analysis.confidence || 'undefined');
           }

          if (chosenPersona) {
            selectedPersona = chosenPersona.id;
            personaSystemInstruction = chosenPersona.systemInstruction;
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

      const model = gemini.getGenerativeModel({
        model: "gemini-2.0-flash",
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
        try {
          const result = await chatSession.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            aiResponseText += chunkText;
            await stream.writeSSE({ data: chunkText });
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
        model: "gemini-2.0-flash",
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
  });

export default personaCards;
export type PersonaCardsType = typeof personaCards;