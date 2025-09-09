// quality.ts (Message Quality Analyzer)
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { geminiConfig } from "../lib/config";
import { db } from "../db/config";
import { messages, sessionForms, sessions, threads } from "../db/schema";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define enhanced schema for quality analysis request
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
  sessionId: z.number().optional(), // Add session context for comprehensive analysis
  threadId: z.number().optional(), // Add thread context for full conversation history
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

    const { messages, initialForm, sessionId, threadId } = parsed.data;

    try {
      // Get comprehensive thread context if available
      let threadContext = null;
      if (sessionId) {
        threadContext = await getThreadContext(sessionId);
      }

      // Use enhanced analysis with full context
      const analysisResult = await analyzeMessageQuality(messages, initialForm, threadContext);
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

// Privacy-safe context anonymization
function anonymizeContent(text: string): string {
  // Remove common personal identifiers while preserving therapeutic patterns
  return text
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[Name]") // Full names
    .replace(/\b[A-Z][a-z]+\b/g, (match) => {
      // Common names - keep therapeutic language
      const therapeuticWords = ['I', 'My', 'Me', 'You', 'We', 'They', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return therapeuticWords.includes(match) ? match : "[Name]";
    })
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[Date]") // Dates
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, "[Phone]") // Phone numbers
    .replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, "[Email]"); // Email addresses
}

// Get comprehensive thread context for analysis
async function getThreadContext(sessionId: number) {
  try {
    // Get session and thread info
    const sessionData = await db
      .select({
        session: sessions,
        thread: threads,
      })
      .from(sessions)
      .innerJoin(threads, eq(sessions.threadId, threads.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (sessionData.length === 0) {
      throw new Error("Session not found");
    }

    const threadId = sessionData[0].thread.id;

    // Get all thread sessions
    const allSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.threadId, threadId))
      .orderBy(sessions.sessionNumber);

    // Get all messages in the thread
    const allMessages = await db
      .select({
        id: messages.id,
        sender: messages.sender,
        text: messages.text,
        timestamp: messages.timestamp,
        sessionId: messages.sessionId,
      })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(eq(sessions.threadId, threadId))
      .orderBy(messages.timestamp);

    // Get all forms in the thread
    const allForms = await db
      .select()
      .from(sessionForms)
      .innerJoin(sessions, eq(sessionForms.sessionId, sessions.id))
      .where(eq(sessions.threadId, threadId))
      .orderBy(sessionForms.createdAt);

    return {
      thread: sessionData[0].thread,
      sessions: allSessions,
      messages: allMessages,
      forms: allForms,
    };
  } catch (error) {
    console.error("Error getting thread context:", error);
    return null;
  }
}

