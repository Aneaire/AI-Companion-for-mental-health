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
const OBSERVER_ROLES = ['superadmin', 'observer'];

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

      logger.log(`Admin middleware: Processing user ${payload.sub}`);

      // Get user metadata from Clerk
      const user = await clerkClient.users.getUser(payload.sub);
      const userRole = user.publicMetadata?.role as string;

      logger.log(`Admin middleware: User ${payload.sub} has role: ${userRole}`);

      if (!userRole || !ADMIN_ROLES.includes(userRole)) {
        logger.log(`Access denied for user ${payload.sub} with role: ${userRole}`);
        return c.json({ error: "Unauthorized - Admin access required" }, 403);
      }

      // Get user's database ID and role
      let [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, payload.sub))
        .limit(1);

      logger.log(`Admin middleware: Database lookup for ${payload.sub} - found: ${!!adminUser}`);

      // If admin user doesn't exist in database but has admin role in Clerk, auto-create them
      if (!adminUser && (userRole === 'admin' || userRole === 'observer' || userRole === 'superadmin')) {
        logger.log(`Admin user not found in database, auto-creating: ${payload.sub} with role: ${userRole}`);

        try {
          const email = user.emailAddresses?.[0]?.emailAddress;
          if (!email) {
            logger.error(`Cannot auto-create admin user ${payload.sub}: no email address found in Clerk`);
            return c.json({ error: "Unauthorized - Admin user missing email" }, 403);
          }

          logger.log(`Admin middleware: Creating user with email: ${email}`);

          const [newUser] = await db
            .insert(users)
            .values({
              clerkId: payload.sub,
              email: email,
              firstName: user.firstName || null,
              lastName: user.lastName || null,
              nickname: user.username || null,
              role: userRole,
              status: (userRole === 'admin' || userRole === 'observer' || userRole === 'superadmin') ? 'admin' : 'user',
              profileImageUrl: user.imageUrl || null,
            })
            .returning();

          adminUser = newUser;
          logger.log(`Successfully auto-created admin user: ${adminUser.id} (${email})`);
        } catch (createError: any) {
          logger.error(`Failed to auto-create admin user: ${createError?.message || createError}`);
          if (createError?.code === '23505') { // Unique constraint violation
            logger.log(`Admin user ${payload.sub} already exists, fetching existing user`);
            [adminUser] = await db
              .select()
              .from(users)
              .where(eq(users.clerkId, payload.sub))
              .limit(1);
          } else {
            return c.json({ error: "Unauthorized - Failed to create admin user" }, 500);
          }
        }
      }

      if (!adminUser) {
        logger.error(`Admin user not found in database after all attempts: ${payload.sub}`);
        return c.json({ error: "Unauthorized - Admin user not found" }, 403);
      }

      // Set admin ID and role in context for downstream handlers
      c.set("adminId", adminUser.id);
      c.set("adminRole", userRole);

      logger.log(`Admin access granted for user ${payload.sub} with role: ${userRole}, db id: ${adminUser.id}`);

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
      const userRole = user.publicMetadata?.role as string;

      if (!userRole || !OBSERVER_ROLES.includes(userRole)) {
        logger.log(`Access denied for user ${payload.sub} with role: ${userRole}`);
        return c.json({ error: "Unauthorized - Observer access required" }, 403);
      }

      // Get user's database ID
      let [observerUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, payload.sub))
        .limit(1);

      // If observer user doesn't exist in database but has observer role in Clerk, auto-create them
      if (!observerUser && (userRole === 'admin' || userRole === 'observer' || userRole === 'superadmin')) {
        logger.log(`Observer user not found in database, auto-creating: ${payload.sub} with role: ${userRole}`);

        try {
          const email = user.emailAddresses?.[0]?.emailAddress;
          if (!email) {
            logger.error(`Cannot auto-create observer user ${payload.sub}: no email address found in Clerk`);
            return c.json({ error: "Unauthorized - Observer user missing email" }, 403);
          }

          const [newUser] = await db
            .insert(users)
            .values({
              clerkId: payload.sub,
              email: email,
              firstName: user.firstName || null,
              lastName: user.lastName || null,
              nickname: user.username || null,
              role: userRole,
              status: (userRole === 'admin' || userRole === 'observer' || userRole === 'superadmin') ? 'admin' : 'user',
              profileImageUrl: user.imageUrl || null,
            })
            .returning();

          observerUser = newUser;
          logger.log(`Successfully auto-created observer user: ${observerUser.id} (${email})`);
        } catch (createError: any) {
          logger.error(`Failed to auto-create observer user: ${createError?.message || createError}`);
          if (createError?.code === '23505') { // Unique constraint violation
            logger.log(`Observer user ${payload.sub} already exists, fetching existing user`);
            [observerUser] = await db
              .select()
              .from(users)
              .where(eq(users.clerkId, payload.sub))
              .limit(1);
          } else {
            return c.json({ error: "Unauthorized - Failed to create observer user" }, 500);
          }
        }
      }

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