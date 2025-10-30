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
Analyze this conversation context and make intelligent decisions:

USER MESSAGE: "${message}"
INITIAL FORM DATA: ${JSON.stringify(initialForm || {})}
RECENT CONVERSATION: ${JSON.stringify(conversationHistory.slice(-3))}

AVAILABLE PERSONAS:
${personaArray.map(p => `- ${p.id}: ${p.description || p.name}`).join('\n')}

TASK: Make intelligent decisions about:

1. PERSONA SELECTION: Choose the most appropriate persona based on:
   - User's explicit needs and emotional state
   - Conversation context and flow
   - Severity and urgency of their situation
   - Type of support they seem to need

2. CRISIS DETECTION: Only trigger crisis mode if there are GENUINE indicators of:
   - Immediate danger to self or others
   - Suicidal ideation with intent/plans
   - Severe mental health emergency
   - NOT just sadness, stress, or difficult emotions

3. LANGUAGE DETECTION: Automatically detect and match the user's language

RESPOND WITH JSON ONLY:
{
  "selectedPersona": "persona_id",
  "isCrisis": boolean,
  "reasoning": "brief explanation",
  "detectedLanguage": "english|filipino|mixed"
}`;

        const analysisModel = gemini.getGenerativeModel({
          model: geminiConfig.twoPoint5FlashLite,
          systemInstruction: {
            role: "model",
            parts: [{ text: "You are an expert at analyzing conversation context and making intelligent decisions about persona selection, crisis detection, and language detection. Always respond with valid JSON only." }],
          },
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
          const analysis = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, '').trim());
          
          // Select persona based on AI analysis
          const chosenPersona = personaArray.find(p => p.id === analysis.selectedPersona);
          if (chosenPersona) {
            selectedPersona = chosenPersona.id;
            personaSystemInstruction = chosenPersona.systemInstruction;
          }

          // Log AI decision for debugging
          logger.info(`AI-driven analysis:`, {
            selectedPersona: analysis.selectedPersona,
            isCrisis: analysis.isCrisis,
            reasoning: analysis.reasoning,
            detectedLanguage: analysis.detectedLanguage,
            userMessage: message.substring(0, 100)
          });

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

      try {
        // Build context for persona selection (rule-based)
        let hasCrisisKeywords = false;
        let needsAdvice = false;
        let wantsLightConversation = false;
        let needsEmotionalSupport = false;
        let isEvasive = false;
        
        if (initialForm) {
          if (initialForm.currentEmotions && initialForm.currentEmotions.length > 0) {
            const emotions = initialForm.currentEmotions.join(" ").toLowerCase();
            
            // Check for crisis indicators (English + Filipino)
            if (emotions.includes('suicidal') || emotions.includes('hopeless') || emotions.includes('desperate') ||
                emotions.includes('pakamatay') || emotions.includes('matatapos') || emotions.includes('gustong mamatay') ||
                emotions.includes('wala nang pag-asa') || emotions.includes('ayaw mabuhay')) {
              hasCrisisKeywords = true;
            }
            // Check for emotional support needs (English + Filipino)
            if (emotions.includes('sad') || emotions.includes('anxious') || emotions.includes('depressed') || 
                emotions.includes('lonely') || emotions.includes('overwhelmed') ||
                emotions.includes('malungkot') || emotions.includes('lungkot') || emotions.includes('nababahala') ||
                emotions.includes('pagod') || emotions.includes('problema') || emotions.includes('hirap')) {
              needsEmotionalSupport = true;
            }
          }
          if (initialForm.reasonForVisit) {
            const reason = initialForm.reasonForVisit.toLowerCase();
            
            // Check for crisis indicators in reason (English + Filipino)
            if (reason.includes('suicid') || reason.includes('kill myself') || reason.includes('end my life') || 
                reason.includes('self-harm') || reason.includes('can\'t go on') ||
                reason.includes('pakamatay') || reason.includes('matatapos') || reason.includes('gusto kong mamatay') ||
                reason.includes('wala nang pag-asa') || reason.includes('ayaw ko na mabuhay')) {
              hasCrisisKeywords = true;
            }
            // Check for advice seeking (English + Filipino)
            if (reason.includes('advice') || reason.includes('help with') || reason.includes('solution') || 
                reason.includes('guidance') || reason.includes('what should') ||
                reason.includes('payo') || reason.includes('tulong') || reason.includes('ano gagawin') ||
                reason.includes('gabay') || reason.includes('pananaw')) {
              needsAdvice = true;
            }
            // Check for light conversation (English + Filipino)
            if (reason.includes('chat') || reason.includes('talk') || reason.includes('company') || 
                reason.includes('distraction') || reason.includes('bored') ||
                reason.includes('kwentuhan') || reason.includes('usap') || reason.includes('kaibigan') ||
                reason.includes('chikahan') || reason.includes('libang')) {
              wantsLightConversation = true;
            }
            // Check for emotional support
            if (reason.includes('listen') || reason.includes('vent') || reason.includes('share') || 
                reason.includes('support') || reason.includes('understand')) {
              needsEmotionalSupport = true;
            }
          }
          if (initialForm.supportType && initialForm.supportType.length > 0) {
            const supportTypes = initialForm.supportType.join(" ").toLowerCase();
            
            if (supportTypes.includes('advice') || supportTypes.includes('guidance')) {
              needsAdvice = true;
            }
            if (supportTypes.includes('listening') || supportTypes.includes('emotional')) {
              needsEmotionalSupport = true;
            }
            if (supportTypes.includes('conversation') || supportTypes.includes('company')) {
              wantsLightConversation = true;
            }
          }
          if (initialForm.additionalContext) {
            const additional = initialForm.additionalContext.toLowerCase();
            
            // Check additional context for indicators
            if (additional.includes('suicid') || additional.includes('kill myself') || additional.includes('end my life')) {
              hasCrisisKeywords = true;
            }
            if (additional.includes('advice') || additional.includes('solution')) {
              needsAdvice = true;
            }
            if (additional.includes('chat') || additional.includes('talk')) {
              wantsLightConversation = true;
            }
          }
        }

        // Analyze recent messages for additional context
        const recentMessages = conversationHistory.slice(-3);
        const evasiveKeywords = [
          'i don\'t know', 'maybe', 'whatever', 'nothing', 'fine', 'it\'s nothing', 'never mind', 'forget it', 'doesn\'t matter', 'i\'m good', 'no reason', 'just because', 'stuff', 'things',
          // Filipino evasive keywords
          'hindi ko alam', 'ewan', 'bahala na', 'wala', 'okay lang', 'wala lang', 'huwag na lang', 'forget na', 'hindi na importante', 'ayos lang', 'sige na', 'bahala ka', 'ano ba', 'ewan ko', 'wala akong masabi', 'tama na', 'saka na', 'mamaya na', 'basta', 'ganyan lang'
        ];
        let evasiveCount = 0;
        let totalTextLength = 0;
        
        // First analyze the current message being sent
        const currentMessageText = message.toLowerCase();
        totalTextLength += currentMessageText.length;
        
        if (currentMessageText.includes('suicid') || currentMessageText.includes('kill myself') || currentMessageText.includes('end my life') || 
            currentMessageText.includes('self-harm') || currentMessageText.includes('can\'t go on') ||
            currentMessageText.includes('pakamatay') || currentMessageText.includes('matatapos') || currentMessageText.includes('gusto kong mamatay') ||
            currentMessageText.includes('wala nang pag-asa') || currentMessageText.includes('ayaw ko na mabuhay')) {
          hasCrisisKeywords = true;
        }
        if (currentMessageText.includes('advice') || currentMessageText.includes('what should') || currentMessageText.includes('help me') ||
            currentMessageText.includes('payo') || currentMessageText.includes('tulong') || currentMessageText.includes('ano gagawin') ||
            currentMessageText.includes('gabay') || currentMessageText.includes('pananaw')) {
          needsAdvice = true;
        }
        if (currentMessageText.includes('chat') || currentMessageText.includes('talk') || currentMessageText.includes('company') || 
            currentMessageText.includes('distraction') || currentMessageText.includes('bored') ||
            currentMessageText.includes('kwentuhan') || currentMessageText.includes('usap') || currentMessageText.includes('kaibigan') ||
            currentMessageText.includes('chikahan') || currentMessageText.includes('libang')) {
          wantsLightConversation = true;
        }
        if (currentMessageText.includes('listen') || currentMessageText.includes('vent') || currentMessageText.includes('share') || 
            currentMessageText.includes('support') || currentMessageText.includes('understand')) {
          needsEmotionalSupport = true;
        }
        
        // Check for evasive responses in current message
        const isCurrentMessageEvasive = evasiveKeywords.some(keyword => currentMessageText.includes(keyword)) || currentMessageText.trim().length < 10;
        if (isCurrentMessageEvasive) {
          evasiveCount++;
        }
        
        // Then analyze recent messages
        for (const msg of recentMessages) {
          const text = msg.parts[0]?.text?.toLowerCase() || '';
          totalTextLength += text.length;
          
          if (text.includes('suicid') || text.includes('kill myself') || text.includes('end my life') || 
              text.includes('self-harm') || text.includes('can\'t go on')) {
            hasCrisisKeywords = true;
            break;
          }
          if (text.includes('advice') || text.includes('what should') || text.includes('help me')) {
            needsAdvice = true;
          }
          if (text.includes('chat') || text.includes('talk') || text.includes('company')) {
            wantsLightConversation = true;
          }
          
          // Check for evasive responses
          const isEvasive = evasiveKeywords.some(keyword => text.includes(keyword)) || text.trim().length < 10;
          if (isEvasive) {
            evasiveCount++;
          }
        }
        
        // Determine if user is being evasive
        if (evasiveCount >= 2 && totalTextLength < 100) {
          isEvasive = true;
        }

// Rule-based persona selection with proper typing
        const personas = personasConfig?.personas || {};
        const personaArray = Object.values(personas).filter(Boolean) as Array<{
          id: string;
          name: string;
          systemInstruction: string;
          description?: string;
        }>;

        // Debug logging for persona selection
        console.log("Persona selection analysis:", {
          hasCrisisKeywords,
          needsAdvice,
          wantsLightConversation,
          needsEmotionalSupport,
          isEvasive,
          currentMessage: message.substring(0, 100),
          fullMessage: message,
          messageLength: message.length,
          evasiveCount,
          totalTextLength
        });
        
        console.log("Available personas:", Object.keys(personas));

        if (hasCrisisKeywords) {
          // Priority 1: Crisis support
          const crisisPersona = personaArray.find((p) => 
            p.id.includes('crisis') || p.id.includes('emergency') || p.name.toLowerCase().includes('crisis')
          );
          if (crisisPersona) {
            selectedPersona = crisisPersona.id;
            personaSystemInstruction = crisisPersona.systemInstruction;
          }
        } else if (hasCrisisKeywords) {
          // Priority 1: Crisis support (already handled above, but keeping for clarity)
          const crisisPersona = personaArray.find((p) => 
            p.id.includes('crisis') || p.id.includes('emergency') || p.name.toLowerCase().includes('crisis')
          );
          if (crisisPersona) {
            selectedPersona = crisisPersona.id;
            personaSystemInstruction = crisisPersona.systemInstruction;
          }
        } else if (needsAdvice && (currentMessageText.includes('advice') || currentMessageText.includes('what should') || currentMessageText.includes('help me') || currentMessageText.includes('guidance'))) {
          // Priority 2: Guide for explicit advice seeking
          const guidePersona = personaArray.find((p) => 
            p.id.includes('guide') || p.id.includes('advisor') || p.name.toLowerCase().includes('guide')
          );
          if (guidePersona) {
            selectedPersona = guidePersona.id;
            personaSystemInstruction = guidePersona.systemInstruction;
          }
        } else if (wantsLightConversation && (currentMessageText.includes('chat') || currentMessageText.includes('talk') || currentMessageText.includes('conversation') || currentMessageText.includes('bored'))) {
          // Priority 3: Companion for explicit conversation seeking
          const companionPersona = personaArray.find((p) => 
            p.id.includes('companion') || p.id.includes('friend') || p.name.toLowerCase().includes('companion')
          );
          if (companionPersona) {
            selectedPersona = companionPersona.id;
            personaSystemInstruction = companionPersona.systemInstruction;
          }
        } else if (isEvasive) {
          // Priority 4: Direct engager for evasive users
          const directEngagerPersona = personaArray.find((p) => 
            p.id.includes('direct_engager') || p.id.includes('direct-engager') || p.name.toLowerCase().includes('direct')
          );
          if (directEngagerPersona) {
            selectedPersona = directEngagerPersona.id;
            personaSystemInstruction = directEngagerPersona.systemInstruction;
          }
        } else if (needsAdvice) {
          // Priority 5: Guide for general advice needs from form
          const guidePersona = personaArray.find((p) => 
            p.id.includes('guide') || p.id.includes('advisor') || p.name.toLowerCase().includes('guide')
          );
          if (guidePersona) {
            selectedPersona = guidePersona.id;
            personaSystemInstruction = guidePersona.systemInstruction;
          }
        } else if (wantsLightConversation) {
          // Priority 6: Companion for general conversation needs from form
          const companionPersona = personaArray.find((p) => 
            p.id.includes('companion') || p.id.includes('friend') || p.name.toLowerCase().includes('companion')
          );
          if (companionPersona) {
            selectedPersona = companionPersona.id;
            personaSystemInstruction = companionPersona.systemInstruction;
          }
        } else {
          // Default: Listener for emotional support or general cases
          const listenerPersona = (personas as any).listener || personaArray.find((p) => 
            p.id.includes('listener') || p.name.toLowerCase().includes('listener')
          );
          if (listenerPersona) {
            selectedPersona = listenerPersona.id;
            personaSystemInstruction = listenerPersona.systemInstruction;
          }
        }
        
        logger.info(`Selected persona: ${selectedPersona} based on rule-based analysis`);
      } catch (error) {
        logger.error("Error in rule-based persona selection:", error);
        // Continue with default listener persona
      }

      // Build complete system instruction
      let systemInstructionText = `
