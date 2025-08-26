import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/config";
import { messages, sessionForms, sessions, threads } from "../db/schema";

export const threadsRoute = new Hono()
  .get("/", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    // Pagination support
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    // Get total count for pagination (exclude archived threads)
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(threads)
      .where(and(eq(threads.userId, parseInt(userId)), isNull(threads.archived)));

    const threadRows = await db
      .select()
      .from(threads)
      .where(and(eq(threads.userId, parseInt(userId)), isNull(threads.archived)))
      .orderBy(desc(threads.updatedAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      total,
      threads: threadRows,
    });
  })
  .get("/:threadId", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    const thread = await db
      .select()
      .from(threads)
      .where(eq(threads.id, parseInt(threadId)))
      .limit(1);

    if (!thread.length) {
      return c.json({ error: "Thread not found" }, 404);
    }

    return c.json(thread[0]);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    // Validation schema matching the form data
    const schema = z.object({
      userId: z.number(),
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
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    // Create the thread
    const [thread] = await db
      .insert(threads)
      .values({
        userId: parsed.data.userId,
        preferredName: parsed.data.preferredName,
        currentEmotions: parsed.data.currentEmotions,
        reasonForVisit: parsed.data.reasonForVisit,
        supportType: parsed.data.supportType,
        supportTypeOther: parsed.data.supportTypeOther,
        additionalContext: parsed.data.additionalContext,
        responseTone: parsed.data.responseTone,
        imageResponse: parsed.data.imageResponse,
        responseCharacter: parsed.data.responseCharacter,
        responseDescription: parsed.data.responseDescription,
      })
      .returning();

    // Create the first session for this thread
    const [session] = await db
      .insert(sessions)
      .values({
        threadId: thread.id,
        sessionNumber: 1,
        sessionName: "Session 1",
      })
      .returning();

    return c.json({ ...thread, sessionId: session.id });
  })
  // Get sessions for a thread
  .get("/:threadId/sessions", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    const threadSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.threadId, parseInt(threadId)))
      .orderBy(sessions.sessionNumber);

    return c.json(threadSessions);
  })
  // Create a new session for a thread
  .post("/:threadId/sessions", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    const body = await c.req.json();
    const schema = z.object({
      sessionName: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    // Check if thread exists
    const thread = await db
      .select()
      .from(threads)
      .where(eq(threads.id, parseInt(threadId)))
      .limit(1);

    if (!thread.length) {
      return c.json({ error: "Thread not found" }, 404);
    }

    // Count existing sessions for this thread
    const sessionCount = await db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.threadId, parseInt(threadId)));

    if (sessionCount[0].count >= 5) {
      return c.json({ error: "Maximum 5 sessions allowed per thread" }, 400);
    }

    // Create new session
    const [session] = await db
      .insert(sessions)
      .values({
        threadId: parseInt(threadId),
        sessionNumber: sessionCount[0].count + 1,
        sessionName:
          parsed.data.sessionName || `Session ${sessionCount[0].count + 1}`,
      })
      .returning();

    return c.json(session);
  })
  // Check and manage session status
  .post("/:threadId/check-session", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    try {
      console.log(`[SESSION CHECK] Starting for thread ${threadId}`);
      
      // Get all sessions for this thread
      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, parseInt(threadId)))
        .orderBy(sessions.sessionNumber);

      console.log(`[SESSION CHECK] Found ${threadSessions.length} sessions for thread ${threadId}`);

      if (threadSessions.length === 0) {
        return c.json({ error: "No sessions found for this thread" }, 404);
      }

      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago

      let newSessionCreated = false;
      let latestSession = threadSessions[threadSessions.length - 1];

      console.log(`[SESSION CHECK] Latest session: ID=${latestSession.id}, status=${latestSession.status}, created=${latestSession.createdAt}`);

      // Check if the latest session is active and meets progression conditions
      if (latestSession.status === "active") {
        const sessionCreatedDate = new Date(latestSession.createdAt || new Date());

        // Count messages in the latest session for main threads
        const messageCount = await db
          .select({ count: count() })
          .from(messages)
          .where(
            and(
              eq(messages.sessionId, latestSession.id),
              eq(messages.threadType, "main")
            )
          );

        const hasEnoughMessages = messageCount[0].count >= 7;
        const isOldEnough = sessionCreatedDate < fourHoursAgo;

        console.log(`[SESSION CHECK] Message count: ${messageCount[0].count}, hasEnoughMessages: ${hasEnoughMessages}`);
        console.log(`[SESSION CHECK] Session created: ${sessionCreatedDate}, 4 hours ago: ${fourHoursAgo}, isOldEnough: ${isOldEnough}`);

        if (hasEnoughMessages && isOldEnough) {
          console.log(`[SESSION CHECK] Conditions met for session completion`);
          
          // Mark current session as finished but DON'T create new session yet
          await db
            .update(sessions)
            .set({ status: "finished" })
            .where(eq(sessions.id, latestSession.id));

          console.log(`[SESSION CHECK] Marked session ${latestSession.id} as finished`);
          
          // Return completion status without creating new session
          // New session will be created after form submission
          return c.json({
            latestSession,
            sessionCompleted: true, // New flag to indicate session completion
            canCreateNewSession: threadSessions.length < 5,
            newSessionCreated: false,
            totalSessions: threadSessions.length,
          });
        } else {
          console.log(`[SESSION CHECK] Conditions not met - no new session created`);
          console.log(`[SESSION CHECK] - hasEnoughMessages: ${hasEnoughMessages} (need >= 7)`);
          console.log(`[SESSION CHECK] - isOldEnough: ${isOldEnough} (need > 4 hours)`);
        }
      } else if (latestSession.status === "finished") {
        console.log(`[SESSION CHECK] Latest session is finished, checking if follow-up form exists`);
        
        // Check if this finished session has a follow-up form
        const existingForm = await db
          .select()
          .from(sessionForms)
          .where(eq(sessionForms.sessionId, latestSession.id));

        if (existingForm.length === 0) {
          console.log(`[SESSION CHECK] No follow-up form found, session needs completion flow`);
          // Session is finished but has no follow-up form - trigger completion flow
          return c.json({
            latestSession,
            sessionCompleted: true,
            canCreateNewSession: threadSessions.length < 5,
            newSessionCreated: false,
            totalSessions: threadSessions.length,
          });
        } else {
          console.log(`[SESSION CHECK] Follow-up form exists, session is fully complete`);
        }
      } else {
        console.log(`[SESSION CHECK] Latest session is not active (status: ${latestSession.status})`);
      }

      console.log(`[SESSION CHECK] Returning: newSessionCreated=${newSessionCreated}, latestSessionId=${latestSession.id}`);

      // Return the latest active session
      return c.json({
        latestSession,
        newSessionCreated,
        totalSessions: newSessionCreated ? threadSessions.length + 1 : threadSessions.length,
      });
    } catch (error) {
      console.error("Error checking session status:", error);
      return c.json({ error: "Failed to check session status" }, 500);
    }
  })
  // Expire current session and create new one (for testing)
  .post("/:threadId/expire-session", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    const body = await c.req.json();
    const schema = z.object({
      sessionId: z.number(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    try {
      // Get all sessions for this thread
      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, parseInt(threadId)))
        .orderBy(sessions.sessionNumber);

      if (threadSessions.length === 0) {
        return c.json({ error: "No sessions found for this thread" }, 404);
      }

      // Mark the specified session as finished but DON'T create new session yet
      await db
        .update(sessions)
        .set({ status: "finished" })
        .where(eq(sessions.id, parsed.data.sessionId));

      console.log(`[EXPIRE SESSION] Marked session ${parsed.data.sessionId} as finished`);

      return c.json({
        message: "Session expired successfully",
        sessionCompleted: true,
        canCreateNewSession: threadSessions.length < 5,
        totalSessions: threadSessions.length,
      });
    } catch (error) {
      console.error("Error expiring session:", error);
      return c.json({ error: "Failed to expire session" }, 500);
    }
  })
  // Save follow-up form answers for a session
  .post("/sessions/:sessionId/form", async (c) => {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) {
      return c.json({ error: "sessionId is required" }, 400);
    }
    const body = await c.req.json();
    const schema = z.object({
      answers: z.record(z.any()),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }
    // Upsert: if a form already exists for this session, update it; otherwise, insert
    const existing = await db
      .select()
      .from(sessionForms)
      .where(eq(sessionForms.sessionId, parseInt(sessionId)));
    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(sessionForms)
        .set({ answers: parsed.data.answers, updatedAt: new Date() })
        .where(eq(sessionForms.sessionId, parseInt(sessionId)))
        .returning();
    } else {
      [result] = await db
        .insert(sessionForms)
        .values({
          sessionId: parseInt(sessionId),
          answers: parsed.data.answers,
        })
        .returning();
    }
    return c.json({ success: true, form: result });
  })
  // Create new session after form submission
  .post("/:threadId/create-next-session", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    try {
      console.log(`[CREATE NEXT SESSION] Starting for thread ${threadId}`);
      
      // Get all sessions for this thread
      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, parseInt(threadId)))
        .orderBy(sessions.sessionNumber);

      if (threadSessions.length === 0) {
        return c.json({ error: "No sessions found for this thread" }, 404);
      }

      if (threadSessions.length >= 5) {
        return c.json({ error: "Maximum sessions (5) reached for this thread" }, 400);
      }

      // Create a new session
      const [newSession] = await db
        .insert(sessions)
        .values({
          threadId: parseInt(threadId),
          sessionNumber: threadSessions.length + 1,
          sessionName: `Session ${threadSessions.length + 1}`,
          status: "active",
        })
        .returning();

      console.log(`[CREATE NEXT SESSION] Created new session: ID=${newSession.id}, sessionNumber=${newSession.sessionNumber}`);

      return c.json({
        success: true,
        newSession,
        totalSessions: threadSessions.length + 1,
      });
    } catch (error) {
      console.error("Error creating next session:", error);
      return c.json({ error: "Failed to create next session" }, 500);
    }
  })
  // Get session form status
  .get("/sessions/:sessionId/form", async (c) => {
    const sessionId = c.req.param("sessionId");
    if (!sessionId) {
      return c.json({ error: "sessionId is required" }, 400);
    }

    try {
      const existing = await db
        .select()
        .from(sessionForms)
        .where(eq(sessionForms.sessionId, parseInt(sessionId)));

      return c.json({ 
        hasForm: existing.length > 0,
        form: existing.length > 0 ? existing[0] : null 
      });
    } catch (error) {
      console.error("Error checking session form:", error);
      return c.json({ error: "Failed to check session form" }, 500);
    }
  })
  // Archive a thread
  .post("/:threadId/archive", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    try {
      // Check if thread exists
      const thread = await db
        .select()
        .from(threads)
        .where(eq(threads.id, parseInt(threadId)))
        .limit(1);

      if (!thread.length) {
        return c.json({ error: "Thread not found" }, 404);
      }

      // Mark thread as archived
      const [updatedThread] = await db
        .update(threads)
        .set({ 
          archived: new Date(),
          updatedAt: new Date()
        })
        .where(eq(threads.id, parseInt(threadId)))
        .returning();

      return c.json({
        message: "Thread archived successfully",
        thread: updatedThread,
      });
    } catch (error) {
      console.error("Error archiving thread:", error);
      return c.json({ error: "Failed to archive thread" }, 500);
    }
  })
  // Delete a thread permanently
  .delete("/:threadId", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    try {
      // Check if thread exists
      const thread = await db
        .select()
        .from(threads)
        .where(eq(threads.id, parseInt(threadId)))
        .limit(1);

      if (!thread.length) {
        return c.json({ error: "Thread not found" }, 404);
      }

      // Delete the thread (cascade will handle sessions, messages, and forms)
      await db
        .delete(threads)
        .where(eq(threads.id, parseInt(threadId)));

      return c.json({
        message: "Thread deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting thread:", error);
      return c.json({ error: "Failed to delete thread" }, 500);
    }
  })
  // Get archived threads
  .get("/archived", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    
    // Pagination support
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    try {
      // Get total count for pagination (only archived threads)
      const [{ count: total }] = await db
        .select({ count: count() })
        .from(threads)
        .where(and(eq(threads.userId, parseInt(userId)), isNotNull(threads.archived)));

      const archivedThreads = await db
        .select()
        .from(threads)
        .where(and(eq(threads.userId, parseInt(userId)), isNotNull(threads.archived)))
        .orderBy(desc(threads.archived))
        .limit(limit)
        .offset(offset);

      return c.json({
        total,
        threads: archivedThreads,
      });
    } catch (error) {
      console.error("Error fetching archived threads:", error);
      return c.json({ error: "Failed to fetch archived threads" }, 500);
    }
  })
  // Unarchive a thread
  .post("/:threadId/unarchive", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    try {
      // Check if thread exists and is archived
      const thread = await db
        .select()
        .from(threads)
        .where(eq(threads.id, parseInt(threadId)))
        .limit(1);

      if (!thread.length) {
        return c.json({ error: "Thread not found" }, 404);
      }

      if (!thread[0].archived) {
        return c.json({ error: "Thread is not archived" }, 400);
      }

      // Unarchive the thread
      const [updatedThread] = await db
        .update(threads)
        .set({ 
          archived: null,
          updatedAt: new Date()
        })
        .where(eq(threads.id, parseInt(threadId)))
        .returning();

      return c.json({
        message: "Thread unarchived successfully",
        thread: updatedThread,
      });
    } catch (error) {
      console.error("Error unarchiving thread:", error);
      return c.json({ error: "Failed to unarchive thread" }, 500);
    }
  })
  // Test endpoint to manually trigger session progression (for debugging)
  .post("/:threadId/test-session-progression", async (c) => {
    const threadId = c.req.param("threadId");
    if (!threadId) {
      return c.json({ error: "threadId is required" }, 400);
    }

    try {
      console.log(`[TEST SESSION] Manual test for thread ${threadId}`);
      
      // Get current session info
      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, parseInt(threadId)))
        .orderBy(sessions.sessionNumber);

      if (threadSessions.length === 0) {
        return c.json({ error: "No sessions found for this thread" }, 404);
      }

      const latestSession = threadSessions[threadSessions.length - 1];
      
      // Count messages
      const messageCount = await db
        .select({ count: count() })
        .from(messages)
        .where(
          and(
            eq(messages.sessionId, latestSession.id),
            eq(messages.threadType, "main")
          )
        );

      const now = new Date();
      const sessionAge = new Date(latestSession.createdAt || new Date());
      const ageInHours = (now.getTime() - sessionAge.getTime()) / (1000 * 60 * 60);

      return c.json({
        threadId: parseInt(threadId),
        currentSession: latestSession,
        messageCount: messageCount[0].count,
        sessionAgeHours: Math.round(ageInHours * 100) / 100,
        canProgress: messageCount[0].count >= 7 && ageInHours >= 4,
        totalSessions: threadSessions.length,
        maxSessionsReached: threadSessions.length >= 5,
        allSessions: threadSessions,
      });
    } catch (error) {
      console.error("Error testing session progression:", error);
      return c.json({ error: "Failed to test session progression" }, 500);
    }
  });

export default threadsRoute;
