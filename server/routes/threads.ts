import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/config";
import { threads } from "../db/schema";

export const threadsRoute = new Hono()
  .get("/", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const sessions = await db
      .select()
      .from(threads)
      .where(eq(threads.userId, parseInt(userId)))
      .orderBy(desc(threads.updatedAt));
    return c.json(sessions);
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

    const [session] = await db
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
    return c.json(session);
  });

export default threadsRoute;