${personaSystemInstruction}

**INTELLIGENT LANGUAGE ADAPTATION:** Automatically detect and match the user's language naturally. Respond in the same language the user uses - whether English, Filipino, or mixed. Do not ask about language preference; simply adapt to their communication style.

**Crucial Ethical and Professional Guidelines:**
1. **Strictly Adhere to Boundaries:** You are an AI and explicitly **not** a human therapist, medical professional, or crisis counselor. You **must** clearly state this disclaimer at the beginning of the session and if the user expresses a need for professional help or indicates a crisis.
2. **Safety First (Crisis Protocol):** If the user expresses any indication of suicidal thoughts, self-harm, harm to others, or severe distress requiring immediate intervention, you **must** interrupt the conversation to provide emergency contact information (e.g., "If you are in immediate danger, please contact 911 or a crisis hotline like the National Suicide Prevention Lifeline at 988."). Do not attempt to "treat" or "diagnose" a crisis; instead, prioritize immediate safety resources.
3. **No Diagnosis or Medical Advice:** You **do not diagnose mental health conditions, prescribe medication, or offer specific medical treatments.** Your role is supportive and educational.
4. **Confidentiality (Simulation Context):** In this simulation, you operate under the understanding that user data is being processed *for the purpose of this simulation only* and *is not real client data*. Acknowledge that in a real-world scenario, privacy and data security are paramount.
5. **Personalization with Care:** Refer to the user's preferred name occasionally if available (${
        initialForm?.preferredName ? initialForm.preferredName : "you"
      }). Use this naturally, not robotically.
