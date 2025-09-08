import { Hono } from "hono";
import { db } from "../db/config";
import { sessions, threads, messages, sessionForms } from "../db/schema";
import { adminMiddleware } from "../middleware/admin";
import { count, eq, sql } from "drizzle-orm";

const adminRoute = new Hono()
  .use("/*", adminMiddleware) // Protect all admin routes
  .get("/threads/:threadId/analyze", async (c) => {
    try {
      const threadId = parseInt(c.req.param("threadId"));
      console.log("Analyzing thread:", threadId);

      // Get thread with all sessions, messages, and forms
      const thread = await db
        .select()
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1);

      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, threadId));

      const threadMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, threadId));

      const threadGeneratedForms = await db
        .select()
        .from(sessionForms)
        .innerJoin(sessions, eq(sessionForms.sessionId, sessions.id))
        .where(eq(sessions.threadId, threadId));

      // Count forms: 1 initial form (from thread) + generated forms (from sessionForms)
      const initialFormExists = thread.length > 0 && (
        thread[0].sessionName || 
        thread[0].preferredName || 
        thread[0].currentEmotions ||
        thread[0].reasonForVisit ||
        thread[0].supportType ||
        thread[0].additionalContext
      );
      const totalForms = (initialFormExists ? 1 : 0) + threadGeneratedForms.length;

      // Create analysis summary without revealing content
      const analysisPrompt = `
        Analyze this therapy conversation thread without revealing any personal content:
        
        Thread Statistics:
        - Sessions: ${threadSessions.length}
        - Messages: ${threadMessages.length}
        - Forms submitted: ${totalForms} (1 initial form + ${threadGeneratedForms.length} generated forms)
        
        Session Flow:
        ${threadSessions.map((session, i) => `Session ${i + 1}: ${session.status} (${session.sessionNumber || 'N/A'})`).join('\n')}
        
        Conversation Pattern Analysis:
        - Message distribution across sessions
        - User engagement indicators (message frequency, length patterns)
        - AI response effectiveness patterns
        - Form completion correlation with session progress
        
        Provide a professional analysis summary focusing on:
        1. Overall conversation flow and structure
        2. User engagement patterns
        3. AI therapeutic effectiveness indicators
        4. Session progression quality
        5. Areas for improvement
        
        Do NOT include any actual conversation content, names, or personal information.
        Focus on patterns, effectiveness metrics, and therapeutic quality indicators.
      `;

      // For now, return mock analysis - you can integrate with AI service later
      const analysis = {
        threadId: threadId,
        displayName: `Thread ${Math.floor(Math.random() * 100) + 1}`,
        sessionCount: threadSessions.length,
        messageCount: threadMessages.length,
        formCount: totalForms,
        isAnalyzed: true,
        summary: `Analysis completed for a ${threadSessions.length}-session therapeutic conversation. The thread shows ${threadMessages.length > 20 ? 'high' : threadMessages.length > 10 ? 'moderate' : 'low'} engagement levels with ${totalForms} form submissions (${initialFormExists ? '1 initial + ' : ''}${threadGeneratedForms.length} generated). Session progression follows ${threadSessions.every(s => s.status) ? 'structured' : 'variable'} patterns. AI responses demonstrate ${threadMessages.length > threadSessions.length * 5 ? 'comprehensive' : 'focused'} therapeutic engagement. Overall effectiveness indicators suggest ${totalForms > threadSessions.length * 0.8 ? 'excellent' : 'good'} user engagement and therapeutic progress.`
      };

      return c.json(analysis);
    } catch (error) {
      console.error("Error analyzing thread:", error);
      return c.json({ error: "Failed to analyze thread" }, 500);
    }
  })
  .post("/threads/:threadId/chat", async (c) => {
    try {
      const threadId = parseInt(c.req.param("threadId"));
      const { message, conversationHistory } = await c.req.json();
      
      console.log("Analysis chat for thread:", threadId, "Message:", message);

      // Get thread context (without revealing content)
      const thread = await db
        .select({
          id: threads.id,
          // Don't select actual content, just check existence
          hasInitialForm: sql<boolean>`CASE WHEN (session_name IS NOT NULL OR preferred_name IS NOT NULL OR current_emotions IS NOT NULL OR reason_for_visit IS NOT NULL OR support_type IS NOT NULL OR additional_context IS NOT NULL) THEN true ELSE false END`,
        })
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1);

      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, threadId));

      const threadMessages = await db
        .select({
          id: messages.id,
          role: messages.role,
          sessionId: messages.sessionId,
          timestamp: messages.timestamp,
          // Don't select actual content
        })
        .from(messages)
        .where(eq(messages.threadId, threadId));

      const threadGeneratedForms = await db
        .select({
          id: sessionForms.id,
          sessionId: sessionForms.sessionId,
          createdAt: sessionForms.createdAt,
          // Don't select actual form data
        })
        .from(sessionForms)
        .innerJoin(sessions, eq(sessionForms.sessionId, sessions.id))
        .where(eq(sessions.threadId, threadId));

      const totalForms = (thread[0]?.hasInitialForm ? 1 : 0) + threadGeneratedForms.length;

      // Create analysis context without revealing content
      const analysisContext = `
        You are a therapeutic conversation analysis AI. You have access to conversation patterns and metrics but NEVER reveal actual conversation content.
        
        Thread Analysis Context:
        - Thread ID: ${threadId} (anonymized)
        - Sessions: ${threadSessions.length}
        - Total messages: ${threadMessages.length}
        - Forms completed: ${totalForms} (${thread[0]?.hasInitialForm ? '1 initial + ' : ''}${threadGeneratedForms.length} generated)
        
        Session Breakdown:
        ${threadSessions.map((session, i) => {
          const sessionMessages = threadMessages.filter(m => m.sessionId === session.id);
          const sessionGeneratedForms = threadGeneratedForms.filter(f => f.sessionId === session.id);
          const initialFormNote = i === 0 && thread[0]?.hasInitialForm ? ' + 1 initial form' : '';
          return `Session ${i + 1}: ${sessionMessages.length} messages, ${sessionGeneratedForms.length} generated forms${initialFormNote}, status: ${session.status}`;
        }).join('\n')}
        
        Message Flow Pattern:
        ${threadSessions.map((session, i) => {
          const sessionMessages = threadMessages.filter(m => m.sessionId === session.id);
          const userMessages = sessionMessages.filter(m => m.role === 'user');
          const aiMessages = sessionMessages.filter(m => m.role === 'assistant');
          return `Session ${i + 1}: ${userMessages.length} user messages, ${aiMessages.length} AI responses`;
        }).join('\n')}
        
        You can analyze and discuss:
        - Conversation flow patterns
        - User engagement levels (message frequency, session completion)
        - AI response effectiveness (response rates, conversation progression)
        - Therapeutic progress indicators (form completion, session advancement)
        - Communication patterns and timing
        - Overall effectiveness metrics
        
        You CANNOT and MUST NOT:
        - Reveal any actual conversation content
        - Share personal information
        - Quote specific messages or responses
        - Disclose form contents or user inputs
        
        Focus on patterns, effectiveness, and professional therapeutic analysis.
      `;

      // Mock AI response - replace with actual AI service call
      let response = "";
      
      if (message.toLowerCase().includes("effectiveness") || message.toLowerCase().includes("helpful")) {
        response = `Based on the conversation patterns, this thread shows ${threadMessages.length > threadSessions.length * 8 ? 'high' : 'moderate'} AI effectiveness. The response rate is consistent across ${threadSessions.length} sessions, with an average of ${Math.round(threadMessages.length / threadSessions.length)} message exchanges per session. Form completion rate of ${Math.round((threadForms.length / threadSessions.length) * 100)}% indicates good user engagement with therapeutic tools.`;
      } else if (message.toLowerCase().includes("engagement") || message.toLowerCase().includes("participation")) {
        response = `User engagement analysis reveals ${threadMessages.filter(m => m.role === 'user').length} user-initiated messages across ${threadSessions.length} sessions. Session completion rate is ${threadSessions.filter(s => s.status === 'finished').length}/${threadSessions.length}, suggesting ${threadSessions.filter(s => s.status === 'finished').length > threadSessions.length * 0.7 ? 'strong' : 'moderate'} therapeutic commitment. Form submission patterns indicate consistent participation in structured therapeutic activities.`;
      } else if (message.toLowerCase().includes("flow") || message.toLowerCase().includes("progression")) {
        response = `Conversation flow analysis shows structured progression through ${threadSessions.length} sessions. Message distribution patterns indicate ${threadMessages.length > 50 ? 'comprehensive' : 'focused'} therapeutic discussions. Session advancement follows therapeutic protocols with ${threadForms.length} completed assessments supporting treatment progression. Overall flow demonstrates systematic therapeutic engagement.`;
      } else {
        response = `I can analyze various aspects of this ${threadSessions.length}-session thread including conversation effectiveness, user engagement patterns, therapeutic progression, and AI response quality. The thread contains ${threadMessages.length} messages with ${threadForms.length} form submissions, providing rich data for quality analysis. What specific aspect would you like me to examine?`;
      }

      return c.json({ response });
    } catch (error) {
      console.error("Error in analysis chat:", error);
      return c.json({ error: "Failed to process analysis request" }, 500);
    }
  })
  .get("/threads/anonymized", async (c) => {
    try {
      console.log("Fetching anonymized threads...");

      // Get threads with session count, ordered randomly
      const threadsWithSessions = await db
        .select({
          id: threads.id,
          createdAt: threads.createdAt,
          sessionCount: sql<number>`COUNT(${sessions.id})`,
        })
        .from(threads)
        .leftJoin(sessions, eq(sessions.threadId, threads.id))
        .groupBy(threads.id, threads.createdAt)
        .orderBy(sql`RANDOM()`)
        .limit(20); // Limit to 20 random threads

      // Create anonymized thread names
      const anonymizedThreads = threadsWithSessions.map((thread, index) => ({
        id: thread.id,
        displayName: `Thread ${index + 1}`,
        sessionCount: thread.sessionCount || 0,
        createdAt: thread.createdAt,
      }));

      console.log("Anonymized threads:", anonymizedThreads.length);

      return c.json(anonymizedThreads);
    } catch (error) {
      console.error("Error fetching anonymized threads:", error);
      return c.json({ error: "Failed to fetch threads" }, 500);
    }
  })
  .get("/metrics", async (c) => {
    try {
      console.log("Fetching admin metrics...");

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

      console.log("Thread metrics:", threadMetrics);

      // Get session metrics
      const sessionMetrics = await db
        .select({
          totalSessions: count(sessions.id),
          completedSessions: count(
            sql`CASE WHEN ${sessions.status} = 'finished' THEN 1 END`
          ),
        })
        .from(sessions);

      console.log("Session metrics:", sessionMetrics);

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

      console.log("Message metrics:", messageMetrics);

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

      console.log("Form metrics:", formMetrics);

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
      console.error("Error fetching admin metrics:", error);
      return c.json({ error: "Failed to fetch metrics" }, 500);
    }
  });

export default adminRoute;