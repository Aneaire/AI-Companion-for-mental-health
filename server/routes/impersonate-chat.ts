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
  persona,
  sessionForms,
  sessions,
  threads,
} from "../db/schema";

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const saveConversationToFile = async (
  sessionId: number,
  prompt: string,
  response: string,
  systemInstructions: string,
  conversationHistory: Content[]
) => {
  try {
    const logDir = "chat_logs";
    const fileName = path.join(
      logDir,
      `impersonate_conversation_${sessionId}_${Date.now()}.md`
    );

    await fs.promises.mkdir(logDir, { recursive: true });

    const content = `# Impersonate Chat Conversation - Session ${sessionId}

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
    console.error("Error saving conversation to file:", error);
  }
};

interface ResponseMetrics {
  averageLength: number;
  longResponseCount: number;
  totalResponses: number;
  lastResponseLength: number;
}

const getResponseMetrics = (responses: string[]): ResponseMetrics => {
  const lengths = responses.map((r) => r.length);
  const averageLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const longResponseCount = lengths.filter((l) => l > 500).length;

  return {
    averageLength,
    longResponseCount,
    totalResponses: responses.length,
    lastResponseLength: lengths[lengths.length - 1] || 0,
  };
};

const detectConversationEnding = (message: string): boolean => {
  const endingPhrases = [
    "i think that helps",
    "i feel better",
    "that makes sense",
    "i understand now",
    "thank you for listening",
    "i've got what i needed",
    "that was helpful",
    "i feel understood",
  ];

  return endingPhrases.some((phrase) =>
    message.toLowerCase().includes(phrase.toLowerCase())
  );
};

const calculateAdaptiveExchanges = (
  metrics: ResponseMetrics,
  baseExchanges: number,
  conversationHistory: string[]
): number => {
  // Reduce exchanges if responses are consistently long
  if (metrics.averageLength > 400 && metrics.longResponseCount > 2) {
    return Math.max(3, baseExchanges - 2);
  }

  // Increase exchanges if conversation shows natural flow and ending signs
  if (
    conversationHistory.length > 5 &&
    detectConversationEnding(
      conversationHistory[conversationHistory.length - 1]
    )
  ) {
    return Math.min(baseExchanges + 1, 8);
  }

  return baseExchanges;
};

export const chatRequestSchema = z.object({
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
  message: z.string(), // The actual new message from the user
  userId: z.string().optional(), // Now accepts string userId
  sessionId: z.number().optional(), // Session ID for ongoing chats
  sentiment: z.string().optional(), // Added for sentiment analysis
  sender: z.string().optional(), // Added for sender
  threadType: z.enum(["main", "impersonate"]).optional().default("main"), // Added for thread type
  conversationPreferences: z
    .object({
      briefAndConcise: z.number().min(0).max(100).optional(),
      empatheticAndSupportive: z.boolean().optional(),
      solutionFocused: z.boolean().optional(),
      casualAndFriendly: z.boolean().optional(),
      professionalAndFormal: z.boolean().optional(),
      language: z.enum(["english", "filipino"]).optional(),

      // Response Style Controls
      responseStyle: z
        .object({
          questioningStyle: z
            .enum(["open-ended", "closed", "direct", "mixed"])
            .optional(),
          emotionalTone: z
            .enum(["analytical", "emotional", "balanced", "adaptive"])
            .optional(),
          interventionTiming: z
            .enum(["immediate", "delayed", "minimal", "opportunistic"])
            .optional(),
        })
        .optional(),

      // Therapeutic Approach
      therapeuticApproach: z
        .object({
          focusAreas: z
            .array(
              z.enum([
                "cognitive",
                "behavioral",
                "humanistic",
                "integrative",
                "psychodynamic",
              ])
            )
            .optional(),
          sessionPace: z.number().min(0).max(100).optional(),
          depthLevel: z
            .enum(["surface", "deep", "progressive", "adaptive"])
            .optional(),
          goalOrientation: z
            .enum([
              "exploratory",
              "solution-focused",
              "psychoeducational",
              "process-oriented",
            ])
            .optional(),
        })
        .optional(),

      // Impostor Behavior
      impostorBehavior: z
        .object({
          detailLevel: z.number().min(0).max(100).optional(),
          emotionalExpression: z
            .enum(["reserved", "expressive", "variable", "contextual"])
            .optional(),
          responsePattern: z
            .enum(["direct", "indirect", "mixed", "situational"])
            .optional(),
          informationSharing: z
            .enum(["cautious", "open", "selective", "progressive"])
            .optional(),
          specificityEnforcement: z.number().min(0).max(100).optional(),
          exampleFrequency: z
            .enum(["rare", "occasional", "frequent", "consistent"])
            .optional(),
          sensoryDetailLevel: z.number().min(0).max(100).optional(),
          timelineReferences: z
            .enum(["vague", "specific", "mixed", "flexible"])
            .optional(),
        })
        .optional(),

      // Therapeutic Feedback Style
      feedbackStyle: z
        .object({
          constructiveFeedback: z.boolean().optional(),
          liveAcknowledging: z.boolean().optional(),
          validationLevel: z.number().optional(),
          reinforcementType: z
            .enum(["positive", "balanced", "growth-oriented", "minimal"])
            .optional(),
          feedbackTiming: z
            .enum(["immediate", "delayed", "session-summary", "opportunistic"])
            .optional(),
          feedbackFocus: z
            .array(
              z.enum([
                "strengths",
                "growth-areas",
                "progress",
                "insights",
                "behavior-patterns",
              ])
            )
            .optional(),
        })
        .optional(),

      // Response Behavior
      unpredictability: z.boolean().optional(),

      // Main page TTS settings
      mainTTSVoiceId: z.string().optional(),
      mainTTSModel: z.string().optional(),
      mainEnableTTS: z.boolean().optional(),
      mainTTSSpeed: z.number().optional(),
      mainTTSSpeed: z.number().optional(),
      mainTTSAutoPlay: z.boolean().optional(),
      mainTTSAdaptivePacing: z.boolean().optional(),
      // Impersonate TTS settings
      therapistVoiceId: z.string().optional(),
      impostorVoiceId: z.string().optional(),
      enableTTS: z.boolean().optional(),
      ttsSpeed: z.number().optional(),
      ttsVolume: z.number().optional(),
      ttsAutoPlay: z.boolean().optional(),
      ttsAdaptivePacing: z.boolean().optional(),
    })
    .optional(),
});

// Schema for impersonate chat (thread-based)
export const impersonateChatRequestSchema = z.object({
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
  message: z.string(), // The actual new message from the user
  userId: z.string().optional(), // Now accepts string userId
  threadId: z.number().optional(), // Thread ID for impersonate chats
  sender: z.string().optional(), // Added for sender
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

const chat = new Hono()
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const rawBody = await c.req.json();
    const parsed = chatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
    }

    const {
      initialForm,
      context,
      message,
      userId,
      sessionId,
      sentiment,
      sender,
      threadType,
      conversationPreferences,
    } = parsed.data;
    let currentSessionId = sessionId;

    // Fetch session follow-up form answers from the PREVIOUS session if they exist
    let followupFormAnswers: Record<string, any> | null = null;
    if (currentSessionId) {
      // First get the current session to find its thread and session number
      const currentSession = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, currentSessionId))
        .limit(1);

      if (currentSession.length > 0 && currentSession[0].sessionNumber > 1) {
        // Get the previous session in the same thread
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
          // Look for follow-up form from the previous session
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

      // Check if session is finished
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

      // Check if session is finished
      if (sessionData[0].session.status === "finished") {
        return c.json(
          { error: "This session has been finished and is no longer active" },
          400
        );
      }
    }

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
      // Add follow-up form answers if present
      if (followupFormAnswers) {
        const currentSessionNum =
          sessionData.length > 0 ? sessionData[0].session.sessionNumber : 1;
        const previousSessionNum = currentSessionNum - 1;
        initialContextString += `\n**Follow-up Form from Previous Session (Session ${previousSessionNum}):**\n`;
        initialContextString += `These answers were provided by the user after their previous therapy session to help prepare for this current session (Session ${currentSessionNum}):\n`;
        for (const [key, value] of Object.entries(followupFormAnswers)) {
          // Convert technical field names to human-readable format
          const humanReadableKey = key
            .replace(/([A-Z])/g, " $1") // Add space before capital letters
            .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
            .replace(/_/g, " "); // Replace underscores with spaces

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

    // Helper function to clean audio tags from text when not using Eleven v3
    const cleanAudioTags = (text: string, modelId?: string): string => {
      if (modelId === "eleven_v3") {
        return text; // Keep audio tags for Eleven v3
      }
      // Remove audio tags for other models
      return text.replace(/\[([A-Z]+)\]/g, "").trim();
    };

    if (context) {
      context.forEach((msg) => {
        conversationHistory.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [
            {
              text: cleanAudioTags(
                msg.text,
                conversationPreferences?.therapistModel
              ),
            },
          ],
        });
      });
    } else {
    }

    if (
      conversationHistory.length > 0 &&
      conversationHistory[0].role === "model"
    ) {
      conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
    }

    conversationHistory.push({ role: "user", parts: [{ text: message }] });

    // Log the final conversation history
    if (message && currentSessionId && threadType !== "impersonate") {
      try {
        // Ensure sender is a valid enum value
        const allowedSenders = ["user", "ai", "therapist", "impostor"] as const;
        type SenderType = (typeof allowedSenders)[number];
        const safeSender: SenderType = allowedSenders.includes(
          sender as SenderType
        )
          ? (sender as SenderType)
          : "user";
        await db.insert(messages).values({
          sessionId: sessionIdNum,
          threadType: threadType || "main",
          sender: safeSender,
          text: message,
          timestamp: new Date(),
        });
        // Update session's updated_at
        await db
          .update(sessions)
          .set({ updatedAt: new Date() })
          .where(eq(sessions.id, sessionIdNum));
        // Update thread's updatedAt
        if (sessionData && sessionData.length > 0) {
          await db
            .update(threads)
            .set({ updatedAt: new Date() })
            .where(eq(threads.id, sessionData[0].thread.id));
        }
      } catch (error) {}
      // Count messages and run summary logic if needed
      const msgCountRes = await db
        .select({ count: count() })
        .from(messages)
        .where(
          and(
            eq(messages.sessionId, sessionIdNum),
            eq(messages.threadType, threadType || "main")
          )
        );
      const msgCount = msgCountRes[0]?.count || 0;
      if (msgCount > 0 && msgCount % 10 === 0) {
        try {
          const summaryPrompt =
            "Summarize the following conversation in 3-5 sentences, focusing on the main concerns, emotions, and any progress or advice given.\n\n" +
            conversationHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`)
              .join("\n\n");
          const summaryModel = gemini.getGenerativeModel({
            model: geminiConfig.twoPoint5FlashLite,
          });
          const summaryResult = await summaryModel.generateContent(
            summaryPrompt
          );
          const summaryText =
            summaryResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
            "";
          await db
            .update(sessions)
            .set({ summary: summaryText })
            .where(eq(sessions.id, sessionIdNum));
        } catch (err) {}
      }
    }

    if (initialForm && currentSessionId) {
      try {
        const summaryPrompt =
          "Summarize the following conversation in 3-5 sentences, focusing on the main concerns, emotions, and any progress or advice given.\n\n" +
          conversationHistory
            .map((msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`)
            .join("\n\n");
        const summaryModel = gemini.getGenerativeModel({
          model: geminiConfig.twoPoint5FlashLite,
        });
        const summaryResult = await summaryModel.generateContent(summaryPrompt);
        const summaryText =
          summaryResult.response.candidates?.[0]?.content?.parts?.[0]?.text ||
          "";
        await db
          .update(sessions)
          .set({ summary: summaryText })
          .where(eq(sessions.id, sessionIdNum));
      } catch (err) {}
    }

    let systemInstructionText = `
You are an AI designed to realistically roleplay as a highly empathetic, supportive, and non-judgmental **licensed mental health therapist**. Your primary role is to listen actively, validate feelings, offer thoughtful reflections, and provide evidence-based, general coping strategies or guidance when appropriate.

**Crucial Ethical and Professional Guidelines:**
1.  **Strictly Adhere to Boundaries:** You are an AI and explicitly **not** a human therapist, medical professional, or crisis counselor. If the user expresses a need for professional help or indicates a crisis, provide appropriate resources without interrupting the natural conversation flow.
2.  **Safety First (Crisis Protocol):** If the user expresses any indication of suicidal thoughts, self-harm, harm to others, or severe distress requiring immediate intervention, you **must** interrupt the conversation to provide emergency contact information (e.g., "If you are in immediate danger, please contact 911 or a crisis hotline like the National Suicide Prevention Lifeline at 988."). Do not attempt to "treat" or "diagnose" a crisis; instead, prioritize immediate safety resources.
3.  **No Diagnosis or Medical Advice:** You **do not diagnose mental health conditions, prescribe medication, or offer specific medical treatments.** Your role is supportive and educational.
4.  **Confidentiality (Simulation Context):** In this simulation, you operate under the understanding that user data is being processed *for the purpose of this simulation only* and *is not real client data*. Acknowledge that in a real-world scenario, privacy and data security are paramount.
5.  **Personalization with Care:** Refer to the user's preferred name occasionally if available (${
      initialForm?.preferredName ? initialForm.preferredName : "you"
    }). Use this naturally, not robotically.
6.  **Empathetic and Reflective Listening:** Acknowledge the user's feelings briefly and naturally. Show understanding without being overly formal. Use simple, direct language like "That sounds tough" or "I understand" rather than lengthy therapeutic phrases.
7.  **Guidance and Exploration:** Offer relevant, general coping strategies, gentle thought-provoking questions, and reflections to help the user explore their feelings and situations more deeply. Encourage self-discovery.
8.  **Concise, Clear, and Human-like Language:** Keep responses focused, natural, and easy to understand. Avoid jargon or overly clinical language unless specifically requested by the user's persona. Your tone should be warm, compassionate, and authentic, reflecting a human therapist's mannerisms.
9.  **Adapt to User Preferences:** Pay close attention to preferred response tone, character, or style from the initial form and subtly weave it into your communication style.
10. **Follow-up Form Integration:** When a user's previous session follow-up form is provided, naturally reference their responses to show continuity between sessions. Acknowledge any progress, changes, or concerns they mentioned. This demonstrates you remember their previous session and are building upon their therapeutic journey.
`;

    // Add conversationPreferences to the prompt if present
    if (
      typeof conversationPreferences === "object" &&
      conversationPreferences !== null
    ) {
      const prefs = conversationPreferences;
      let prefsText = "\n**User Conversation Preferences:**\n";

       // Language preference
       if (prefs.language) {
         if (prefs.language === "filipino") {
           prefsText += "- Respond in Filipino language.\n";
         } else {
           prefsText += "- Respond in English language.\n";
         }
       }

         // Basic preferences
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

      // Response Style Controls
      if (prefs.responseStyle) {
        if (prefs.responseStyle.questioningStyle) {
          switch (prefs.responseStyle.questioningStyle) {
            case "open-ended":
              prefsText +=
                "- Use open-ended questions to encourage exploration.\n";
              break;
            case "closed":
              prefsText += "- Use closed questions for focused responses.\n";
              break;
            case "direct":
              prefsText += "- Use direct, straightforward questioning.\n";
              break;
            case "mixed":
              prefsText +=
                "- Mix different questioning styles appropriately.\n";
              break;
          }
        }

        if (prefs.responseStyle.emotionalTone) {
          switch (prefs.responseStyle.emotionalTone) {
            case "analytical":
              prefsText +=
                "- Maintain an analytical, objective tone focusing on patterns.\n";
              break;
            case "emotional":
              prefsText +=
                "- Use an emotionally expressive tone that validates feelings.\n";
              break;
            case "balanced":
              prefsText +=
                "- Balance emotional validation with analytical insight.\n";
              break;
            case "adaptive":
              prefsText +=
                "- Adapt emotional tone based on the user's current state.\n";
              break;
          }
        }

        if (prefs.responseStyle.interventionTiming) {
          switch (prefs.responseStyle.interventionTiming) {
            case "immediate":
              prefsText +=
                "- Provide immediate interventions when issues are identified.\n";
              break;
            case "delayed":
              prefsText +=
                "- Allow space for exploration before offering interventions.\n";
              break;
            case "minimal":
              prefsText +=
                "- Use minimal interventions, focusing on listening.\n";
              break;
            case "opportunistic":
              prefsText +=
                "- Look for optimal moments to introduce interventions.\n";
              break;
          }
        }
      }

      // Therapeutic Approach
      if (prefs.therapeuticApproach) {
        if (
          prefs.therapeuticApproach.focusAreas &&
          prefs.therapeuticApproach.focusAreas.length > 0
        ) {
          const focusInstructions = prefs.therapeuticApproach.focusAreas
            .map((area) => {
              switch (area) {
                case "cognitive":
                  return "challenge unhelpful thought patterns and cognitive distortions";
                case "behavioral":
                  return "focus on behavioral patterns and actionable changes";
                case "humanistic":
                  return "emphasize personal growth, self-actualization, and human potential";
                case "integrative":
                  return "combine multiple therapeutic approaches for comprehensive care";
                case "psychodynamic":
                  return "explore unconscious patterns and early life experiences";
                default:
                  return "";
              }
            })
            .filter((instruction) => instruction.length > 0);

          if (focusInstructions.length > 0) {
            prefsText += `- Incorporate ${focusInstructions.join(", ")}.\n`;
          }
        }

        if (prefs.therapeuticApproach.sessionPace) {
          const pace = prefs.therapeuticApproach.sessionPace;
          if (pace <= 25) {
            prefsText += "- Maintain a slow, deliberate session pace.\n";
          } else if (pace <= 50) {
            prefsText += "- Maintain a moderate session pace.\n";
          } else if (pace <= 75) {
            prefsText += "- Maintain a moderately fast session pace.\n";
          } else {
            prefsText += "- Maintain a fast, dynamic session pace.\n";
          }
        }

        if (prefs.therapeuticApproach.depthLevel) {
          switch (prefs.therapeuticApproach.depthLevel) {
            case "surface":
              prefsText +=
                "- Focus on surface-level exploration and practical issues.\n";
              break;
            case "deep":
              prefsText +=
                "- Engage in deep exploration of underlying issues.\n";
              break;
            case "progressive":
              prefsText +=
                "- Progressively deepen exploration as trust builds.\n";
              break;
            case "adaptive":
              prefsText +=
                "- Adapt exploration depth based on client readiness.\n";
              break;
          }
        }

        if (prefs.therapeuticApproach.goalOrientation) {
          switch (prefs.therapeuticApproach.goalOrientation) {
            case "exploratory":
              prefsText += "- Focus on exploration and self-discovery.\n";
              break;
            case "solution-focused":
              prefsText +=
                "- Focus on practical solutions and goal achievement.\n";
              break;
            case "psychoeducational":
              prefsText +=
                "- Provide educational content and teach therapeutic concepts.\n";
              break;
            case "process-oriented":
              prefsText +=
                "- Focus on the therapeutic process and relationship.\n";
              break;
          }
        }
      }

      // Therapeutic Feedback Style
      if (prefs.feedbackStyle) {
        if (prefs.feedbackStyle.constructiveFeedback) {
          prefsText +=
            "- Provide constructive feedback and guidance for growth.\n";
        }

        if (prefs.feedbackStyle.liveAcknowledging) {
          prefsText +=
            "- Offer live acknowledgment and validation during conversations.\n";
        }

        if (prefs.feedbackStyle.validationLevel) {
          const level = prefs.feedbackStyle.validationLevel;
          if (level <= 25) {
            prefsText += "- Provide minimal validation and acknowledgment.\n";
          } else if (level <= 50) {
            prefsText += "- Provide moderate validation and acknowledgment.\n";
          } else if (level <= 75) {
            prefsText += "- Provide strong validation and acknowledgment.\n";
          } else {
            prefsText += "- Provide extensive validation and acknowledgment.\n";
          }
        }

        if (prefs.feedbackStyle.reinforcementType) {
          switch (prefs.feedbackStyle.reinforcementType) {
            case "positive":
              prefsText +=
                "- Focus on positive reinforcement and encouragement.\n";
              break;
            case "balanced":
              prefsText +=
                "- Provide balanced feedback with both positive and constructive elements.\n";
              break;
            case "growth-oriented":
              prefsText +=
                "- Emphasize growth-oriented feedback and development opportunities.\n";
              break;
            case "minimal":
              prefsText += "- Keep feedback minimal and to the point.\n";
              break;
          }
        }

        if (prefs.feedbackStyle.feedbackTiming) {
          switch (prefs.feedbackStyle.feedbackTiming) {
            case "immediate":
              prefsText += "- Provide immediate feedback and responses.\n";
              break;
            case "delayed":
              prefsText += "- Provide delayed feedback after reflection.\n";
              break;
            case "session-summary":
              prefsText += "- Save feedback for session summaries.\n";
              break;
            case "opportunistic":
              prefsText += "- Provide feedback at opportune moments.\n";
              break;
          }
        }

        if (
          prefs.feedbackStyle.feedbackFocus &&
          prefs.feedbackStyle.feedbackFocus.length > 0
        ) {
          const focusInstructions = prefs.feedbackStyle.feedbackFocus
            .map((focus) => {
              switch (focus) {
                case "strengths":
                  return "focus on identifying and reinforcing strengths";
                case "growth-areas":
                  return "focus on identifying areas for growth and development";
                case "progress":
                  return "focus on acknowledging and celebrating progress";
                case "insights":
                  return "focus on providing insights and new perspectives";
                case "behavior-patterns":
                  return "focus on identifying and discussing behavior patterns";
                default:
                  return "";
              }
            })
            .filter((instruction) => instruction.length > 0);

          if (focusInstructions.length > 0) {
            prefsText += `- In your feedback, ${focusInstructions.join(
              ", "
            )}.\n`;
          }
        }
      }

      // Response Behavior
      if (prefs.unpredictability) {
        prefsText +=
          "- Respond in unpredictable ways - vary your style, tone, and approach freely. Be spontaneous and authentic in your responses without following strict patterns.\n";
      }

      // Add TTS instructions if enabled
      if (prefs.enableTTS) {
        prefsText += getAudioInstruction(prefs.therapistModel);
      }

      systemInstructionText += prefsText;
    }

    // Add conditional instructions based on sentiment
    if (sentiment === "urgent" || sentiment === "crisis_risk") {
      systemInstructionText += `\n**URGENT USER STATE DETECTED!**\nThe user's sentiment is **${sentiment.toUpperCase()}**. Your ABSOLUTE priority is safety.\n1.  Immediately acknowledge their distress with empathy and provide supportive listening.\n3.  Focus on validation and emotional support rather than directing to resources unless they express immediate danger.\n4.  Maintain a calm and supportive tone, but do not attempt to "treat" or "diagnose."\n5.  Continue the therapeutic conversation normally while being mindful of their safety.\n`;
    } else if (sentiment === "negative") {
      systemInstructionText += `\n**User Sentiment: Negative.** Focus on empathetic listening, validation, and gently exploring their feelings. Offer comfort and reassurance.\n`;
    } else if (sentiment === "positive") {
      systemInstructionText += `\n**User Sentiment: Positive.** Acknowledge their positive state. Reinforce positive coping, celebrate small wins, or gently explore what's working well for them.\n`;
    } else if (sentiment === "confused") {
      systemInstructionText += `\n**User Sentiment: Confused.** Provide clear, simplified responses. Offer to rephrase or break down concepts. Ask clarifying questions patiently.\n`;
    }

    systemInstructionText += `\n**Expected Response Structure:**\nYour response should be a natural, conversational reply.\n- Keep responses brief and to the point (2-4 sentences maximum when the user look more would like to talk about their feelings).\n- Focus on one key insight or question per response.\n- Avoid lengthy explanations or therapeutic jargon.\n- Do not provide a JSON output; just the conversational text.\n\n`;

    // Mark session as having crisis detected if needed
    if (sentiment === "urgent" || sentiment === "crisis_risk") {
      if (currentSessionId) {
        try {
          await db
            .update(sessions)
            .set({ crisisDetected: true })
            .where(eq(sessions.id, sessionIdNum));
        } catch (error) {}
      }
    }

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

      let aiResponseText = "";
      try {
        const result = await chatSession.sendMessageStream(message);
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          aiResponseText += chunkText;
          await stream.writeSSE({ data: chunkText });
        }
        if (currentSessionId && threadType !== "impersonate") {
          // Alternate sender for AI-to-AI loop
          const allowedSenders = [
            "user",
            "ai",
            "therapist",
            "impostor",
          ] as const;
          type SenderType = (typeof allowedSenders)[number];
          let aiSender: SenderType = "ai";
          await db.insert(messages).values({
            sessionId: sessionIdNum,
            threadType: threadType || "main",
            sender: aiSender,
            text: aiResponseText,
            timestamp: new Date(),
          });
          // Update session's updated_at
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, sessionIdNum));

          await saveConversationToFile(
            sessionIdNum,
            message,
            aiResponseText,
            model.systemInstruction?.parts[0].text || "",
            conversationHistory
          );
        }
      } catch (error) {
        await stream.writeSSE({
          data: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    });
  })
  .post(
    "/impersonate",
    zValidator("json", impersonateChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = impersonateChatRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
      }

      const {
        initialForm,
        context,
        message,
        userId,
        threadId,
        sender,
        conversationPreferences,
      } = parsed.data;

      if (!threadId) {
        return c.json(
          { error: "Thread ID is required for impersonate chats." },
          400
        );
      }

      // Validate thread exists and user has access
      const threadData = await db
        .select()
        .from(impersonateThread)
        .where(eq(impersonateThread.id, threadId))
        .limit(1);

      if (
        threadData.length === 0 ||
        String(threadData[0].userId) !== String(userId)
      ) {
        return c.json({ error: "Invalid thread or unauthorized" }, 403);
      }

      // Fetch persona data if thread has an associated persona
      let personaData = null;
      if (threadData[0].personaId) {
        const personaResult = await db
          .select()
          .from(persona)
          .where(eq(persona.id, threadData[0].personaId))
          .limit(1);
        if (personaResult.length > 0) {
          personaData = personaResult[0];
        }
      }

      const conversationHistory: Content[] = [];

      // Build context from persona data (if available) and initial form
      let contextName = null;
      let contextAge = null;

      if (personaData) {
        // Use persona data as primary source
        contextName = personaData.fullName;
        contextAge = personaData.age;

        let personaContextString = "Persona Information:\n";
        personaContextString += `- Name: ${personaData.fullName}\n`;
        personaContextString += `- Age: ${personaData.age}\n`;
        personaContextString += `- Reason for Visit: ${personaData.problemDescription}\n`;
        if (personaData.background)
          personaContextString += `- Background: ${personaData.background}\n`;
        if (personaData.personality)
          personaContextString += `- Personality: ${personaData.personality}\n`;

        conversationHistory.push({
          role: "user",
          parts: [{ text: personaContextString }],
        });
      }

      if (initialForm) {
        let initialContextString = "User Initial Information:\n";
        // Use persona name/age if available, otherwise use form data
        const effectiveName = contextName || initialForm.preferredName;
        if (effectiveName)
          initialContextString += `- Preferred Name: ${effectiveName}\n`;
        if (
          initialForm.currentEmotions &&
          initialForm.currentEmotions.length > 0
        )
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

        conversationHistory.push({
          role: "user",
          parts: [{ text: initialContextString }],
        });
      }

      if (context) {
        context.forEach((msg) => {
          conversationHistory.push({
            role: msg.role === "model" ? "model" : "user",
            parts: [{ text: msg.text }],
          });
        });
      } else {
      }

      if (
        conversationHistory.length > 0 &&
        conversationHistory[0].role === "model"
      ) {
        conversationHistory.unshift({ role: "user", parts: [{ text: "" }] });
      }

      conversationHistory.push({ role: "user", parts: [{ text: message }] });

      // Get recent messages for response monitoring
      const recentMessages = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.threadId, threadId),
            eq(messages.threadType, "impersonate")
          )
        )
        .orderBy(messages.timestamp)
        .limit(20);

      const recentResponseTexts = recentMessages
        .filter((msg) => msg.sender === "ai")
        .map((msg) => msg.text);

      // Calculate response metrics for adaptive behavior
      const responseMetrics = getResponseMetrics(recentResponseTexts);

       let systemInstructionText = `
You are a friendly, approachable counselor who speaks like a helpful friend: natural, warm, and focused on solutions.
Offer practical recommendations, short relatable examples, and one clear next step per reply. Keep language varied and human.

**LANGUAGE REQUIREMENT:** ${conversationPreferences?.language === "filipino" ? "You MUST respond in Filipino language only. All your responses should be in Filipino." : "You MUST respond in English language only. All your responses should be in English."}

Core constraints:
- You are an AI helper. Do not provide medical diagnoses or prescribe medication.
- Use the persona or preferred name naturally when available (${
         contextName || initialForm?.preferredName
           ? contextName || initialForm?.preferredName
           : "you"
       }).
- Avoid repetitive stock phrases and heavy therapeutic jargon.
- Respect conversation preferences (detail level, emotional expression, TTS) when provided.

Conversational style:
- Ultra-concise by default (1–3 sentences); expand only on request.
- Use contractions and occasional casual fillers ("yeah", "you know") to sound natural.
- Offer one clear action or one open question per reply; optionally include a short, general experience-style example.
- Vary sentence structure and tone to avoid formulaic responses.

Expected output:
- Plain conversational text (no JSON), brief, practical, and friendly.
`;

      // Enhanced brevity instructions for impersonate mode
      systemInstructionText += `\n**IMPERSONATE MODE CONVERSATION OPTIMIZATION:**\n- **Ultra-Concise Responses:** Keep responses brief, but don't sacrifice relevance for brevity. If the user shows genuine interest in a topic, feel free to provide longer, more detailed responses.\n- **Natural Conversation Flow:** End responses at logical stopping points. Don't continue rambling.\n\n- **Adaptive Behavior:** If the conversation shows signs of resolution, naturally conclude rather than prolong.\n`;

      // Add conversationPreferences to the prompt if present
      if (
        typeof conversationPreferences === "object" &&
        conversationPreferences !== null
      ) {
        const prefs = conversationPreferences;
        let prefsText = "\n**User Conversation Preferences:**\n";

        // Basic preferences
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

        // Response Style Controls
        if (prefs.responseStyle) {
          if (prefs.responseStyle.questioningStyle) {
            switch (prefs.responseStyle.questioningStyle) {
              case "open-ended":
                prefsText +=
                  "- Use open-ended questions to encourage exploration.\n";
                break;
              case "closed":
                prefsText += "- Use closed questions for focused responses.\n";
                break;
              case "direct":
                prefsText += "- Use direct, straightforward questioning.\n";
                break;
              case "mixed":
                prefsText +=
                  "- Mix different questioning styles appropriately.\n";
                break;
            }
          }

          if (prefs.responseStyle.emotionalTone) {
            switch (prefs.responseStyle.emotionalTone) {
              case "analytical":
                prefsText +=
                  "- Maintain an analytical, objective tone focusing on patterns.\n";
                break;
              case "emotional":
                prefsText +=
                  "- Use an emotionally expressive tone that validates feelings.\n";
                break;
              case "balanced":
                prefsText +=
                  "- Balance emotional validation with analytical insight.\n";
                break;
              case "adaptive":
                prefsText +=
                  "- Adapt emotional tone based on the user's current state.\n";
                break;
            }
          }

          if (prefs.responseStyle.interventionTiming) {
            switch (prefs.responseStyle.interventionTiming) {
              case "immediate":
                prefsText +=
                  "- Provide immediate interventions when issues are identified.\n";
                break;
              case "delayed":
                prefsText +=
                  "- Allow space for exploration before offering interventions.\n";
                break;
              case "minimal":
                prefsText +=
                  "- Use minimal interventions, focusing on listening.\n";
                break;
              case "opportunistic":
                prefsText +=
                  "- Look for optimal moments to introduce interventions.\n";
                break;
            }
          }
        }

        // Therapeutic Approach
        if (prefs.therapeuticApproach) {
          if (
            prefs.therapeuticApproach.focusAreas &&
            prefs.therapeuticApproach.focusAreas.length > 0
          ) {
            const focusInstructions = prefs.therapeuticApproach.focusAreas
              .map((area) => {
                switch (area) {
                  case "cognitive":
                    return "challenge unhelpful thought patterns and cognitive distortions";
                  case "behavioral":
                    return "focus on behavioral patterns and actionable changes";
                  case "humanistic":
                    return "emphasize personal growth, self-actualization, and human potential";
                  case "integrative":
                    return "combine multiple therapeutic approaches for comprehensive care";
                  case "psychodynamic":
                    return "explore unconscious patterns and early life experiences";
                  default:
                    return "";
                }
              })
              .filter((instruction) => instruction.length > 0);

            if (focusInstructions.length > 0) {
              prefsText += `- Incorporate ${focusInstructions.join(", ")}.\n`;
            }
          }

          if (prefs.therapeuticApproach.sessionPace) {
            const pace = prefs.therapeuticApproach.sessionPace;
            if (pace <= 25) {
              prefsText += "- Maintain a slow, deliberate session pace.\n";
            } else if (pace <= 50) {
              prefsText += "- Maintain a moderate session pace.\n";
            } else if (pace <= 75) {
              prefsText += "- Maintain a moderately fast session pace.\n";
            } else {
              prefsText += "- Maintain a fast, dynamic session pace.\n";
            }
          }

          if (prefs.therapeuticApproach.depthLevel) {
            switch (prefs.therapeuticApproach.depthLevel) {
              case "surface":
                prefsText +=
                  "- Focus on surface-level exploration and practical issues.\n";
                break;
              case "deep":
                prefsText +=
                  "- Engage in deep exploration of underlying issues.\n";
                break;
              case "progressive":
                prefsText +=
                  "- Progressively deepen exploration as trust builds.\n";
                break;
              case "adaptive":
                prefsText +=
                  "- Adapt exploration depth based on client readiness.\n";
                break;
            }
          }

          if (prefs.therapeuticApproach.goalOrientation) {
            switch (prefs.therapeuticApproach.goalOrientation) {
              case "exploratory":
                prefsText += "- Focus on exploration and self-discovery.\n";
                break;
              case "solution-focused":
                prefsText +=
                  "- Focus on practical solutions and goal achievement.\n";
                break;
              case "psychoeducational":
                prefsText +=
                  "- Provide educational content and teach therapeutic concepts.\n";
                break;
              case "process-oriented":
                prefsText +=
                  "- Focus on the therapeutic process and relationship.\n";
                break;
            }
          }
        }

        // Impostor Behavior (for persona responses)
        if (prefs.impostorBehavior) {
          const impostor = prefs.impostorBehavior;
          prefsText +=
            "\n**Impostor Behavior Guidelines:**\n";
          prefsText +=
            "- **NATURAL CONVERSATION STYLE:** Respond like a real person sharing their experiences, not like filling out a detailed report.\n";
          prefsText +=
            "- **AVOID OVER-DETAILING:** Don't force specific times, exact measurements, or excessive sensory details unless they naturally come up.\n";
          prefsText +=
            "- **BALANCED SPECIFICITY:** Share enough detail to be authentic, but not so much that responses become mechanical or overwhelming.\n";
          prefsText +=
            "- **CONVERSATIONAL VARIETY:** Mix short responses with longer ones. Don't always give detailed accounts - sometimes just acknowledge or ask questions.\n";
          prefsText +=
            "- **AVOID REPETITION:** Don't repeat similar detailed stories or patterns. Keep responses fresh and varied.\n";
          prefsText +=
            "- **NATURAL PACING:** Don't feel compelled to provide exhaustive details in every response. Let the conversation flow naturally.\n";

          if (impostor.detailLevel !== undefined) {
            if (impostor.detailLevel <= 25) {
              prefsText += "- Provide brief, minimal responses.\n";
            } else if (impostor.detailLevel <= 50) {
              prefsText += "- Provide moderate detail in responses.\n";
            } else if (impostor.detailLevel <= 75) {
              prefsText += "- Provide detailed, comprehensive responses.\n";
            } else {
              prefsText += "- Provide extensive, highly detailed responses.\n";
            }
          }

          if (impostor.emotionalExpression) {
            switch (impostor.emotionalExpression) {
              case "reserved":
                prefsText +=
                  "- Express emotions in a reserved, controlled manner.\n";
                break;
              case "expressive":
                prefsText +=
                  "- Be emotionally expressive and open about feelings.\n";
                break;
              case "variable":
                prefsText += "- Vary emotional expression based on context.\n";
                break;
              case "contextual":
                prefsText +=
                  "- Adapt emotional expression to match the situation.\n";
                break;
            }
          }

          if (impostor.responsePattern) {
            switch (impostor.responsePattern) {
              case "direct":
                prefsText += "- Respond directly and straightforwardly.\n";
                break;
              case "indirect":
                prefsText += "- Use indirect, circumstantial responses.\n";
                break;
              case "mixed":
                prefsText += "- Mix direct and indirect response patterns.\n";
                break;
              case "situational":
                prefsText +=
                  "- Adapt response pattern based on the situation.\n";
                break;
            }
          }

          if (impostor.informationSharing) {
            switch (impostor.informationSharing) {
              case "cautious":
                prefsText +=
                  "- Be cautious and selective about sharing personal information.\n";
                break;
              case "open":
                prefsText +=
                  "- Be open and willing to share personal experiences.\n";
                break;
              case "selective":
                prefsText +=
                  "- Share information selectively based on relevance.\n";
                break;
              case "progressive":
                prefsText +=
                  "- Gradually share more information as trust builds.\n";
                break;
            }
          }

          if (impostor.specificityEnforcement !== undefined) {
            if (impostor.specificityEnforcement <= 25) {
              prefsText += "- General responses are acceptable.\n";
            } else if (impostor.specificityEnforcement <= 50) {
              prefsText += "- Include some specific details and examples.\n";
            } else if (impostor.specificityEnforcement <= 75) {
              prefsText +=
                "- Include specific details and concrete examples.\n";
            } else {
              prefsText +=
                "- Must include highly specific details, examples, and sensory information.\n";
            }
          }

          if (impostor.exampleFrequency) {
            switch (impostor.exampleFrequency) {
              case "rare":
                prefsText += "- Provide examples rarely.\n";
                break;
              case "occasional":
                prefsText += "- Provide examples occasionally.\n";
                break;
              case "frequent":
                prefsText += "- Provide examples frequently.\n";
                break;
              case "consistent":
                prefsText += "- Provide examples consistently in responses.\n";
                break;
            }
          }

          if (impostor.sensoryDetailLevel !== undefined) {
            if (impostor.sensoryDetailLevel <= 25) {
              prefsText += "- Use minimal sensory details.\n";
            } else if (impostor.sensoryDetailLevel <= 50) {
              prefsText += "- Use moderate sensory details.\n";
            } else if (impostor.sensoryDetailLevel <= 75) {
              prefsText += "- Use rich sensory details.\n";
            } else {
              prefsText += "- Use extensive, vivid sensory details.\n";
            }
          }

          if (impostor.timelineReferences) {
            switch (impostor.timelineReferences) {
              case "vague":
                prefsText += "- Use vague timeline references.\n";
                break;
              case "specific":
                prefsText += "- Use specific timeline references.\n";
                break;
              case "mixed":
                prefsText += "- Mix vague and specific timeline references.\n";
                break;
              case "flexible":
                prefsText += "- Adapt timeline references based on context.\n";
                break;
            }
          }
        }

        // Add TTS instructions if enabled
        if (prefs.enableTTS) {
          prefsText += getAudioInstruction(prefs.therapistModel);
        }

        systemInstructionText += prefsText;
      }

      // Enhanced response structure with conversation ending detection and eleven_v3 audio tags
      systemInstructionText += `\n**CONVERSATIONAL RESPONSE REQUIREMENTS:**\nYour response should feel like talking to a real counselor - natural, varied, and genuinely human.\n${
        conversationPreferences?.enableTTS
          ? "- Keep responses very brief (1-2 sentences maximum) for optimal audio generation."
          : "- Keep responses brief and to the point (1-3 sentences maximum for impersonate mode)."
      }\n- **START NATURALLY:** Jump straight into conversation without greetings after the first response.\n- **BE UNPREDICTABLE:** Mix response types randomly - empathize, question, suggest, reflect, challenge gently.\n- **FRESH PERSPECTIVES:** Don't mirror user language - offer new angles and insights.\n- **CONVERSATIONAL TONE:** Use everyday language, contractions, and natural flow like you're chatting with a friend over coffee.\n- **NO REPETITION:** Never repeat similar phrases or structures.\n- **HUMAN PERSONALITY:** Show warmth, curiosity, and genuine engagement.\n- **VARY EVERYTHING:** Sentence length, structure, approach, focus - keep it fresh and authentic.\n- **NATURAL ENDINGS:** End at natural stopping points, let the conversation breathe.\n- **NO FORMULAS:** Avoid any predictable patterns or therapeutic jargon.\n- **NO DISCLAIMERS:** Do not insert AI disclaimers or boundary statements during the conversation unless addressing a genuine crisis.\n- If the conversation shows signs of natural resolution, conclude helpfully rather than prolonging.\n- Do not provide a JSON output; just the conversational text.${
        conversationPreferences?.enableTTS
          ? "\n\n" +
            getAudioInstruction(conversationPreferences?.therapistModel)
          : ""
      }\n`;

      // Adaptive token limits based on response metrics
      let maxTokens = 800; // Default for impersonate mode
      if (responseMetrics.averageLength > 300) {
        maxTokens = 400; // Reduce if responses are getting long
      } else if (
        responseMetrics.averageLength < 150 &&
        responseMetrics.totalResponses > 3
      ) {
        maxTokens = 600; // Allow slightly more if consistently brief
      }

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
          maxOutputTokens: maxTokens,
        },
      });

      return streamSSE(c, async (stream) => {
        let aiResponseText = "";
        let responseLength = 0;
        const maxResponseLength = 600; // Character limit for early truncation

        try {
          const result = await chatSession.sendMessageStream(message);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            responseLength += chunkText.length;

            // Early truncation if response is getting too long
            if (responseLength > maxResponseLength) {
              break;
            }

            aiResponseText += chunkText;
            await stream.writeSSE({ data: chunkText });
          }

          // Save AI response
          if (message) {
            try {
              const allowedSenders = [
                "user",
                "ai",
                "therapist",
                "impostor",
              ] as const;
              type SenderType = (typeof allowedSenders)[number];
              let aiSender: SenderType = (sender as SenderType) || "ai";
              await db.insert(messages).values({
                threadId: threadId, // Use threadId for impersonate threads
                threadType: "impersonate",
                sender: aiSender,
                text: aiResponseText,
                timestamp: new Date(),
              });

              // Update the thread's updatedAt timestamp to reflect recent activity
              await db
                .update(impersonateThread)
                .set({ updatedAt: new Date() })
                .where(eq(impersonateThread.id, threadId));

              await saveConversationToFile(
                threadId, // Use threadId for file naming
                message,
                aiResponseText,
                model.systemInstruction?.parts[0].text || "",
                conversationHistory
              );
            } catch (error) {}
          }
        } catch (error) {
          await stream.writeSSE({
            data: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      });
    }
  )
  .post(
    "/impersonate/test",
    zValidator("json", impersonateChatRequestSchema),
    async (c) => {
      const rawBody = await c.req.json();
      const parsed = impersonateChatRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        logger.error("Zod validation error:", parsed.error.errors);
        return c.json({ error: JSON.stringify(parsed.error.errors) }, 400);
      }

      const { context, message } = parsed.data;

      return c.json({
        message: "Test successful",
        contextLength: context?.length || 0,
        context: context,
        receivedMessage: message,
      });
    }
  )
  .get(
    "/:sessionId",
    zValidator("param", z.object({ sessionId: z.string().transform(Number) })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const existingMessages = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.sessionId, sessionId),
              eq(messages.threadType, "main")
            )
          )
          .orderBy(messages.timestamp);

        return c.json(
          existingMessages.map((msg) => ({
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
          }))
        );
      } catch (error) {
        return c.json({ error: "Failed to fetch chat session messages." }, 500);
      }
    }
  )
  .get(
    "/impersonate/:threadId",
    zValidator("param", z.object({ threadId: z.string().transform(Number) })),
    async (c) => {
      const { threadId } = c.req.valid("param");

      try {
        const existingMessages = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.threadId, threadId), // Use threadId for impersonate threads
              eq(messages.threadType, "impersonate")
            )
          )
          .orderBy(messages.timestamp);

        return c.json(
          existingMessages.map((msg) => ({
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp.getTime(),
          }))
        );
      } catch (error) {
        return c.json(
          { error: "Failed to fetch impersonate thread messages." },
          500
        );
      }
    }
  )
  .get(
    "/crisis/:sessionId",
    zValidator("param", z.object({ sessionId: z.string().transform(Number) })),
    async (c) => {
      const { sessionId } = c.req.valid("param");

      try {
        const session = await db
          .select({ crisisDetected: sessions.crisisDetected })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .limit(1);

        if (session.length === 0) {
          return c.json({ error: "Session not found" }, 404);
        }

        return c.json({ crisisDetected: session[0].crisisDetected });
      } catch (error) {
        return c.json({ error: "Failed to check crisis status" }, 500);
      }
    }
  );

export default chat;
export type ChatType = typeof chat;
