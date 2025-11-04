import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, desc, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/config";
import { 
  counselorRequests, 
  counselorChats, 
  counselorMessages, 
  dailyRequestLimits,
  users 
} from "../db/schema";
import { adminMiddleware } from "../middleware/admin";
import { streamSSE } from "hono/streaming";
import { logger } from "../lib/logger";

// Request schemas
const createRequestSchema = z.object({
  requestReason: z.string().min(10, "Request reason must be at least 10 characters"),
  urgencyLevel: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  userContext: z.record(z.any()).optional(),
});

const acceptRequestSchema = z.object({
  adminNotes: z.string().optional(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  messageType: z.enum(["text", "system"]).default("text"),
});

const counselor = new Hono()
  // User-facing endpoints
  .post("/request", zValidator("json", createRequestSchema), async (c) => {
    try {
      const authHeader = c.req.header("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // TODO: Get user ID from JWT verification
      // For now, using placeholder since you mentioned your account has admin role
      const userId = 1; // This should be extracted from JWT in production

      const { requestReason, urgencyLevel, userContext } = c.req.valid("json");

      // Check daily request limit (2 per day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyLimit = await db
        .select()
        .from(dailyRequestLimits)
        .where(
          and(
            eq(dailyRequestLimits.userId, userId),
            gte(dailyRequestLimits.date, today)
          )
        )
        .limit(1);

      const currentCount = dailyLimit[0]?.requestCount || 0;
      if (currentCount >= 2) {
        return c.json({ 
          error: "Daily request limit exceeded",
          limit: 2,
          used: currentCount,
          resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        }, 429);
      }

      // Create counselor request
      const [request] = await db.insert(counselorRequests).values({
        userId,
        requestReason,
        urgencyLevel,
        userContext,
        status: "pending",
      }).returning();

      // Update daily request limit
      if (dailyLimit[0]) {
        await db
          .update(dailyRequestLimits)
          .set({ 
            requestCount: currentCount + 1,
            lastRequestAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(dailyRequestLimits.id, dailyLimit[0].id));
      } else {
        await db.insert(dailyRequestLimits).values({
          userId,
          requestCount: 1,
          date: today,
          lastRequestAt: new Date(),
        });
      }

      logger.log("Counselor request created:", { requestId: request.id, userId, urgencyLevel });

      return c.json({
        success: true,
        request: {
          id: request.id,
          status: request.status,
          requestedAt: request.requestedAt,
          urgencyLevel: request.urgencyLevel,
        },
        remainingRequests: Math.max(0, 2 - (currentCount + 1)),
      });

    } catch (error) {
      logger.error("Error creating counselor request:", error);
      return c.json({ 
        error: "Failed to create counselor request",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  })

  .get("/limit", async (c) => {
    try {
      const authHeader = c.req.header("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const token = authHeader.slice(7);
      // TODO: Verify Clerk JWT to get user ID
      const userId = 1; // Placeholder

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyLimit = await db
        .select()
        .from(dailyRequestLimits)
        .where(
          and(
            eq(dailyRequestLimits.userId, userId),
            gte(dailyRequestLimits.date, today)
          )
        )
        .limit(1);

      const currentCount = dailyLimit[0]?.requestCount || 0;

      return c.json({
        limit: 2,
        used: currentCount,
        remaining: Math.max(0, 2 - currentCount),
        resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });

    } catch (error) {
      logger.error("Error checking request limit:", error);
      return c.json({ error: "Failed to check request limit" }, 500);
    }
  })

  .get("/status/:requestId", async (c) => {
    try {
      const authHeader = c.req.header("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const token = authHeader.slice(7);
      // TODO: Verify Clerk JWT to get user ID
      const userId = 1; // Placeholder

      const requestId = parseInt(c.req.param("requestId"));
      if (isNaN(requestId)) {
        return c.json({ error: "Invalid request ID" }, 400);
      }

      const [request] = await db
        .select({
          id: counselorRequests.id,
          status: counselorRequests.status,
          urgencyLevel: counselorRequests.urgencyLevel,
          requestedAt: counselorRequests.requestedAt,
          acceptedAt: counselorRequests.acceptedAt,
          completedAt: counselorRequests.completedAt,
        })
        .from(counselorRequests)
        .where(
          and(
            eq(counselorRequests.id, requestId),
            eq(counselorRequests.userId, userId)
          )
        )
        .limit(1);

      if (!request) {
        return c.json({ error: "Request not found" }, 404);
      }

      return c.json({ request });

    } catch (error) {
      logger.error("Error checking request status:", error);
      return c.json({ error: "Failed to check request status" }, 500);
    }
  })

  // Admin-only endpoints
  .use("/admin/*", adminMiddleware)

  .get("/admin/requests", async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1");
      const limit = parseInt(c.req.query("limit") || "20");
      const status = c.req.query("status") || "pending";
      const offset = (page - 1) * limit;

      const requests = await db
        .select({
          id: counselorRequests.id,
          userId: counselorRequests.userId,
          status: counselorRequests.status,
          requestReason: counselorRequests.requestReason,
          urgencyLevel: counselorRequests.urgencyLevel,
          requestedAt: counselorRequests.requestedAt,
          acceptedAt: counselorRequests.acceptedAt,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(counselorRequests)
        .leftJoin(users, eq(counselorRequests.userId, users.id))
        .where(sql`${counselorRequests.status} = ${status}`)
        .orderBy(desc(counselorRequests.requestedAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(counselorRequests)
        .where(sql`${counselorRequests.status} = ${status}`);

      return c.json({
        requests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount[0].count / limit),
          totalRequests: totalCount[0].count,
          hasNext: page * limit < totalCount[0].count,
          hasPrev: page > 1,
        },
      });

    } catch (error) {
      logger.error("Error fetching counselor requests:", error);
      return c.json({ error: "Failed to fetch requests" }, 500);
    }
  })

  .post("/admin/accept/:requestId", zValidator("json", acceptRequestSchema), async (c) => {
    try {
      const adminId = 1; // TODO: Get from JWT
      const requestId = parseInt(c.req.param("requestId"));
      const { adminNotes } = c.req.valid("json");

      if (isNaN(requestId)) {
        return c.json({ error: "Invalid request ID" }, 400);
      }

      // Check if request exists and is pending
      const [existingRequest] = await db
        .select()
        .from(counselorRequests)
        .where(eq(counselorRequests.id, requestId))
        .limit(1);

      if (!existingRequest) {
        return c.json({ error: "Request not found" }, 404);
      }

      if (existingRequest.status !== "pending") {
        return c.json({ error: "Request already processed" }, 400);
      }

      // Start transaction
      await db.transaction(async (tx) => {
        // Update request status
        await tx
          .update(counselorRequests)
          .set({
            status: "accepted",
            adminId,
            acceptedAt: new Date(),
            adminNotes,
            updatedAt: new Date(),
          })
          .where(eq(counselorRequests.id, requestId));

        // Create chat session
        await tx.insert(counselorChats).values({
          requestId,
          userId: existingRequest.userId,
          adminId,
          status: "active",
          startedAt: new Date(),
        });
      });

      logger.log("Counselor request accepted:", { requestId, adminId });

      return c.json({
        success: true,
        message: "Request accepted and chat session created",
      });

    } catch (error) {
      logger.error("Error accepting counselor request:", error);
      return c.json({ error: "Failed to accept request" }, 500);
    }
  })

  .get("/admin/chats", async (c) => {
    try {
      const adminId = 1; // TODO: Get from JWT
      const status = c.req.query("status") || "active";

      const chats = await db
        .select({
          id: counselorChats.id,
          requestId: counselorChats.requestId,
          userId: counselorChats.userId,
          status: counselorChats.status,
          startedAt: counselorChats.startedAt,
          messageCount: counselorChats.messageCount,
          user: {
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          request: {
            requestReason: counselorRequests.requestReason,
            urgencyLevel: counselorRequests.urgencyLevel,
          },
        })
        .from(counselorChats)
        .innerJoin(counselorRequests, eq(counselorChats.requestId, counselorRequests.id))
        .innerJoin(users, eq(counselorChats.userId, users.id))
        .where(
          and(
            eq(counselorChats.adminId, adminId),
            sql`${counselorChats.status} = ${status}`
          )
        )
        .orderBy(desc(counselorChats.startedAt));

      return c.json({ chats });

    } catch (error) {
      logger.error("Error fetching counselor chats:", error);
      return c.json({ error: "Failed to fetch chats" }, 500);
    }
  })

  .post("/admin/message/:chatId", zValidator("json", sendMessageSchema), async (c) => {
    try {
      const adminId = 1; // TODO: Get from JWT
      const chatId = parseInt(c.req.param("chatId"));
      const { message, messageType } = c.req.valid("json");

      if (isNaN(chatId)) {
        return c.json({ error: "Invalid chat ID" }, 400);
      }

      // Verify chat exists and belongs to admin
      const [chat] = await db
        .select()
        .from(counselorChats)
        .where(
          and(
            eq(counselorChats.id, chatId),
            eq(counselorChats.adminId, adminId),
            sql`${counselorChats.status} = 'active'`
          )
        )
        .limit(1);

      if (!chat) {
        return c.json({ error: "Chat not found or not active" }, 404);
      }

      // Insert message
      const [newMessage] = await db
        .insert(counselorMessages)
        .values({
          chatId,
          senderId: adminId,
          senderType: "counselor",
          message,
          messageType,
          timestamp: new Date(),
        })
        .returning();

      // Update message count
      await db
        .update(counselorChats)
        .set({ 
          messageCount: sql`${counselorChats.messageCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(counselorChats.id, chatId));

      logger.log("Counselor message sent:", { chatId, messageId: newMessage.id });

      return c.json({
        success: true,
        message: newMessage,
      });

    } catch (error) {
      logger.error("Error sending counselor message:", error);
      return c.json({ error: "Failed to send message" }, 500);
    }
  })

  .put("/admin/end/:chatId", async (c) => {
    try {
      const adminId = 1; // TODO: Get from JWT
      const chatId = parseInt(c.req.param("chatId"));
      const { adminSummary } = await c.req.json();

      if (isNaN(chatId)) {
        return c.json({ error: "Invalid chat ID" }, 400);
      }

      // Calculate session duration
      const [chat] = await db
        .select({
          startedAt: counselorChats.startedAt,
          messageCount: counselorChats.messageCount,
          requestId: counselorChats.requestId,
        })
        .from(counselorChats)
        .where(
          and(
            eq(counselorChats.id, chatId),
            eq(counselorChats.adminId, adminId),
            sql`${counselorChats.status} = 'active'`
          )
        )
        .limit(1);

      if (!chat) {
        return c.json({ error: "Chat not found or not active" }, 404);
      }

      const sessionDuration = Math.round(
        (new Date().getTime() - new Date(chat.startedAt!).getTime()) / (1000 * 60)
      );

      // End chat session
      await db
        .update(counselorChats)
        .set({
          status: "ended",
          endedAt: new Date(),
          sessionDuration,
          adminSummary,
          updatedAt: new Date(),
        })
        .where(eq(counselorChats.id, chatId));

      // Update request status
      await db
        .update(counselorRequests)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(counselorRequests.id, chat.requestId));

      logger.log("Counselor chat ended:", { chatId, sessionDuration });

      return c.json({
        success: true,
        message: "Chat session ended",
        sessionDuration,
      });

    } catch (error) {
      logger.error("Error ending counselor chat:", error);
      return c.json({ error: "Failed to end chat" }, 500);
    }
  })

  // Real-time chat streaming
  .get("/chat/:chatId/stream", async (c) => {
    try {
      const authHeader = c.req.header("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const token = authHeader.slice(7);
      const userId = 1; // TODO: Get from JWT
      const chatId = parseInt(c.req.param("chatId"));

      if (isNaN(chatId)) {
        return c.json({ error: "Invalid chat ID" }, 400);
      }

      // Verify user has access to this chat
      const [chat] = await db
        .select()
        .from(counselorChats)
        .where(
          and(
            eq(counselorChats.id, chatId),
            sql`(${counselorChats.userId} = ${userId} OR ${counselorChats.adminId} = ${userId})`,
            sql`${counselorChats.status} = 'active'`
          )
        )
        .limit(1);

      if (!chat) {
        return c.json({ error: "Access denied to chat" }, 403);
      }

      return streamSSE(c, async (stream) => {
        // Get initial messages
        const messages = await db
          .select()
          .from(counselorMessages)
          .where(eq(counselorMessages.chatId, chatId))
          .orderBy(counselorMessages.timestamp);

        // Send initial messages
        for (const message of messages) {
          await stream.writeSSE({
            data: JSON.stringify({
              type: "message",
              message,
            }),
          });
        }

        // Keep connection alive and listen for new messages
        // In a real implementation, you'd use PostgreSQL LISTEN/NOTIFY
        // or a message queue like Redis
        let heartbeat = 0;
        const interval = setInterval(async () => {
          heartbeat++;
          await stream.writeSSE({
            data: JSON.stringify({
              type: "heartbeat",
              timestamp: Date.now(),
            }),
          });

          // Disconnect after 5 minutes for demo
          if (heartbeat > 300) {
            clearInterval(interval);
            await stream.close();
          }
        }, 1000);

        // Cleanup on disconnect
        stream.onAbort(() => {
          clearInterval(interval);
        });
      });

    } catch (error) {
      logger.error("Error in chat stream:", error);
      return c.json({ error: "Failed to start chat stream" }, 500);
    }
  });

export default counselor;