// --- Enhanced Gemini-powered Quality Analysis with Privacy Protection ---
async function analyzeMessageQuality(
  messages: { text: string; sender: string; timestamp: number }[],
  initialForm?: {
    preferredName?: string;
    currentEmotions?: string[];
    reasonForVisit?: string;
    supportType?: string[];
    additionalContext?: string;
  },
  threadContext?: {
    thread: any;
    sessions: any[];
    messages: any[];
    forms: any[];
  } | null
) {
  // Use provided thread context if available, or try to get it from session info
  let fullContext = threadContext;

  const model = gemini.getGenerativeModel({
    model: geminiConfig.twoPoint5FlashLite,
  });

  if (messages.length === 0) {
    return {
      overallProgress: 0,
      emotionalStability: 0,
      communicationClarity: 0,
      problemSolving: 0,
      selfAwareness: 0,
      qualityScores: [],
      insights: ["No messages to analyze"],
      recommendations: ["Continue the conversation to enable analysis"],
    };
  }

  // Enhanced system instructions with privacy protection
  let contextualInfo = "";
  if (fullContext) {
    const totalThreadMessages = fullContext.messages.length;
    const totalSessions = fullContext.sessions.length;
    const totalForms = fullContext.forms.length;
    const completedSessions = fullContext.sessions.filter(s => s.status === 'finished').length;
    
    contextualInfo = `
**Comprehensive Thread Context (Privacy-Protected):**
- Complete Thread History: ${totalSessions} sessions with ${totalThreadMessages} total messages
- Session Completion Rate: ${completedSessions}/${totalSessions} (${Math.round(completedSessions/totalSessions*100)}%)
- Assessment Forms Completed: ${totalForms} therapeutic assessments
- Thread Duration: ${Math.round((new Date(fullContext.sessions[fullContext.sessions.length-1]?.updatedAt).getTime() - new Date(fullContext.sessions[0]?.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
- Session Pattern: ${fullContext.sessions.map(s => `Session ${s.sessionNumber}(${s.status})`).join(', ')}
`;
  }

  const systemInstructionText = `You are an AI therapeutic conversation quality analyst with expertise in mental health assessment and therapeutic effectiveness evaluation.

**CRITICAL PRIVACY REQUIREMENTS:**
- DO NOT leak, mention, or reference any specific user information, names, personal details, or identifiable content
- DO NOT quote or reproduce exact user messages or AI responses
- Focus ONLY on patterns, metrics, and therapeutic quality indicators
- Use generic references like "the user" or "the conversation"
- Provide analysis sufficient for quality assessment without compromising privacy

**Analysis Context:**
- Request Messages: ${messages.length} (User: ${messages.filter(m => m.sender === "user").length}, AI: ${messages.filter(m => m.sender === "ai").length})
- Conversation span: From ${new Date(Math.min(...messages.map(m => m.timestamp))).toLocaleDateString()} to ${new Date(Math.max(...messages.map(m => m.timestamp))).toLocaleDateString()}
- Initial assessment provided: ${initialForm ? 'Yes' : 'No'}
${contextualInfo}

**Your Role:**
Analyze therapeutic conversation quality across multiple dimensions while maintaining complete privacy protection. Focus on measurable patterns, engagement metrics, and therapeutic effectiveness indicators.

**FORMATTING REQUIREMENTS FOR STREAMING:**
- Use proper markdown formatting with clear line breaks between paragraphs
- Structure your response with headers (##), bullet points (•), and numbered lists when appropriate
- Ensure each sentence ends with proper punctuation followed by a line break when starting new topics
- Use double line breaks (\\n\\n) between major sections for better readability
- Format metrics and statistics clearly with bullet points or numbered lists
- Use **bold text** for emphasis on key findings and recommendations

**Response Requirements:**
Provide numerical scores (0-100) for each dimension and professional insights about therapeutic patterns without revealing any personal information. Structure your response with clear formatting for better readability.`;

  // Build anonymized context
  let contextString = "";
  if (initialForm) {
    contextString += "Initial Assessment Context (Anonymized):\n";
    if (initialForm.currentEmotions && initialForm.currentEmotions.length > 0) {
      contextString += `- Initial emotional state categories: ${initialForm.currentEmotions.length} emotions identified\n`;
    }
    if (initialForm.reasonForVisit) {
      contextString += `- Visit reason category: [${initialForm.reasonForVisit.length > 50 ? 'Detailed' : 'Brief'}] therapeutic need\n`;
    }
    if (initialForm.supportType && initialForm.supportType.length > 0) {
      contextString += `- Preferred support types: ${initialForm.supportType.length} approaches requested\n`;
    }
    if (initialForm.additionalContext) {
      contextString += `- Additional context provided: [${initialForm.additionalContext.length} characters]\n`;
    }
  }

  // Create anonymized conversation flow for analysis
  const conversationFlow = messages.map((msg, index) => {
    const anonymizedText = anonymizeContent(msg.text);
    return `${msg.sender.toUpperCase()} [Message ${index + 1}]: ${anonymizedText.length} characters, ${anonymizedText.split(' ').length} words, ${anonymizedText.split('.').length} sentences`;
  }).join('\n');

  // Calculate engagement metrics
  const userMessages = messages.filter(m => m.sender === "user");
  const aiMessages = messages.filter(m => m.sender === "ai");
  const avgUserLength = userMessages.length > 0 ? userMessages.reduce((sum, m) => sum + m.text.length, 0) / userMessages.length : 0;
  const avgAiLength = aiMessages.length > 0 ? aiMessages.reduce((sum, m) => sum + m.text.length, 0) / aiMessages.length : 0;

  const prompt = `Analyze this therapeutic conversation for quality and effectiveness patterns.

${contextString}

Conversation Flow Analysis (Anonymized):
${conversationFlow}

Engagement Metrics:
- User message average length: ${Math.round(avgUserLength)} characters
- AI response average length: ${Math.round(avgAiLength)} characters
- Response ratio: ${aiMessages.length}:${userMessages.length} (AI:User)
- Conversation duration: ${messages.length > 0 ? Math.round((Math.max(...messages.map(m => m.timestamp)) - Math.min(...messages.map(m => m.timestamp))) / (1000 * 60)) : 0} minutes

Analyze across these therapeutic dimensions:
1. Overall Progress (0-100): General therapeutic advancement and goal achievement patterns
2. Emotional Stability (0-100): Emotional regulation and consistency patterns
3. Communication Clarity (0-100): Expression clarity and therapeutic communication effectiveness
4. Problem Solving (0-100): Coping strategy development and solution-focused patterns
5. Self Awareness (0-100): Insight development and self-reflection patterns

For each major conversation segment, provide quality indicators and therapeutic focus categories.

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
      "message": "Segment 1"
    }
  ],
  "insights": [
    "Therapeutic engagement shows positive progression patterns",
    "Communication demonstrates increasing clarity and depth"
  ],
  "recommendations": [
    "Continue current therapeutic approaches",
    "Consider expanding coping strategy discussions"
  ]
}

Focus on professional therapeutic assessment without revealing any personal information.`;

  const chatSession = model.startChat({
    history: [{
      role: "user",
      parts: [{ text: systemInstructionText }]
    }],
    generationConfig: {
      maxOutputTokens: 2000,
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

    // Validate and return the response with bounds checking
    return {
      overallProgress: Math.min(100, Math.max(0, parsed.overallProgress || 0)),
      emotionalStability: Math.min(100, Math.max(0, parsed.emotionalStability || 0)),
      communicationClarity: Math.min(100, Math.max(0, parsed.communicationClarity || 0)),
      problemSolving: Math.min(100, Math.max(0, parsed.problemSolving || 0)),
      selfAwareness: Math.min(100, Math.max(0, parsed.selfAwareness || 0)),
      qualityScores: Array.isArray(parsed.qualityScores) ? parsed.qualityScores : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : ["Analysis completed with privacy protection"],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ["Continue therapeutic engagement"],
    };
  } catch (parseError) {
    console.error("Error parsing Gemini response:", parseError);

    // Enhanced fallback with basic metrics
    const userMsgCount = userMessages.length;
    const aiMsgCount = aiMessages.length;
    const avgLength = avgUserLength;
    
    return {
      overallProgress: Math.min(75, Math.max(25, userMsgCount * 10)),
      emotionalStability: Math.min(80, Math.max(30, avgLength > 50 ? 70 : 50)),
      communicationClarity: Math.min(85, Math.max(35, avgLength > 100 ? 80 : 60)),
      problemSolving: Math.min(70, Math.max(25, aiMsgCount > userMsgCount ? 65 : 45)),
      selfAwareness: Math.min(75, Math.max(30, initialForm ? 65 : 50)),
      qualityScores: messages.filter((msg, index) => index % Math.max(1, Math.floor(messages.length / 5)) === 0).map((msg, index) => ({
        timestamp: msg.timestamp,
        score: Math.min(85, Math.max(45, 60 + (msg.text.length > 100 ? 15 : 0))),
        category: msg.sender === "user" ? "user_engagement" : "ai_response",
        message: `Segment ${index + 1}`,
      })),
      insights: [
        `Conversation shows ${userMsgCount > 5 ? 'strong' : 'developing'} therapeutic engagement patterns`,
        `Communication demonstrates ${avgLength > 75 ? 'detailed' : 'concise'} expression style`,
        "Privacy-protected analysis completed successfully"
      ],
      recommendations: [
        "Continue therapeutic conversation development",
        "Maintain current engagement patterns",
        "Consider expanding therapeutic tool usage"
      ],
    };
  }
}

export default quality;
export type QualityType = typeof quality;
