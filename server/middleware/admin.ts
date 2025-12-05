import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { db } from "../db/config";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Define role hierarchy and permissions
const ADMIN_ROLES = ['superadmin', 'admin', 'observer'];
const OBSERVER_ROLES = ['superadmin', 'admin', 'observer'];

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.log("No authorization header or invalid format");
      return c.json({ error: "Unauthorized - Admin access required" }, 403);
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

      if (!userRole || !ADMIN_ROLES.includes(userRole)) {
        logger.log(`Access denied for user ${payload.sub} with role: ${userRole}`);
        return c.json({ error: "Unauthorized - Admin access required" }, 403);
      }

      // Get user's database ID and role
      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, payload.sub))
        .limit(1);

      if (!adminUser) {
        logger.log(`Admin user not found in database: ${payload.sub}`);
        return c.json({ error: "Unauthorized - Admin user not found" }, 403);
      }

      // Set admin ID and role in context for downstream handlers
      c.set("adminId", adminUser.id);
      c.set("adminRole", userRole);

      logger.log(`Admin access granted for user ${payload.sub} with role: ${userRole}`);

      await next();
    } catch (tokenError) {
      logger.error("Token verification failed:", tokenError);
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
  } catch (error) {
    logger.error("Admin middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};

// Middleware for observer-level access (Monitor Threads)
export const observerMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.log("No authorization header or invalid format");
      return c.json({ error: "Unauthorized - Observer access required" }, 403);
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

      if (!userRole || !OBSERVER_ROLES.includes(userRole)) {
        logger.log(`Access denied for user ${payload.sub} with role: ${userRole}`);
        return c.json({ error: "Unauthorized - Observer access required" }, 403);
      }

      // Get user's database ID
      const [observerUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, payload.sub))
        .limit(1);

      if (!observerUser) {
        logger.log(`Observer user not found in database: ${payload.sub}`);
        return c.json({ error: "Unauthorized - Observer user not found" }, 403);
      }

      // Set observer ID and role in context
      c.set("observerId", observerUser.id);
      c.set("observerRole", userRole);

      logger.log(`Observer access granted for user ${payload.sub} with role: ${userRole}`);

      await next();
    } catch (tokenError) {
      logger.error("Token verification failed:", tokenError);
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
  } catch (error) {
    logger.error("Observer middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};