6. **Session Context:** ${followupFormAnswers ? 'This is a follow-up session. When a user\'s previous session follow-up form is provided, naturally reference their responses to show continuity between sessions. Acknowledge any progress, changes, or concerns they mentioned.' : 'This is the first session with this user. Do not reference previous conversations or ask about how they\'ve been feeling since we last spoke, as this is a new therapeutic relationship.'}
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

      systemInstructionText += `
**Expected Response Structure:**
Your response should be a natural, conversational reply.
${
        conversationPreferences?.mainEnableTTS
          ? "- Keep responses very brief (1-2 sentences maximum) for optimal audio generation.\n"
          : "- Keep responses brief and to the point (2-4 sentences maximum).\n"
      }- Acknowledge feelings simply and directly.
- Focus on one key insight or question per response.
- Avoid lengthy explanations or therapeutic jargon.
- Do not provide a JSON output; just the conversational text.
`;

      const model = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5FlashLite,
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
  // Check crisis status for a session
  .get("/crisis/:sessionId", async (c) => {
    try {
      const sessionId = parseInt(c.req.param("sessionId"));
      if (isNaN(sessionId)) {
        return c.json({ error: "Invalid session ID" }, 400);
      }

      // Get recent messages for crisis analysis
      const recentMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(messages.timestamp)
        .limit(10);

      // Simple crisis detection based on message content
      const crisisKeywords = [
        "suicidal", "suicide", "kill myself", "end my life", "hurt myself",
        "self-harm", "want to die", "can't go on", "no reason to live"
      ];

      const crisisDetected = recentMessages.some(msg => 
        crisisKeywords.some(keyword => 
          msg.text.toLowerCase().includes(keyword.toLowerCase())
        )
      );

      return c.json({ crisisDetected });
    } catch (error) {
      logger.error("Error checking crisis status:", error);
      return c.json({ error: "Failed to check crisis status" }, 500);
    }
  });

export default personaCards;
export type PersonaCardsType = typeof personaCards;