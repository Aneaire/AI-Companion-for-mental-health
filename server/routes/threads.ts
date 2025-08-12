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
      // Get all sessions for this thread
      const threadSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, parseInt(threadId)))
        .orderBy(sessions.sessionNumber);

      if (threadSessions.length === 0) {
        return c.json({ error: "No sessions found for this thread" }, 404);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let newSessionCreated = false;
      let latestSession = threadSessions[threadSessions.length - 1];

      // Check if the latest session was created before today and has at least 7 messages
      if (latestSession.status === "active") {
        const sessionCreatedDate = new Date(
          latestSession.createdAt || new Date()
        );
        sessionCreatedDate.setHours(0, 0, 0, 0);

        // Count messages in the latest session
        const messageCount = await db
          .select({ count: count() })
          .from(messages)
          .where(eq(messages.sessionId, latestSession.id));

        const hasEnoughMessages = messageCount[0].count >= 7;
        const isFromPreviousDay = sessionCreatedDate < today;

        if (hasEnoughMessages && isFromPreviousDay) {
          // Mark current session as finished
          await db
            .update(sessions)
            .set({ status: "finished" })
            .where(eq(sessions.id, latestSession.id));

          // Create a new session if we haven't reached the limit
          if (threadSessions.length < 5) {
            const [newSession] = await db
              .insert(sessions)
              .values({
                threadId: parseInt(threadId),
                sessionNumber: threadSessions.length + 1,
                sessionName: `Session ${threadSessions.length + 1}`,
                status: "active",
              })
              .returning();

            newSessionCreated = true;
            latestSession = newSession;
          }
        }
      }

      // Return the latest active session
      return c.json({
        latestSession,
        newSessionCreated,
        totalSessions: threadSessions.length,
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

      // Mark the specified session as finished
      await db
        .update(sessions)
        .set({ status: "finished" })
        .where(eq(sessions.id, parsed.data.sessionId));

      // Create a new session if we haven't reached the limit
      let newSession = null;
      if (threadSessions.length < 5) {
        const [createdSession] = await db
          .insert(sessions)
          .values({
            threadId: parseInt(threadId),
            sessionNumber: threadSessions.length + 1,
            sessionName: `Session ${threadSessions.length + 1}`,
            status: "active",
          })
          .returning();

        newSession = createdSession;
      }

      // Return updated sessions
      const updatedSessions = await db
        .select()
        .from(sessions)
        .where(eq(sessions.threadId, parseInt(threadId)))
        .orderBy(sessions.sessionNumber);

      return c.json({
        message: "Session expired successfully",
        newSession,
        sessions: updatedSessions,
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
  });

export default threadsRoute;
