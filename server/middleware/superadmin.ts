import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { db } from "../db/config";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Define superadmin-only access
const SUPERADMIN_ROLES = ['superadmin'];

export const superadminMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.log("No authorization header or invalid format");
      return c.json({ error: "Unauthorized - Superadmin access required" }, 403);
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    try {
      // Verify JWT token with Clerk
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      if (!payload.sub) {
        logger.log("Invalid token payload");
        return c.json({ error: "Unauthorized - Invalid token" }, 401);
      }

      // Get user metadata from Clerk
      const user = await clerkClient.users.getUser(payload.sub);
      const userRole = user.publicMetadata?.role;

      if (!userRole || !SUPERADMIN_ROLES.includes(userRole)) {
        logger.log(`Access denied for user ${payload.sub} with role: ${userRole}`);
        return c.json({ error: "Unauthorized - Superadmin access required" }, 403);
      }

      // Get user's database ID and role
      const [superadminUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, payload.sub))
        .limit(1);

      if (!superadminUser) {
        logger.log(`Superadmin user not found in database: ${payload.sub}`);
        return c.json({ error: "Unauthorized - Superadmin user not found" }, 403);
      }

      // Set superadmin ID and role in context for downstream handlers
      c.set("adminId", superadminUser.id);
      c.set("adminRole", userRole);

      logger.log(`Superadmin access granted for user ${payload.sub} with role: ${userRole}`);

      await next();
    } catch (tokenError) {
      logger.error("Token verification failed:", tokenError);
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
  } catch (error) {
    logger.error("Superadmin middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};