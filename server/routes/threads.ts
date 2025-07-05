import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/config";
import { chatSessions } from "../db/schema";

export const threadsRoute = new Hono()
  .get("/", async (c) => {
    const userId = c.req.query("userId");
    let threadType = c.req.query("threadType") || "chat";
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }
    if (threadType !== "chat") {
      threadType = "chat";
    }

    const sessions = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, parseInt(userId)),
          eq(chatSessions.threadType, "chat")
        )
      )
      .orderBy(desc(chatSessions.updatedAt));
    return c.json(sessions);
  })
  .post("/", async (c) => {
    const body = await c.req.json();
    // Validation schema matching the form data
    const schema = z.object({
      userId: z.number(),
      personaId: z.number().optional().nullable(),
      preferredName: z.string().optional(),
      currentEmotions: z.array(z.string()).optional(),
      reasonForVisit: z.string(),
      supportType: z.array(z.string()).optional(),
      supportTypeOther: z.string().optional(),
      additionalContext: z.string().optional(),
      responseTone: z.string().optional(),
      imageResponse: z.string().optional(),
      threadType: z.enum(["chat"]).default("chat").optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid input", details: parsed.error }, 400);
    }

    const [session] = await db
      .insert(chatSessions)
      .values({
        userId: parsed.data.userId,
        personaId: parsed.data.personaId ?? null,
        preferredName: parsed.data.preferredName,
        currentEmotions: parsed.data.currentEmotions,
        reasonForVisit: parsed.data.reasonForVisit,
        supportType: parsed.data.supportType,
        supportTypeOther: parsed.data.supportTypeOther,
        additionalContext: parsed.data.additionalContext,
        responseTone: parsed.data.responseTone,
        imageResponse: parsed.data.imageResponse,
        threadType: parsed.data.threadType || "chat",
      })
      .returning();
    return c.json(session);
  });

export default threadsRoute;
