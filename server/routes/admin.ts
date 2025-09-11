import { Hono } from "hono";
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { streamSSE } from "hono/streaming";
import { db } from "../db/config";
import { sessions, threads, messages, sessionForms } from "../db/schema";
import { adminMiddleware } from "../middleware/admin";
import { count, eq, sql } from "drizzle-orm";
import { geminiConfig } from "../lib/config";
import { logger } from "../lib/logger";

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Using same streaming approach as working chat - no chunk processing needed

// Privacy-safe context anonymization for analysis
function createPrivacySafeAnalysisContext(
  threadData: any,
  sessions: any[],
  messages: any[],
  forms: any[]
) {
  const userMessages = messages.filter(m => m.sender === 'user');
  const aiMessages = messages.filter(m => m.sender === 'ai');
  const completedSessions = sessions.filter(s => s.status === 'finished');
  
  return {
    threadMetrics: {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      completionRate: sessions.length > 0 ? (completedSessions.length / sessions.length * 100) : 0,
      totalMessages: messages.length,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      formsCompleted: forms.length,
    },
    sessionPattern: sessions.map((s, i) => ({
      sessionNumber: i + 1,
      status: s.status,
      messageCount: messages.filter(m => m.sessionId === s.id).length,
      userMessageCount: messages.filter(m => m.sessionId === s.id && m.sender === 'user').length,
      aiMessageCount: messages.filter(m => m.sessionId === s.id && m.sender === 'ai').length,
    })),
    communicationMetrics: {
      avgUserMessageLength: userMessages.length > 0 ? 
        Math.round(userMessages.reduce((sum, m) => sum + m.text.length, 0) / userMessages.length) : 0,
      avgAiMessageLength: aiMessages.length > 0 ? 
        Math.round(aiMessages.reduce((sum, m) => sum + m.text.length, 0) / aiMessages.length) : 0,
      responseRatio: userMessages.length > 0 ? (aiMessages.length / userMessages.length).toFixed(2) : '0',
    },
    therapyProgressIndicators: {
      sessionProgression: sessions.map((s, i) => ({
        session: i + 1,
        messageVolume: messages.filter(m => m.sessionId === s.id).length,
        completionStatus: s.status,
      })),
      assessmentEngagement: forms.length,
      longitudinalEngagement: sessions.length > 1 ? 'Multi-session' : 'Single-session',
    }
  };
}

