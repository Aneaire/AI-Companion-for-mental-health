import { Hono } from "hono";
import { db } from "../db/config";
import { sessions, threads, messages, sessionForms } from "../db/schema";
import { adminMiddleware } from "../middleware/admin";
import { count, eq, sql } from "drizzle-orm";

const adminRoute = new Hono()
  .use("/*", adminMiddleware) // Protect all admin routes
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