const adminRoute = new Hono()
  .use("/*", adminMiddleware) // Protect all admin routes
  .get("/threads/:threadId/analyze", async (c) => {
    try {
      const threadId = parseInt(c.req.param("threadId"));
      logger.log("Analyzing thread:", threadId);

      // Get comprehensive thread data with all related information
      const thread = await db
        .select()
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1);

      if (thread.length === 0) {
        return c.json({ error: "Thread not found" }, 404);
      }

      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, threadId))
        .orderBy(sessions.sessionNumber);

      // Get all messages with full context for analysis
      const threadMessages = await db
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

      // Get session forms with full data
      const threadGeneratedForms = await db
        .select({
          id: sessionForms.id,
          sessionId: sessionForms.sessionId,
          answers: sessionForms.answers,
          createdAt: sessionForms.createdAt,
        })
        .from(sessionForms)
        .innerJoin(sessions, eq(sessionForms.sessionId, sessions.id))
        .where(eq(sessions.threadId, threadId))
        .orderBy(sessionForms.createdAt);

      // Extract initial form data from thread with safe JSON parsing
      const initialForm = {
        sessionName: thread[0].sessionName,
        preferredName: thread[0].preferredName,
        currentEmotions: thread[0].currentEmotions || null,
        reasonForVisit: thread[0].reasonForVisit,
        supportType: thread[0].supportType || null,
        additionalContext: thread[0].additionalContext,
      };

      const initialFormExists = !!(
        initialForm.sessionName || 
        initialForm.preferredName || 
        initialForm.currentEmotions ||
        initialForm.reasonForVisit ||
        initialForm.supportType ||
        initialForm.additionalContext
      );

      const totalForms = (initialFormExists ? 1 : 0) + threadGeneratedForms.length;

      // Prepare comprehensive context for analysis
      const analysisContext = {
        threadId: threadId,
        sessionCount: threadSessions.length,
        messageCount: threadMessages.length,
        formCount: totalForms,
        initialForm: initialFormExists ? initialForm : null,
        sessions: threadSessions.map(session => ({
          id: session.id,
          sessionNumber: session.sessionNumber,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messagesInSession: threadMessages.filter(m => m.sessionId === session.id).length,
        })),
        messages: threadMessages.map(msg => ({
          id: msg.id,
          sender: msg.sender,
          text: msg.text,
          timestamp: msg.timestamp,
          sessionId: msg.sessionId,
        })),
        forms: threadGeneratedForms.map(form => ({
          id: form.id,
          sessionId: form.sessionId,
          formData: form.formData || null,
          generatedQuestions: form.generatedQuestions || null,
          createdAt: form.createdAt,
        })),
      };

      // Enhanced analysis with full context
      const userMessages = threadMessages.filter(m => m.sender === 'user');
      const aiMessages = threadMessages.filter(m => m.sender === 'ai');
      
      // Calculate engagement metrics
      const avgUserMessageLength = userMessages.length > 0 
        ? userMessages.reduce((sum, msg) => sum + msg.text.length, 0) / userMessages.length 
        : 0;
      
      const avgAiMessageLength = aiMessages.length > 0 
        ? aiMessages.reduce((sum, msg) => sum + msg.text.length, 0) / aiMessages.length 
        : 0;

      // Session completion analysis
      const completedSessions = threadSessions.filter(s => s.status === 'finished').length;
      const sessionCompletionRate = threadSessions.length > 0 
        ? (completedSessions / threadSessions.length) * 100 
        : 0;

      // Form completion analysis per session
      const formsPerSession = threadSessions.length > 0 
        ? totalForms / threadSessions.length 
        : 0;

      const analysis = {
        threadId: threadId,
        displayName: `Thread ${Math.floor(Math.random() * 100) + 1}`,
        sessionCount: threadSessions.length,
        messageCount: threadMessages.length,
        formCount: totalForms,
        isAnalyzed: true,
        context: analysisContext, // Full context for AI analysis
        metrics: {
          userMessages: userMessages.length,
          aiMessages: aiMessages.length,
          avgUserMessageLength: Math.round(avgUserMessageLength),
          avgAiMessageLength: Math.round(avgAiMessageLength),
          sessionCompletionRate: Math.round(sessionCompletionRate),
          formsPerSession: Math.round(formsPerSession * 100) / 100,
          completedSessions: completedSessions,
        },
        summary: `Comprehensive analysis completed for a ${threadSessions.length}-session therapeutic conversation. User engagement: ${userMessages.length} messages (avg ${Math.round(avgUserMessageLength)} chars), AI responses: ${aiMessages.length} messages (avg ${Math.round(avgAiMessageLength)} chars). Session completion rate: ${Math.round(sessionCompletionRate)}% (${completedSessions}/${threadSessions.length}). Form engagement: ${totalForms} forms across ${threadSessions.length} sessions (${Math.round(formsPerSession * 100) / 100} forms/session). ${initialFormExists ? 'Initial assessment completed. ' : 'No initial assessment. '}${threadGeneratedForms.length} dynamic forms generated. Conversation demonstrates ${threadMessages.length > threadSessions.length * 8 ? 'high' : threadMessages.length > threadSessions.length * 4 ? 'moderate' : 'low'} therapeutic engagement with ${sessionCompletionRate > 70 ? 'excellent' : sessionCompletionRate > 50 ? 'good' : 'developing'} session progression patterns.`
      };

      return c.json(analysis);
    } catch (error) {
      logger.error("Error analyzing thread:", error);
      logger.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      logger.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
      return c.json({ 
        error: "Failed to analyze thread", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 500);
    }
  })
  .post("/threads/:threadId/chat", async (c) => {
    try {
      const threadId = parseInt(c.req.param("threadId"));
      const { message, conversationHistory } = await c.req.json();
      
      logger.log("Analysis chat for thread:", threadId, "Message:", message);

      // Get comprehensive thread context for intelligent analysis
      const thread = await db
        .select()
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1);

      if (thread.length === 0) {
        return c.json({ error: "Thread not found" }, 404);
      }

      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, threadId))
        .orderBy(sessions.sessionNumber);

      // Get complete messages for analysis
      const threadMessages = await db
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

      const threadGeneratedForms = await db
        .select({
          id: sessionForms.id,
          sessionId: sessionForms.sessionId,
          answers: sessionForms.answers,
          createdAt: sessionForms.createdAt,
        })
        .from(sessionForms)
        .innerJoin(sessions, eq(sessionForms.sessionId, sessions.id))
        .where(eq(sessions.threadId, threadId))
        .orderBy(sessionForms.createdAt);

      // Extract initial form data with safe JSON parsing
      const initialForm = {
        sessionName: thread[0].sessionName,
        preferredName: thread[0].preferredName,
        currentEmotions: thread[0].currentEmotions || null,
        reasonForVisit: thread[0].reasonForVisit,
        supportType: thread[0].supportType || null,
        additionalContext: thread[0].additionalContext,
      };

      const initialFormExists = !!(
        initialForm.sessionName || 
        initialForm.preferredName || 
        initialForm.currentEmotions ||
        initialForm.reasonForVisit ||
        initialForm.supportType ||
        initialForm.additionalContext
      );

      const totalForms = (initialFormExists ? 1 : 0) + threadGeneratedForms.length;

      // Calculate detailed metrics
      const userMessages = threadMessages.filter(m => m.sender === 'user');
      const aiMessages = threadMessages.filter(m => m.sender === 'ai');
      const completedSessions = threadSessions.filter(s => s.status === 'finished').length;
      const sessionCompletionRate = threadSessions.length > 0 ? (completedSessions / threadSessions.length) * 100 : 0;
      
      const avgUserMessageLength = userMessages.length > 0 
        ? userMessages.reduce((sum, msg) => sum + msg.text.length, 0) / userMessages.length 
        : 0;
      
      const avgAiMessageLength = aiMessages.length > 0 
        ? aiMessages.reduce((sum, msg) => sum + msg.text.length, 0) / aiMessages.length 
        : 0;

      // Session-by-session analysis
      const sessionAnalysis = threadSessions.map((session, i) => {
        const sessionMessages = threadMessages.filter(m => m.sessionId === session.id);
        const sessionUserMessages = sessionMessages.filter(m => m.sender === 'user');
        const sessionAiMessages = sessionMessages.filter(m => m.sender === 'ai');
        const sessionGeneratedForms = threadGeneratedForms.filter(f => f.sessionId === session.id);
        
        return {
          sessionNumber: i + 1,
          status: session.status,
          messageCount: sessionMessages.length,
          userMessageCount: sessionUserMessages.length,
          aiMessageCount: sessionAiMessages.length,
          formsGenerated: sessionGeneratedForms.length,
          avgUserMsgLength: sessionUserMessages.length > 0 
            ? sessionUserMessages.reduce((sum, msg) => sum + msg.text.length, 0) / sessionUserMessages.length 
            : 0,
          avgAiMsgLength: sessionAiMessages.length > 0 
            ? sessionAiMessages.reduce((sum, msg) => sum + msg.text.length, 0) / sessionAiMessages.length 
            : 0,
        };
      });

      // Create privacy-safe analysis context
      const analysisContext = createPrivacySafeAnalysisContext(
        thread[0],
        threadSessions,
        threadMessages,
        threadGeneratedForms
      );

      // Build analysis context for AI
      const analysisHistory: Content[] = [{
        role: "user",
        parts: [{
          text: `Thread Analysis Context (Privacy-Protected):

**Therapeutic Session Overview:**
- Total Sessions: ${analysisContext.threadMetrics.totalSessions} (${analysisContext.threadMetrics.completedSessions} completed, ${analysisContext.threadMetrics.completionRate.toFixed(1)}% completion rate)
- Message Distribution: ${analysisContext.threadMetrics.totalMessages} total messages (${analysisContext.threadMetrics.userMessages} user, ${analysisContext.threadMetrics.aiMessages} AI)
- Assessment Engagement: ${analysisContext.threadMetrics.formsCompleted} therapeutic assessments completed
- Communication Patterns: User avg ${analysisContext.communicationMetrics.avgUserMessageLength} chars/message, AI avg ${analysisContext.communicationMetrics.avgAiMessageLength} chars/message
- Response Ratio: ${analysisContext.communicationMetrics.responseRatio}:1 (AI:User)

**Session Progression Pattern:**
${analysisContext.sessionPattern.map(s => `Session ${s.sessionNumber}: ${s.messageCount} messages (${s.userMessageCount} user, ${s.aiMessageCount} AI), status: ${s.status}`).join('\n')}

**Therapeutic Progress Indicators:**
- Engagement Type: ${analysisContext.therapyProgressIndicators.longitudinalEngagement}
- Assessment Participation: ${analysisContext.therapyProgressIndicators.assessmentEngagement} forms completed
- Session Volume Trend: ${analysisContext.therapyProgressIndicators.sessionProgression.map(s => `S${s.session}(${s.messageVolume}msg)`).join(' → ')}

Previous conversation context: ${(conversationHistory || []).slice(-5).map((msg: any) => `Analyst: [Previous analysis context]`).join('\n')}

CRITICAL: This is a privacy-protected analysis context. Do not reference specific user content or personal information. Focus only on therapeutic patterns and quality metrics.`
        }]
      }];

      // Enhanced system instructions for analysis AI
      const systemInstructionText = `You are an AI therapeutic conversation quality analyst providing professional insights for quality assessment and improvement.

**CRITICAL PRIVACY REQUIREMENTS:**
- DO NOT leak, mention, or reference any specific user information, names, personal details, or identifiable content
- DO NOT quote or reproduce exact user messages or AI responses
- Focus ONLY on patterns, metrics, and therapeutic quality indicators
- Use generic references like "the user," "the conversation," or "the therapeutic interaction"
- Provide analysis sufficient for quality assessment without compromising privacy

**Your Expertise Areas:**
- Therapeutic Effectiveness: AI response quality, intervention appropriateness, therapeutic goal achievement
- User Engagement: Participation patterns, session commitment, communication depth
- Conversation Flow: Therapeutic continuity, session progression, intervention timing
- Session Quality: Individual session assessment, comparative analysis, improvement opportunities
- Assessment Integration: Form utilization patterns, progress tracking effectiveness

**CRITICAL FORMATTING REQUIREMENTS:**
- ALWAYS start each major section on a new line
- ALWAYS put a blank line between different sections
- ALWAYS put each bullet point on its own line
- ALWAYS put each numbered item on its own line
- Use **bold text** (not heavy/medium weight) for key findings only
- Keep text regular weight except for emphasis
- End each paragraph with a line break before starting the next

**Response Structure - FOLLOW EXACTLY:**

## Analysis Summary
[Main findings here]

**Key Metrics:**
• Metric 1
• Metric 2
• Metric 3

**Recommendations:**
1. First recommendation
2. Second recommendation
3. Third recommendation

**IMPORTANT:** Put actual line breaks (newlines) between each section, bullet point, and paragraph. Do not write everything in one continuous block.

**Analysis Context Available:**
You have access to comprehensive thread metrics, session patterns, communication analytics, and therapeutic progress indicators for professional quality assessment.`;

      // Initialize Gemini model for streaming analysis
      const model = gemini.getGenerativeModel({
        model: geminiConfig.twoPoint5FlashLite,
        systemInstruction: {
          role: "model",
          parts: [{ text: systemInstructionText }],
        },
      });

      const chatSession = model.startChat({
        history: analysisHistory,
        generationConfig: {
          maxOutputTokens: 2000,
        },
      });

      // Stream the AI analysis response using the same pattern as working chat
      return streamSSE(c, async (stream) => {
        let aiResponseText = "";
        
        try {
          const result = await chatSession.sendMessageStream(message);
          
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            aiResponseText += chunkText;
            
            // Send chunk directly without modification (same as working chat)
            await stream.writeSSE({ data: chunkText });
          }
          
        } catch (error) {
          logger.error("Error during AI streaming:", error);
          await stream.writeSSE({
            data: `Error: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      });
    } catch (error) {
      logger.error("Error in analysis chat:", error);
      return c.json({ error: "Failed to process analysis request" }, 500);
    }
  })
  .get("/threads/anonymized", async (c) => {
    try {
      logger.log("Fetching anonymized threads...");

      // Get pagination parameters
      const page = parseInt(c.req.query("page") || "1");
      const limit = parseInt(c.req.query("limit") || "20");
      const offset = (page - 1) * limit;

      logger.log("Pagination:", { page, limit, offset });

      // Get total count for pagination
      const totalCountResult = await db
        .select({
          total: count(threads.id),
        })
        .from(threads);

      const totalThreads = totalCountResult[0]?.total || 0;
      const totalPages = Math.ceil(totalThreads / limit);

      // Get threads with session count, ordered by creation date (newest first)
      const threadsWithSessions = await db
        .select({
          id: threads.id,
          createdAt: threads.createdAt,
          sessionCount: sql<number>`COUNT(${sessions.id})`,
        })
        .from(threads)
        .leftJoin(sessions, eq(sessions.threadId, threads.id))
        .groupBy(threads.id, threads.createdAt)
        .orderBy(sql`${threads.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      // Create anonymized thread names
      const anonymizedThreads = threadsWithSessions.map((thread, index) => ({
        id: thread.id,
        displayName: `Thread ${offset + index + 1}`,
        sessionCount: thread.sessionCount || 0,
        createdAt: thread.createdAt,
      }));

      logger.log("Anonymized threads:", anonymizedThreads.length, "of", totalThreads);

      return c.json({
        threads: anonymizedThreads,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalThreads: totalThreads,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit: limit,
        }
      });
    } catch (error) {
      logger.error("Error fetching anonymized threads:", error);
      return c.json({ error: "Failed to fetch threads" }, 500);
    }
  })
  .get("/metrics", async (c) => {
    try {
      logger.log("Fetching admin metrics...");

      // Get threads with sessions metrics
      const threadMetrics = await db
        .select({
          totalThreads: count(threads.id),
          threadsWithSessions: count(
            sql`CASE WHEN EXISTS (
              SELECT 1 FROM ${sessions} 
              WHERE ${sessions.threadId} = ${threads.id}
            ) THEN 1 END`
          ),
        })
        .from(threads);

      logger.log("Thread metrics:", threadMetrics);

      // Get session metrics
      const sessionMetrics = await db
        .select({
          totalSessions: count(sessions.id),
          completedSessions: count(
            sql`CASE WHEN ${sessions.status} = 'finished' THEN 1 END`
          ),
        })
        .from(sessions);

      logger.log("Session metrics:", sessionMetrics);

      // Get message metrics
      const messageMetrics = await db
        .select({
          totalMessages: count(messages.id),
        })
        .from(messages)
        .where(eq(messages.threadType, "main"));

      // Count unique sessions with messages
      const uniqueSessionsWithMessages = await db
        .select({
          uniqueSessions: sql<number>`COUNT(DISTINCT ${messages.sessionId})`,
        })
        .from(messages)
        .where(eq(messages.threadType, "main"));

      const avgMessagesPerSession = uniqueSessionsWithMessages[0].uniqueSessions > 0
        ? messageMetrics[0].totalMessages / uniqueSessionsWithMessages[0].uniqueSessions
        : 0;

      logger.log("Message metrics:", messageMetrics);

      // Get form completion metrics
      const formMetrics = await db
        .select({
          totalForms: count(sessionForms.id),
          totalCompletableSessions: count(
            sql`CASE WHEN ${sessions.status} = 'finished' THEN 1 END`
          ),
        })
        .from(sessions)
        .leftJoin(sessionForms, eq(sessions.id, sessionForms.sessionId));

      logger.log("Form metrics:", formMetrics);

      return c.json({
        threadMetrics: {
          total: threadMetrics[0].totalThreads,
          withSessions: threadMetrics[0].threadsWithSessions,
          percentageWithSessions: 
            (threadMetrics[0].threadsWithSessions / threadMetrics[0].totalThreads) * 100 || 0,
        },
        sessionMetrics: {
          total: sessionMetrics[0].totalSessions,
          completed: sessionMetrics[0].completedSessions,
          completionRate: 
            (sessionMetrics[0].completedSessions / sessionMetrics[0].totalSessions) * 100 || 0,
        },
        messageMetrics: {
          total: messageMetrics[0].totalMessages,
          averagePerSession: Number(avgMessagesPerSession.toFixed(2)) || 0,
        },
        formMetrics: {
          total: formMetrics[0].totalForms,
          completionRate: 
            (formMetrics[0].totalForms / formMetrics[0].totalCompletableSessions) * 100 || 0,
        },
      });
    } catch (error) {
      logger.error("Error fetching admin metrics:", error);
      return c.json({ error: "Failed to fetch metrics" }, 500);
    }
  });

export default adminRoute;